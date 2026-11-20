import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serveStatic } from '@hono/node-server/serve-static';
import { type Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { getCookie } from 'hono/cookie';
import { HTTPException } from 'hono/http-exception';
import { secureHeaders } from 'hono/secure-headers';
import { validator } from 'hono/validator';
import { z } from 'zod';
import {
  clearRound,
  clearSession,
  publicOnly,
  ROUND_COOKIE,
  SESSION_COOKIE,
  SETUP_COOKIE,
  setRound,
  setSession,
  setSetup,
  teamAccess,
  type TeamVariables,
} from './access.js';
import { type Purpose, type Secrets, sessions } from './auth.js';
import { isLocal, type TeamConfig } from './config.js';
import type { TeamStore } from './db.js';
import { accountSchema, type GitHub, GitHubError } from './github.js';

/** dist/team/app.js → dist/web, where Vite puts `team.html`. */
const DEFAULT_WEB_ROOT = fileURLToPath(new URL('../web', import.meta.url));

export interface TeamAppOptions {
  config: TeamConfig;
  store: TeamStore;
  github: GitHub;
  secrets: Secrets;
  /**
   * Reads every installation again, soon: once the App exists, and when GitHub returns the admin from installing it.
   * Settles when that pass is done: with one under way, the pass after it, which asks GitHub after the question.
   */
  pollSoon: () => Promise<void>;
  /** Reads one installation again now. */
  pollInstallation: (id: number) => Promise<void>;
  webRoot?: string;
  now?: () => Date;
  log?: (line: string) => void;
}

type Env = { Variables: TeamVariables };

const refuse = (c: Context<Env>, status: 400 | 403 | 404 | 502, code: string, message: string) =>
  c.json({ error: { code, message } }, status);

/** The App's name: unique across GitHub and at most 34 characters, so a random suffix per server. */
export const appName = (): string => `Jig UI ${Math.random().toString(36).slice(2, 10)}`;

/**
 * The manifest the setup page posts to GitHub: a public App with Metadata (read) only, its URLs on the public address.
 * A server on localhost gets no webhook GitHub could not reach.
 */
export function manifestOf(publicUrl: URL, name: string): Record<string, unknown> {
  const base = publicUrl.origin;
  return {
    name,
    url: base,
    hook_attributes: { url: `${base}/webhook/github`, active: !isLocal(publicUrl) },
    redirect_url: `${base}/setup/done`,
    callback_urls: [`${base}/auth/callback`],
    setup_url: `${base}/`,
    setup_on_update: true,
    public: true,
    default_permissions: { metadata: 'read' },
    // installation, installation_repositories and github_app_authorization reach every App without being asked for.
    default_events: [],
    request_oauth_on_install: false,
  };
}

// Each body is read by its schema; what does not fit is `undefined`, which the route refuses in its own words.
const setupBody = validator('json', (body: unknown) => {
  const parsed = z.object({ code: z.string() }).safeParse(body);
  return { code: parsed.success ? parsed.data.code : undefined };
});
const manifestBody = validator('json', (body: unknown) => {
  // An organization by its login, or `null` for the personal account; `undefined` is neither.
  const parsed = z
    .object({
      organization: z
        .string()
        .regex(/^[A-Za-z0-9-]{1,39}$/)
        .nullish(),
    })
    .safeParse(body);
  return { organization: parsed.success ? (parsed.data.organization ?? null) : undefined };
});
// GitHub returns the admin from installing the App to the page with its `installation_id`, which the page hands on.
const installedQuery = validator('query', (query: Record<string, string | string[]>) => {
  const id = Number(query.installation);
  return { installation: Number.isSafeInteger(id) && id > 0 ? id : undefined };
});
const decisionBody = validator('json', (body: unknown) => {
  const parsed = z.object({ decision: z.enum(['approved', 'refused']) }).safeParse(body);
  return { decision: parsed.success ? parsed.data.decision : undefined };
});
const webhookSchema = z.object({
  action: z.string().optional(),
  installation: z.object({ id: z.number(), account: accountSchema.optional() }).optional(),
  repositories_removed: z.array(z.object({ id: z.number() })).optional(),
  sender: z.object({ id: z.number() }).optional(),
});

function teamRoutes({
  config,
  store,
  github,
  secrets,
  pollSoon,
  pollInstallation,
  now = () => new Date(),
  log = console.log,
}: TeamAppOptions) {
  const base = config.publicUrl.origin;
  const callback = `${base}/auth/callback`;
  const readInstallation = (id: number): Promise<void> =>
    pollInstallation(id).catch((error: unknown) => log(`Could not read installation ${id}: ${String(error)}`));

  /** The approved installations a person reaches and the repositories there they may push to, noted as writers. */
  async function reachOf(token: string, githubId: number): Promise<number> {
    const approved = new Set(
      store
        .installations()
        .filter((one) => one.state === 'approved')
        .map((one) => one.id),
    );
    let reached = 0;
    for (const installation of await github.userInstallations(token)) {
      if (!approved.has(installation.id) || installation.suspended) continue;
      for (const repository of await github.userRepositories(token, installation.id)) {
        if (!repository.push) continue;
        store.noteRepository(installation.id, repository);
        store.addWriter(repository.id, githubId);
        reached++;
      }
    }
    return reached;
  }

  /** Where a sign-in lands: the person it is for, or why there is none. */
  async function signIn(purpose: Purpose, token: string, setup: string | undefined): Promise<number | 'nothing' | 'taken' | 'no-setup'> {
    const user = await github.user(token);
    const account = { githubId: user.id, login: user.login };
    const reached = await reachOf(token, user.id);
    const known = store.personOf(user.id);
    if (purpose.kind === 'admin') {
      if (setup !== purpose.setup || store.hasAdmin() || !secrets.takeAdmin(purpose.setup)) return 'no-setup';
      const id = known ?? store.createPerson(account, true, now());
      store.makeAdmin(id);
      return id;
    }
    if (purpose.kind === 'link') return store.linkAccount(purpose.personId, account, now()) ? purpose.personId : 'taken';
    if (known !== null) {
      store.linkAccount(known, account, now());
      const person = store.person(known);
      return person?.isAdmin || store.projects(known).length > 0 ? known : 'nothing';
    }
    return reached > 0 ? store.createPerson(account, false, now()) : 'nothing';
  }

  return new Hono<Env>()
    .get('/api/team/state', (c) => {
      const personId = sessions.person(store, getCookie(c, SESSION_COOKIE), now());
      // Set up once its admin signed in; an App with no admin yet waits for the code again.
      return c.json({ setUp: store.hasAdmin(), hasApp: store.app() !== null, signedIn: personId !== null });
    })

    .post('/api/team/setup', setupBody, (c) => {
      const { code } = c.req.valid('json');
      if (code === undefined) return refuse(c, 400, 'usage', 'Give the setup code.');
      const setup = secrets.openSetup(code);
      if (!setup) return refuse(c, 403, 'wrong-code', 'That is not the setup code in the server’s log.');
      setSetup(c, setup);
      return c.json({ ok: true as const });
    })

    .post('/api/team/setup/manifest', manifestBody, (c) => {
      const { organization } = c.req.valid('json');
      if (organization === undefined) return refuse(c, 400, 'usage', 'An organization is named by its login.');
      const state = secrets.manifestState(getCookie(c, SETUP_COOKIE) ?? '');
      if (!state) return refuse(c, 403, 'no-setup', 'Enter the setup code from the server’s log first.');
      const where = organization
        ? `${config.github.web}/organizations/${organization}/settings/apps/new`
        : `${config.github.web}/settings/apps/new`;
      return c.json({ action: `${where}?state=${state}`, manifest: JSON.stringify(manifestOf(config.publicUrl, appName())) });
    })

    .get('/api/team/me', (c) => {
      const person = store.person(c.get('personId'))!;
      return c.json({
        admin: person.isAdmin,
        accounts: person.accounts.map((account) => ({ id: account.githubId, login: account.login })),
      });
    })

    .get('/api/team/projects', (c) => c.json({ projects: store.projects(c.get('personId')) }))

    .get('/api/team/admin/installations', installedQuery, async (c) => {
      const { installation } = c.req.valid('query');
      const known = () => store.installations().some((one) => one.id === installation);
      // A pass already under way may have asked GitHub before the installation: the one after it has it.
      if (installation !== undefined && !known()) await pollSoon();
      const app = store.app();
      return c.json({
        installations: store.installations(),
        install: app ? `${config.github.web}/apps/${app.slug}/installations/new` : null,
      });
    })

    .post('/api/team/admin/installations/:id', decisionBody, async (c) => {
      const { decision } = c.req.valid('json');
      const id = Number(c.req.param('id'));
      if (decision === undefined || !Number.isSafeInteger(id))
        return refuse(c, 400, 'usage', 'Decide approved or refused for an installation id.');
      if (!store.decideInstallation(id, decision, now())) return refuse(c, 404, 'not-found', 'No such installation.');
      if (decision === 'approved') await readInstallation(id);
      return c.json({ installations: store.installations() });
    })

    .post('/api/team/sign-out', (c) => {
      sessions.end(store, getCookie(c, SESSION_COOKIE));
      clearSession(c);
      return c.json({ ok: true as const });
    })

    .get('/setup/done', async (c) => {
      const setup = getCookie(c, SETUP_COOKIE);
      const code = c.req.query('code');
      if (!code || !secrets.takeManifestState(setup, c.req.query('state') ?? '')) {
        return c.redirect('/?problem=bad-state', 302);
      }
      try {
        store.saveApp(await github.convertManifest(code), now());
      } catch (error) {
        log(`Could not register the App: ${error instanceof GitHubError ? error.message : String(error)}`);
        return c.redirect('/?problem=no-app', 302);
      }
      log('The GitHub App is registered; its admin signs in next.');
      void pollSoon();
      return c.redirect('/auth/sign-in?as=admin', 302);
    })

    .get('/auth/sign-in', (c) => {
      const app = store.app()!;
      const as = c.req.query('as');
      const purpose: Purpose =
        as === 'admin'
          ? { kind: 'admin', setup: getCookie(c, SETUP_COOKIE)! }
          : as === 'link'
            ? { kind: 'link', personId: c.get('personId') }
            : { kind: 'sign-in' };
      const { state, challenge } = secrets.startRound(purpose);
      setRound(c, state);
      const query = new URLSearchParams({
        client_id: app.clientId,
        redirect_uri: callback,
        state,
        code_challenge: challenge,
        code_challenge_method: 'S256',
        ...(purpose.kind === 'link' ? { prompt: 'select_account' } : {}),
      });
      return c.redirect(`${config.github.web}/login/oauth/authorize?${query}`, 302);
    })

    .get('/auth/callback', async (c) => {
      const round = secrets.takeRound(c.req.query('state') ?? '', getCookie(c, ROUND_COOKIE));
      clearRound(c);
      const code = c.req.query('code');
      // GitHub sends `error` and no code when the person pressed Cancel there (`access_denied`), or could not sign in.
      const error = c.req.query('error');
      if (!code && error) {
        if (error === 'access_denied') return c.redirect('/?problem=cancelled', 302);
        // Only for a round this browser started: anyone may send this address an error to write. Quoted, so a line break
        // in it stays in its line.
        if (round)
          log(`GitHub did not complete a sign-in: ${JSON.stringify(error)} ${JSON.stringify(c.req.query('error_description') ?? '')}`);
        return c.redirect('/?problem=github', 302);
      }
      if (!round || !code) return c.redirect('/?problem=expired', 302);
      // An account is linked to the person signed in where the link began, and to no one else.
      if (round.purpose.kind === 'link' && sessions.person(store, getCookie(c, SESSION_COOKIE), now()) !== round.purpose.personId) {
        return c.redirect('/?problem=expired', 302);
      }
      const app = store.app()!;
      let landed: Awaited<ReturnType<typeof signIn>>;
      try {
        const token = await github.userToken({
          clientId: app.clientId,
          clientSecret: app.clientSecret,
          code,
          verifier: round.verifier,
          redirectUri: callback,
        });
        // The person's token ends here: it is used for this sign-in and never kept.
        landed = await signIn(round.purpose, token, getCookie(c, SETUP_COOKIE));
      } catch (error) {
        log(`A sign-in failed: ${error instanceof GitHubError ? error.message : String(error)}`);
        return c.redirect('/?problem=github', 302);
      }
      if (typeof landed !== 'number') return c.redirect(`/?problem=${landed}`, 302);
      if (round.purpose.kind !== 'link') {
        sessions.end(store, getCookie(c, SESSION_COOKIE));
        const session = sessions.open(store, landed, now());
        setSession(c, session.id, session.expires);
      }
      return c.redirect('/', 302);
    })

    .post('/webhook/github', async (c) => {
      const event = c.req.header('x-github-event');
      let body: unknown;
      try {
        body = JSON.parse(c.get('webhookBody'));
      } catch {
        return refuse(c, 400, 'usage', 'The webhook body is no JSON.');
      }
      const parsed = webhookSchema.safeParse(body);
      if (!parsed.success) return c.body(null, 204);
      const { action, installation, repositories_removed: removed, sender } = parsed.data;
      if (event === 'installation' && installation) {
        if (action === 'created' && installation.account) {
          store.noteInstallation(
            {
              id: installation.id,
              accountId: installation.account.id,
              accountLogin: installation.account.login,
              accountType: installation.account.type,
            },
            now(),
          );
        }
        if (action === 'deleted') store.removeInstallation(installation.id);
        if (action === 'suspend') store.clearRepositories(installation.id);
        if (action === 'unsuspend') await readInstallation(installation.id);
      }
      if (event === 'installation_repositories' && installation) {
        if (removed) store.removeRepositories(removed.map((repository) => repository.id));
        if (action === 'added') await readInstallation(installation.id);
      }
      if (event === 'github_app_authorization' && action === 'revoked' && sender) store.endSessionsOf(sender.id);
      return c.body(null, 204);
    });
}

export type TeamAppType = ReturnType<typeof teamRoutes>;

/** The team server: the guard before every route, then the routes and the built page (`team.html`). */
export function createTeamApp(options: TeamAppOptions): Hono<Env> {
  const { config, store, secrets, now = () => new Date(), webRoot = DEFAULT_WEB_ROOT } = options;
  const app = new Hono<Env>();
  app.use(secureHeaders());
  app.use(publicOnly(config.publicUrl));
  // GitHub's webhooks are the largest bodies here, read whole before their signature; one past the limit waits for
  // the next poll instead.
  app.use(
    bodyLimit({
      maxSize: 1024 * 1024,
      onError: (c) => c.json({ error: { code: 'too-large', message: 'The body is larger than this server takes.' } }, 413),
    }),
  );
  app.use(teamAccess({ store, secrets, now }));
  app.onError((error, c) => {
    // Hono's own refusals, such as a body that is no JSON: their status, in the API's form.
    if (error instanceof HTTPException) return c.json({ error: { code: 'usage', message: error.message } }, error.status);
    console.error(error);
    return c.json({ error: { code: 'internal', message: 'The team server hit an error it did not expect; its log says what.' } }, 500);
  });
  app.route('/', teamRoutes(options));
  app.all('/api/*', (c) => c.json({ error: { code: 'not-found', message: 'No such route.' } }, 404));
  if (existsSync(join(webRoot, 'team.html'))) {
    app.use('/assets/*', serveStatic({ root: webRoot }));
    app.get('/', serveStatic({ path: join(webRoot, 'team.html') }));
  } else {
    app.get('/', (c) => c.text('The page is not built. Run npm run build.', 503));
  }
  return app;
}
