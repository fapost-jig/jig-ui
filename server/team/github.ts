import { createHash, randomBytes, sign } from 'node:crypto';
import { z } from 'zod';

/** Why GitHub refused: the token or key is not accepted, the thing is gone, the rate limit is spent, or anything else. */
export type GitHubFailure = 'unauthorized' | 'not-found' | 'rate-limited' | 'failed';

/** A refusal or failure of GitHub's, carrying the request's path and status only: never a token or a body. */
export class GitHubError extends Error {
  constructor(
    readonly code: GitHubFailure,
    message: string,
  ) {
    super(message);
    this.name = 'GitHubError';
  }
}

export interface GitHubUrls {
  web: string;
  api: string;
}

/** An account an App is installed on; an enterprise has a slug and no type where the others have a login and a type. */
export const accountSchema = z
  .object({ id: z.number(), login: z.string().optional(), slug: z.string().optional(), type: z.string().optional() })
  .transform((account) => ({
    id: account.id,
    login: account.login ?? account.slug ?? String(account.id),
    type: account.type ?? (account.login === undefined && account.slug !== undefined ? 'Enterprise' : 'User'),
  }));

// Each schema names only the fields the server reads: z.object drops the rest, so a credential GitHub adds to an
// answer — `temp_clone_token` on a repository — never gets past this module.
const conversionSchema = z
  .object({
    id: z.number(),
    slug: z.string(),
    client_id: z.string(),
    client_secret: z.string(),
    webhook_secret: z.string().nullable(),
    pem: z.string(),
  })
  .transform((app) => ({
    id: app.id,
    slug: app.slug,
    clientId: app.client_id,
    clientSecret: app.client_secret,
    webhookSecret: app.webhook_secret,
    pem: app.pem,
  }));
const userSchema = z.object({ id: z.number(), login: z.string() });
const installationSchema = z
  .object({ id: z.number(), account: accountSchema.nullable(), suspended_at: z.string().nullable().optional() })
  .transform((installation) => ({ id: installation.id, account: installation.account, suspended: Boolean(installation.suspended_at) }));
const repositorySchema = z
  .object({
    id: z.number(),
    full_name: z.string(),
    fork: z.boolean(),
    permissions: z.object({ push: z.boolean() }).optional(),
  })
  .transform((repository) => ({
    id: repository.id,
    fullName: repository.full_name,
    fork: repository.fork,
    push: repository.permissions?.push ?? false,
  }));
const forkSchema = z.object({ id: z.number(), parent: z.object({ id: z.number() }).optional() });
const collaboratorSchema = z.object({ id: z.number() });
const tokenSchema = z.object({ token: z.string(), expires_at: z.string() });
const oauthSchema = z.union([
  z.object({ access_token: z.string() }).transform((answer) => ({ token: answer.access_token })),
  z.object({ error: z.string() }).transform((answer) => ({ error: answer.error })),
]);

export type Installation = z.output<typeof installationSchema>;
export type Repository = z.output<typeof repositorySchema>;
export type AppCredentials = z.output<typeof conversionSchema>;

const base64url = (value: Buffer | string): string => Buffer.from(value).toString('base64url');

/** A JSON Web Token the App signs with its private key, which GitHub takes for up to ten minutes. */
export function appJwt(appId: number, pem: string, now: Date): string {
  const seconds = Math.floor(now.getTime() / 1000);
  // Sixty seconds back against a clock running ahead of GitHub's; nine minutes on, under GitHub's ten.
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(JSON.stringify({ iat: seconds - 60, exp: seconds + 540, iss: String(appId) }));
  const signature = sign('sha256', Buffer.from(`${header}.${payload}`), pem);
  return `${header}.${payload}.${base64url(signature)}`;
}

/** A PKCE pair: the verifier the server keeps for the callback, the challenge GitHub is given. */
export function pkce(): {
  verifier: string;
  challenge: string;
} {
  const verifier = base64url(randomBytes(32));
  return { verifier, challenge: base64url(createHash('sha256').update(verifier).digest()) };
}

/** The `next` page GitHub's `Link` header names, if any. */
function nextPage(link: string | null): string | null {
  return (
    link
      ?.split(',')
      .find((part) => part.includes('rel="next"'))
      ?.match(/<([^>]+)>/)?.[1] ?? null
  );
}

function failure(path: string, response: Response): GitHubError {
  const status = response.status;
  if (status === 401) return new GitHubError('unauthorized', `GitHub refused ${path}: 401`);
  if (status === 404) return new GitHubError('not-found', `GitHub has no ${path}: 404`);
  if (
    status === 429 ||
    (status === 403 && (response.headers.get('x-ratelimit-remaining') === '0' || response.headers.has('retry-after')))
  ) {
    return new GitHubError('rate-limited', `GitHub's rate limit is spent: ${path}`);
  }
  return new GitHubError('failed', `GitHub answered ${path} with ${status}`);
}

/** What exchanging an OAuth code takes: the App's client, the code, the PKCE verifier and the callback it was sent to. */
export interface UserTokenInput {
  clientId: string;
  clientSecret: string;
  code: string;
  verifier: string;
  redirectUri: string;
}

export interface GitHub {
  /** Exchanges the manifest flow's code for the App it registered; GitHub takes it within an hour. */
  convertManifest(code: string): Promise<AppCredentials>;
  /** Exchanges an OAuth code, with its PKCE verifier, for a user access token: kept only while the sign-in runs. */
  userToken(input: UserTokenInput): Promise<string>;
  user(token: string): Promise<z.output<typeof userSchema>>;
  /** The App's installations the person can reach. */
  userInstallations(token: string): Promise<Installation[]>;
  /** The installation's repositories the person has explicit access to, with whether they may push. */
  userRepositories(token: string, installationId: number): Promise<Repository[]>;
  /** Every installation of the App, by its JWT. */
  appInstallations(jwt: string): Promise<Installation[]>;
  /** An installation token, cached until a minute before it expires. */
  installationToken(jwt: () => string, installationId: number): Promise<string>;
  installationRepositories(token: string): Promise<Repository[]>;
  /** A fork's parent repository, by id. */
  parentOf(token: string, fullName: string): Promise<number | null>;
  /**
   * Who may push to the repository. With the ETag of the last answer, an unchanged list comes back as `unchanged`,
   * which costs no rate limit. A list longer than one page carries no ETag: a change on a later page leaves the first
   * page's tag as it was.
   */
  writers(
    token: string,
    fullName: string,
    etag: string | null,
  ): Promise<
    | { unchanged: true }
    | {
        unchanged: false;
        ids: number[];
        etag: string | null;
      }
  >;
}

/** The forge as the team server asks it, over `fetch`; each answer checked by its schema. */
export function gitHub(urls: GitHubUrls, request: typeof fetch = fetch): GitHub {
  const tokens = new Map<
    number,
    {
      token: string;
      until: number;
    }
  >();

  async function call(
    url: string,
    init: RequestInit & { auth?: string } = {},
  ): Promise<{
    response: Response;
    path: string;
  }> {
    // The manifest code is a credential for an hour: never part of a message.
    const path = new URL(url).pathname.replace(/^\/app-manifests\/[^/]+/, '/app-manifests/…');
    const headers = new Headers(init.headers);
    headers.set('accept', headers.get('accept') ?? 'application/vnd.github+json');
    headers.set('x-github-api-version', '2022-11-28');
    headers.set('user-agent', 'jig-ui-team-server');
    if (init.auth) headers.set('authorization', `Bearer ${init.auth}`);
    let response: Response;
    try {
      response = await request(url, { ...init, headers });
    } catch (error) {
      throw new GitHubError('failed', `GitHub could not be reached for ${path}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return { response, path };
  }

  async function json<T extends z.ZodType>(schema: T, url: string, init: RequestInit & { auth?: string } = {}): Promise<z.output<T>> {
    const { response, path } = await call(url, init);
    if (!response.ok) throw failure(path, response);
    const parsed = schema.safeParse(await response.json().catch(() => undefined));
    if (!parsed.success) throw new GitHubError('failed', `GitHub's answer to ${path} has an unexpected shape`);
    return parsed.data;
  }

  /** Every page of a list, following `Link: rel="next"`; `pick` takes the items out of a page's body. */
  async function pages<T extends z.ZodType>(item: T, url: string, auth: string, pick: (body: unknown) => unknown): Promise<z.output<T>[]> {
    const items: z.output<T>[] = [];
    for (let next: string | null = url; next;) {
      const { response, path } = await call(next, { auth });
      if (!response.ok) throw failure(path, response);
      const parsed = z.array(item).safeParse(pick(await response.json().catch(() => undefined)));
      if (!parsed.success) throw new GitHubError('failed', `GitHub's answer to ${path} has an unexpected shape`);
      items.push(...parsed.data);
      next = nextPage(response.headers.get('link'));
    }
    return items;
  }

  const field =
    (name: string) =>
    (body: unknown): unknown =>
      body !== null && typeof body === 'object' && name in body ? (body as Record<string, unknown>)[name] : undefined;
  const itself = (body: unknown): unknown => body;

  return {
    convertManifest: (code) =>
      json(conversionSchema, `${urls.api}/app-manifests/${encodeURIComponent(code)}/conversions`, { method: 'POST' }),

    async userToken({ clientId, clientSecret, code, verifier, redirectUri }) {
      const answer = await json(oauthSchema, `${urls.web}/login/oauth/access_token`, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          code_verifier: verifier,
          redirect_uri: redirectUri,
        }),
      });
      if ('error' in answer) throw new GitHubError('unauthorized', `GitHub refused the sign-in: ${answer.error}`);
      return answer.token;
    },

    user: (token) => json(userSchema, `${urls.api}/user`, { auth: token }),

    userInstallations: (token) => pages(installationSchema, `${urls.api}/user/installations?per_page=100`, token, field('installations')),

    userRepositories: (token, installationId) =>
      pages(repositorySchema, `${urls.api}/user/installations/${installationId}/repositories?per_page=100`, token, field('repositories')),

    appInstallations: (jwt) => pages(installationSchema, `${urls.api}/app/installations?per_page=100`, jwt, itself),

    async installationToken(jwt, installationId) {
      const cached = tokens.get(installationId);
      if (cached && cached.until > Date.now()) return cached.token;
      const answer = await json(tokenSchema, `${urls.api}/app/installations/${installationId}/access_tokens`, {
        method: 'POST',
        auth: jwt(),
      });
      tokens.set(installationId, { token: answer.token, until: new Date(answer.expires_at).getTime() - 60_000 });
      return answer.token;
    },

    installationRepositories: (token) =>
      pages(repositorySchema, `${urls.api}/installation/repositories?per_page=100`, token, field('repositories')),

    async parentOf(token, fullName) {
      const repository = await json(forkSchema, `${urls.api}/repos/${fullName}`, { auth: token });
      return repository.parent?.id ?? null;
    },

    async writers(token, fullName, etag) {
      const url = `${urls.api}/repos/${fullName}/collaborators?permission=push&per_page=100`;
      const { response, path } = await call(url, { auth: token, headers: etag ? { 'if-none-match': etag } : {} });
      if (response.status === 304) return { unchanged: true };
      if (!response.ok) throw failure(path, response);
      const first = z.array(collaboratorSchema).safeParse(await response.json().catch(() => undefined));
      if (!first.success) throw new GitHubError('failed', `GitHub's answer to ${path} has an unexpected shape`);
      const next = nextPage(response.headers.get('link'));
      const rest = next ? await pages(collaboratorSchema, next, token, itself) : [];
      const ids = [...first.data, ...rest].map((collaborator) => collaborator.id);
      return { unchanged: false, ids, etag: next ? null : response.headers.get('etag') };
    },
  };
}
