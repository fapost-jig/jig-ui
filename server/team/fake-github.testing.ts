import { createHash, generateKeyPairSync, verify } from 'node:crypto';
import { Hono } from 'hono';

/** An account on the fake GitHub: its user id and login. */
export interface FakeUser {
  id: number;
  login: string;
}

export interface FakeRepository {
  id: number;
  full_name: string;
  fork?: boolean;
  parent?: number;
  /** User ids that may push. */
  writers: number[];
}

export interface FakeInstallation {
  id: number;
  /** An enterprise, as GitHub gives it, names itself by a slug and has no login and no type. */
  account:
    | {
        id: number;
        login: string;
        type: 'User' | 'Organization';
      }
    | {
        id: number;
        slug: string;
        name: string;
      };
  suspended?: boolean;
  repositories: FakeRepository[];
}

/**
 * GitHub as the team server talks to it, in memory: the manifest flow, OAuth with PKCE, the App's JWT, installation
 * tokens, and the REST endpoints the server reads. `web` and `api` are its two base URLs; `fetch` answers them without
 * a network. Repositories carry a `temp_clone_token`, which the server must never keep.
 */
export function fakeGitHub() {
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const pem = privateKey.export({ type: 'pkcs1', format: 'pem' }).toString();
  const state = {
    app: { id: 4242, slug: 'jig-ui-test', client_id: 'Iv1.test', client_secret: 'client-secret', webhook_secret: 'hook-secret', pem },
    manifestCodes: new Map<string, unknown>(),
    users: new Map<number, FakeUser>(),
    installations: [] as FakeInstallation[],
    oauthCodes: new Map<
      string,
      {
        user: number;
        challenge: string;
      }
    >(),
    userTokens: new Map<string, number>(),
    installationTokens: new Map<string, number>(),
    requests: [] as string[],
    issued: 0,
  };
  const web = 'https://github.test';
  const api = 'https://api.github.test';

  const app = new Hono();
  app.use(async (c, next) => {
    state.requests.push(`${c.req.method} ${new URL(c.req.url).pathname}`);
    await next();
  });

  const verifyJwt = (header: string | undefined): boolean => {
    const [h, p, s] = (header?.replace(/^Bearer /, '') ?? '').split('.');
    if (!h || !p || !s) return false;
    const ok = verify('sha256', Buffer.from(`${h}.${p}`), publicKey, Buffer.from(s, 'base64url'));
    const payload = JSON.parse(Buffer.from(p, 'base64url').toString()) as {
      iss: string;
      exp: number;
    };
    return ok && payload.iss === String(state.app.id) && payload.exp * 1000 > Date.now();
  };
  const userOf = (header: string | undefined): number | undefined => state.userTokens.get(header?.replace(/^Bearer /, '') ?? '');
  const installationOf = (header: string | undefined): number | undefined =>
    state.installationTokens.get(header?.replace(/^Bearer /, '') ?? '');
  const repositoryJson = (repository: FakeRepository, user?: number) => ({
    id: repository.id,
    full_name: repository.full_name,
    fork: repository.fork ?? false,
    private: true,
    temp_clone_token: 'TEMP-CLONE-SECRET',
    ...(user === undefined ? {} : { permissions: { admin: false, push: repository.writers.includes(user), pull: true } }),
  });
  const installationJson = (installation: FakeInstallation) => ({
    id: installation.id,
    account: installation.account,
    suspended_at: installation.suspended ? '2026-11-16T00:00:00Z' : null,
  });
  const allRepositories = (): FakeRepository[] => state.installations.flatMap((installation) => installation.repositories);

  app.post('/api/app-manifests/:code/conversions', (c) => {
    const manifest = state.manifestCodes.get(c.req.param('code'));
    if (!manifest) return c.json({ message: 'Not Found' }, 404);
    state.manifestCodes.delete(c.req.param('code'));
    return c.json({ ...state.app, owner: { login: 'someone' }, name: 'Jig UI', extra_field: 'dropped' }, 201);
  });

  app.post('/login/oauth/access_token', async (c) => {
    const body = await c.req.json<{
      code: string;
      code_verifier: string;
      client_id: string;
      client_secret: string;
    }>();
    const grant = state.oauthCodes.get(body.code);
    state.oauthCodes.delete(body.code);
    const challenge = createHash('sha256').update(body.code_verifier).digest('base64url');
    if (!grant || grant.challenge !== challenge || body.client_secret !== state.app.client_secret) {
      return c.json({ error: 'bad_verification_code' });
    }
    const token = `ghu_${++state.issued}`;
    state.userTokens.set(token, grant.user);
    return c.json({ access_token: token, token_type: 'bearer', scope: '' });
  });

  app.get('/api/user', (c) => {
    const user = state.users.get(userOf(c.req.header('authorization')) ?? -1);
    return user ? c.json({ ...user, name: 'Somebody', email: 'x@example.com' }) : c.json({ message: 'Bad credentials' }, 401);
  });

  app.get('/api/user/installations', (c) => {
    const user = userOf(c.req.header('authorization'));
    if (user === undefined) return c.json({ message: 'Bad credentials' }, 401);
    const reached = state.installations.filter(
      (installation) =>
        installation.account.id === user || installation.repositories.some((repository) => repository.writers.includes(user)),
    );
    return c.json({ total_count: reached.length, installations: reached.map(installationJson) });
  });

  app.get('/api/user/installations/:id/repositories', (c) => {
    const user = userOf(c.req.header('authorization'));
    if (user === undefined) return c.json({ message: 'Bad credentials' }, 401);
    const installation = state.installations.find((one) => one.id === Number(c.req.param('id')));
    if (!installation) return c.json({ message: 'Not Found' }, 404);
    const repositories = installation.repositories.filter((repository) => repository.writers.includes(user));
    return c.json({ total_count: repositories.length, repositories: repositories.map((repository) => repositoryJson(repository, user)) });
  });

  app.get('/api/app/installations', (c) => {
    if (!verifyJwt(c.req.header('authorization'))) return c.json({ message: 'A JSON web token could not be decoded' }, 401);
    return c.json(state.installations.map(installationJson));
  });

  app.post('/api/app/installations/:id/access_tokens', (c) => {
    if (!verifyJwt(c.req.header('authorization'))) return c.json({ message: 'A JSON web token could not be decoded' }, 401);
    const id = Number(c.req.param('id'));
    if (!state.installations.some((installation) => installation.id === id)) return c.json({ message: 'Not Found' }, 404);
    const token = `ghs_${++state.issued}`;
    state.installationTokens.set(token, id);
    return c.json({ token, expires_at: new Date(Date.now() + 3_600_000).toISOString() }, 201);
  });

  app.get('/api/installation/repositories', (c) => {
    const installation = state.installations.find((one) => one.id === installationOf(c.req.header('authorization')));
    if (!installation) return c.json({ message: 'Bad credentials' }, 401);
    return c.json({
      total_count: installation.repositories.length,
      repositories: installation.repositories.map((repository) => repositoryJson(repository)),
    });
  });

  app.get('/api/repos/:owner/:repo', (c) => {
    if (installationOf(c.req.header('authorization')) === undefined) return c.json({ message: 'Bad credentials' }, 401);
    const repository = allRepositories().find((one) => one.full_name === `${c.req.param('owner')}/${c.req.param('repo')}`);
    if (!repository) return c.json({ message: 'Not Found' }, 404);
    return c.json({ ...repositoryJson(repository), ...(repository.parent ? { parent: { id: repository.parent } } : {}) });
  });

  app.get('/api/repos/:owner/:repo/collaborators', (c) => {
    if (installationOf(c.req.header('authorization')) === undefined) return c.json({ message: 'Bad credentials' }, 401);
    const repository = allRepositories().find((one) => one.full_name === `${c.req.param('owner')}/${c.req.param('repo')}`);
    if (!repository) return c.json({ message: 'Not Found' }, 404);
    const etag = `"${createHash('sha256').update(JSON.stringify(repository.writers)).digest('hex').slice(0, 16)}"`;
    if (c.req.header('if-none-match') === etag) return c.body(null, 304);
    c.header('etag', etag);
    return c.json(repository.writers.map((id) => ({ id, login: state.users.get(id)?.login ?? `user${id}`, permissions: { push: true } })));
  });

  return {
    web,
    api: `${api}`,
    state,
    pem,
    /** Answers the fake's URLs from memory; `api` maps onto the `/api` prefix of the one Hono app. */
    fetch: ((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : input.toString());
      const local = url.origin === api ? `http://fake/api${url.pathname}${url.search}` : `http://fake${url.pathname}${url.search}`;
      return Promise.resolve(app.request(local, init));
    }) as typeof fetch,
    /** The browser's side of the manifest flow: GitHub registers the App and sends back a code. */
    registerManifest(manifest: unknown): string {
      const code = `manifest-${++state.issued}`;
      state.manifestCodes.set(code, manifest);
      return code;
    },
    /** The browser's side of OAuth: the person consents as `user`, and GitHub sends back a code bound to the challenge. */
    authorize(user: number, challenge: string): string {
      const code = `oauth-${++state.issued}`;
      state.oauthCodes.set(code, { user, challenge });
      return code;
    },
    addUser(user: FakeUser): void {
      state.users.set(user.id, user);
    },
  };
}

export type FakeGitHub = ReturnType<typeof fakeGitHub>;
