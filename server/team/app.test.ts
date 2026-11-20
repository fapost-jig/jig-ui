import { createHmac } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createTeamApp, manifestOf } from './app.js';
import { Secrets } from './auth.js';
import { TeamStore } from './db.js';
import { fakeGitHub } from './fake-github.testing.js';
import { gitHub } from './github.js';
import { pollAll, pollInstallation } from './poll.js';

const BASE = 'https://board.test';
const cleanups: (() => void)[] = [];
afterEach(() => {
  for (const cleanup of cleanups.splice(0)) cleanup();
});

/** A team server over a fake GitHub, with one browser's cookies, and the lines it logged. */
function server() {
  const fake = fakeGitHub();
  const dir = mkdtempSync(join(tmpdir(), 'jig-ui-team-app-'));
  const store = TeamStore.open(dir);
  // Windows refuses to remove a folder whose database is still open.
  cleanups.push(() => {
    store.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const secrets = new Secrets();
  const github = gitHub({ web: fake.web, api: fake.api }, fake.fetch);
  const lines: string[] = [];
  const log = (line: string) => lines.push(line);
  const now = () => new Date();
  const deps = { store, github, now, log };
  const app = createTeamApp({
    config: { publicUrl: new URL(BASE), dataDir: dir, host: '0.0.0.0', port: 4870, github: { web: fake.web, api: fake.api } },
    store,
    github,
    secrets,
    pollSoon: () => pollAll(deps),
    pollInstallation: (id) => pollInstallation(deps, id),
    webRoot: join(dir, 'no-page'),
    now,
    log,
  });

  /** A browser: it keeps the cookies the server sets and sends them back, naming the server as its origin on a write. */
  function browser() {
    const jar = new Map<string, string>();
    return {
      jar,
      async request(path: string, init: RequestInit & { json?: unknown } = {}): Promise<Response> {
        const headers = new Headers(init.headers);
        headers.set('host', 'board.test');
        if (init.method && init.method !== 'GET' && !headers.has('origin')) headers.set('origin', BASE);
        if (jar.size) headers.set('cookie', [...jar].map(([name, value]) => `${name}=${value}`).join('; '));
        if (init.json !== undefined) {
          headers.set('content-type', 'application/json');
          init.body = JSON.stringify(init.json);
        }
        const response = await app.request(`${BASE}${path}`, { ...init, headers });
        for (const cookie of response.headers.getSetCookie()) {
          const [pair] = cookie.split(';');
          const [name, value] = pair!.split('=') as [string, string];
          if (value === '' || /max-age=0/i.test(cookie)) jar.delete(name);
          else jar.set(name, value);
        }
        return response;
      },
      /** Follows GitHub's consent as `user`: the redirect to GitHub carries the challenge; GitHub sends a code back. */
      async signIn(user: number, as?: 'admin' | 'link'): Promise<Response> {
        const start = await this.request(`/auth/sign-in${as ? `?as=${as}` : ''}`);
        // A sign-in the guard refused goes back to the page, not to GitHub.
        if (start.status !== 302 || start.headers.get('location')!.startsWith('/')) return start;
        const authorize = new URL(start.headers.get('location')!);
        const code = fake.authorize(user, authorize.searchParams.get('code_challenge')!);
        return this.request(`/auth/callback?code=${code}&state=${authorize.searchParams.get('state')}`);
      },
    };
  }

  /** The setup, as the admin's browser walks it: the code, the manifest to GitHub, back, and the admin's sign-in. */
  async function setUp(admin = browser(), user = 1) {
    fake.addUser({ id: user, login: 'admin' });
    await admin.request('/api/team/setup', { method: 'POST', json: { code: secrets.setupCode } });
    const form = (await (await admin.request('/api/team/setup/manifest', { method: 'POST', json: {} })).json()) as {
      action: string;
      manifest: string;
    };
    const code = fake.registerManifest(JSON.parse(form.manifest));
    const done = await admin.request(`/setup/done?code=${code}&state=${new URL(form.action).searchParams.get('state')}`);
    expect(done.headers.get('location')).toBe('/auth/sign-in?as=admin');
    const signedIn = await admin.signIn(user, 'admin');
    expect(signedIn.headers.get('location')).toBe('/');
    return admin;
  }

  /** An installation of the App on `team`, with two repositories, approved by the admin. */
  async function teamInstalled(admin: ReturnType<typeof browser>) {
    fake.state.installations.push({
      id: 1,
      account: { id: 100, login: 'team', type: 'Organization' },
      repositories: [
        { id: 10, full_name: 'team/board', writers: [500] },
        { id: 11, full_name: 'team/secret', writers: [600] },
      ],
    });
    await pollAll(deps);
    await admin.request('/api/team/admin/installations/1', { method: 'POST', json: { decision: 'approved' } });
  }

  return { fake, store, secrets, app, browser, setUp, teamInstalled, lines, dir, deps };
}

describe('the team server’s guard', () => {
  it('refuses another Host and another Origin, and a write that names no origin', async () => {
    const { app, browser } = server();
    expect((await app.request(`${BASE}/api/team/state`, { headers: { host: 'evil.test' } })).status).toBe(403);
    const page = browser();
    expect((await page.request('/api/team/state', { headers: { origin: 'https://evil.test' } })).status).toBe(403);
    const bare = await app.request(`${BASE}/api/team/setup`, { method: 'POST', headers: { host: 'board.test' }, body: '{}' });
    expect(bare.status).toBe(403);
  });

  it('says the server is not set up until it is, everywhere but the state and the setup', async () => {
    const page = server().browser();
    expect(await (await page.request('/api/team/state')).json()).toEqual({ setUp: false, hasApp: false, signedIn: false });
    expect((await page.request('/api/team/me')).status).toBe(404);
    expect((await page.request('/api/team/projects')).status).toBe(404);
    expect((await page.request('/auth/sign-in')).headers.get('location')).toBe('/?problem=not-set-up');
  });
});

describe('the setup', () => {
  it('opens only with the code from the log', async () => {
    const { browser, secrets } = server();
    const page = browser();
    expect((await page.request('/api/team/setup/manifest', { method: 'POST', json: {} })).status).toBe(403);
    expect((await page.request('/api/team/setup', { method: 'POST', json: { code: 'guess' } })).status).toBe(403);
    expect((await page.request('/api/team/setup', { method: 'POST', json: { code: secrets.setupCode } })).status).toBe(200);
    expect(page.jar.has('__Host-jig-ui-setup')).toBe(true);
  });

  it('sends a public App with Metadata (read) only, its URLs on the public address, to the account or the organization', async () => {
    const { browser, secrets } = server();
    const page = browser();
    await page.request('/api/team/setup', { method: 'POST', json: { code: secrets.setupCode } });
    const personal = (await (await page.request('/api/team/setup/manifest', { method: 'POST', json: {} })).json()) as {
      action: string;
      manifest: string;
    };
    expect(personal.action).toMatch(/^https:\/\/github\.test\/settings\/apps\/new\?state=/);
    const manifest = JSON.parse(personal.manifest);
    expect(manifest).toMatchObject({
      public: true,
      default_permissions: { metadata: 'read' },
      redirect_url: `${BASE}/setup/done`,
      callback_urls: [`${BASE}/auth/callback`],
      hook_attributes: { url: `${BASE}/webhook/github`, active: true },
    });
    expect(Object.keys(manifest.default_permissions)).toEqual(['metadata']);
    expect(manifest.name.length).toBeLessThanOrEqual(34);
    const org = (await (await page.request('/api/team/setup/manifest', { method: 'POST', json: { organization: 'team' } })).json()) as {
      action: string;
    };
    expect(org.action).toMatch(/^https:\/\/github\.test\/organizations\/team\/settings\/apps\/new\?state=/);
  });

  it('gives a server on localhost no webhook GitHub could not reach', () => {
    expect(manifestOf(new URL('http://localhost:4870'), 'Jig UI x')).toMatchObject({ hook_attributes: { active: false } });
  });

  it('refuses GitHub’s answer that does not carry the state of this browser’s setup', async () => {
    const { browser, secrets, fake, store } = server();
    const page = browser();
    await page.request('/api/team/setup', { method: 'POST', json: { code: secrets.setupCode } });
    await page.request('/api/team/setup/manifest', { method: 'POST', json: {} });
    const done = await page.request(`/setup/done?code=${fake.registerManifest({})}&state=forged`);
    expect(done.headers.get('location')).toBe('/?problem=bad-state');
    expect(store.app()).toBeNull();
  });

  it('says GitHub did not hand the App over, and keeps none, when it refuses the manifest', async () => {
    const { browser, secrets, store, lines } = server();
    const page = browser();
    await page.request('/api/team/setup', { method: 'POST', json: { code: secrets.setupCode } });
    const form = (await (await page.request('/api/team/setup/manifest', { method: 'POST', json: {} })).json()) as { action: string };
    const done = await page.request(`/setup/done?code=never-registered&state=${new URL(form.action).searchParams.get('state')}`);
    expect(done.headers.get('location')).toBe('/?problem=no-app');
    expect(store.app()).toBeNull();
    expect(lines.filter((line) => line.startsWith('Could not register the App'))).toHaveLength(1);
  });

  it('stores the App, spends the code, closes the setup and makes its person the admin', async () => {
    const { setUp, store, secrets, browser } = server();
    const admin = await setUp();
    expect(store.app()).toMatchObject({ id: 4242, slug: 'jig-ui-test', webhookSecret: 'hook-secret' });
    expect(secrets.openSetup(secrets.setupCode)).toBeNull();
    expect((await browser().request('/api/team/setup', { method: 'POST', json: { code: secrets.setupCode } })).status).toBe(404);
    expect(await (await admin.request('/api/team/me')).json()).toEqual({ admin: true, accounts: [{ id: 1, login: 'admin' }] });
  });

  it('leads the code back to the admin’s sign-in when the first did not finish, and to nothing else', async () => {
    const { browser, secrets, fake, store } = server();
    fake.addUser({ id: 1, login: 'admin' });
    const first = browser();
    await first.request('/api/team/setup', { method: 'POST', json: { code: secrets.setupCode } });
    const form = (await (await first.request('/api/team/setup/manifest', { method: 'POST', json: {} })).json()) as { action: string };
    await first.request(`/setup/done?code=${fake.registerManifest({})}&state=${new URL(form.action).searchParams.get('state')}`);
    // The person pressed Cancel on GitHub, and the setup cookie ran out.
    expect(store.app()).not.toBeNull();
    const again = browser();
    expect(await (await again.request('/api/team/state')).json()).toEqual({ setUp: false, hasApp: true, signedIn: false });
    expect((await again.signIn(1, 'admin')).headers.get('location')).toBe('/?problem=no-setup');
    expect((await again.request('/api/team/setup', { method: 'POST', json: { code: secrets.setupCode } })).status).toBe(200);
    expect((await again.request('/api/team/setup/manifest', { method: 'POST', json: {} })).status).toBe(404);
    expect((await again.signIn(1, 'admin')).headers.get('location')).toBe('/');
    expect(await (await again.request('/api/team/me')).json()).toMatchObject({ admin: true });
    expect((await browser().request('/api/team/setup', { method: 'POST', json: { code: secrets.setupCode } })).status).toBe(404);
  });

  it('makes nobody else the admin: the admin’s sign-in needs the setup that created the App', async () => {
    const { setUp, browser, fake } = server();
    await setUp();
    fake.addUser({ id: 2, login: 'other' });
    expect((await browser().signIn(2, 'admin')).headers.get('location')).toBe('/?problem=set-up');
  });

  it('sends a step of the setup taken out of turn back to the page with its own reason', async () => {
    const { browser, secrets, fake } = server();
    // No setup in this browser: GitHub's answer came after the setup's ten minutes, or to another browser.
    expect((await browser().request('/setup/done?code=c&state=s')).headers.get('location')).toBe('/?problem=bad-state');
    const first = browser();
    await first.request('/api/team/setup', { method: 'POST', json: { code: secrets.setupCode } });
    const form = (await (await first.request('/api/team/setup/manifest', { method: 'POST', json: {} })).json()) as { action: string };
    const state = new URL(form.action).searchParams.get('state');
    await first.request(`/setup/done?code=${fake.registerManifest({})}&state=${state}`);
    expect((await first.request(`/setup/done?code=c&state=${state}`)).headers.get('location')).toBe('/?problem=app-exists');
    expect((await browser().signIn(1, 'admin')).headers.get('location')).toBe('/?problem=no-setup');
    // A second browser with the code is on GitHub while the first becomes the admin.
    const second = browser();
    await second.request('/api/team/setup', { method: 'POST', json: { code: secrets.setupCode } });
    const authorize = new URL((await second.request('/auth/sign-in?as=admin')).headers.get('location')!);
    fake.addUser({ id: 1, login: 'admin' });
    expect((await first.signIn(1, 'admin')).headers.get('location')).toBe('/');
    const code = fake.authorize(1, authorize.searchParams.get('code_challenge')!);
    expect((await second.request(`/auth/callback?code=${code}&state=${authorize.searchParams.get('state')}`)).headers.get('location')).toBe(
      '/?problem=set-up',
    );
    expect((await first.request(`/setup/done?code=c&state=${state}`)).headers.get('location')).toBe('/?problem=set-up');
    expect((await first.signIn(1, 'admin')).headers.get('location')).toBe('/?problem=set-up');
  });
});

describe('the allow-list', () => {
  it('lets nobody in through an installation the admin has not approved', async () => {
    const { setUp, fake, browser, store, deps } = server();
    await setUp();
    fake.addUser({ id: 500, login: 'me' });
    fake.state.installations.push({
      id: 9,
      account: { id: 900, login: 'stranger', type: 'User' },
      repositories: [{ id: 90, full_name: 'stranger/x', writers: [500] }],
    });
    await pollAll(deps);
    expect(store.installations()).toMatchObject([{ id: 9, state: 'pending' }]);
    const page = browser();
    expect((await page.signIn(500)).headers.get('location')).toBe('/?problem=nothing');
    expect(page.jar.has('__Host-jig-ui-team')).toBe(false);
    expect(store.personOf(500)).toBeNull();
    expect(store.repositories(9)).toEqual([]);
  });

  it('shows the admin each installation, and reads one once approved', async () => {
    const { setUp, teamInstalled, store } = server();
    const admin = await setUp();
    await teamInstalled(admin);
    const answer = (await (await admin.request('/api/team/admin/installations')).json()) as {
      installations: unknown[];
      install: string;
    };
    expect(answer.installations).toMatchObject([{ id: 1, accountLogin: 'team', state: 'approved' }]);
    expect(answer.install).toBe('https://github.test/apps/jig-ui-test/installations/new');
    expect(store.repositories(1).map((repository) => repository.fullName)).toEqual(['team/board', 'team/secret']);
  });

  it('reads the installations again when GitHub returns the admin from installing the App', async () => {
    const { setUp, fake } = server();
    const admin = await setUp();
    fake.state.installations.push({ id: 3, account: { id: 300, login: 'late', type: 'User' }, repositories: [] });
    const listed = async (query = '') =>
      ((await (await admin.request(`/api/team/admin/installations${query}`)).json()) as { installations: { id: number }[] }).installations;
    expect(await listed()).toEqual([]);
    expect(await listed('?installation=3')).toMatchObject([{ id: 3, state: 'pending' }]);
  });

  it('refuses the admin’s routes to anyone else', async () => {
    const { setUp, teamInstalled, fake, browser } = server();
    await teamInstalled(await setUp());
    fake.addUser({ id: 500, login: 'me' });
    const page = browser();
    await page.signIn(500);
    expect((await page.request('/api/team/admin/installations')).status).toBe(403);
    expect((await page.request('/api/team/admin/installations/1', { method: 'POST', json: { decision: 'refused' } })).status).toBe(403);
  });
});

describe('signing in', () => {
  it('signs in a person who may write to a repository of an approved installation, and shows only those projects', async () => {
    const { setUp, teamInstalled, fake, browser } = server();
    await teamInstalled(await setUp());
    fake.addUser({ id: 500, login: 'me' });
    const page = browser();
    expect((await page.signIn(500)).headers.get('location')).toBe('/');
    expect(await (await page.request('/api/team/projects')).json()).toEqual({
      projects: [{ id: 10, fullName: 'team/board', parent: null }],
    });
  });

  it('tells a person with nothing on the server so, and keeps nothing of them', async () => {
    const { setUp, teamInstalled, fake, browser, store } = server();
    await teamInstalled(await setUp());
    fake.addUser({ id: 700, login: 'nobody' });
    const page = browser();
    expect((await page.signIn(700)).headers.get('location')).toBe('/?problem=nothing');
    expect(store.personOf(700)).toBeNull();
  });

  it('accepts GitHub’s answer to a round once only', async () => {
    const { setUp, teamInstalled, fake, browser } = server();
    await teamInstalled(await setUp());
    fake.addUser({ id: 500, login: 'me' });
    const page = browser();
    const start = new URL((await page.request('/auth/sign-in')).headers.get('location')!);
    expect(start.searchParams.get('code_challenge_method')).toBe('S256');
    expect(start.searchParams.get('redirect_uri')).toBe(`${BASE}/auth/callback`);
    const state = start.searchParams.get('state');
    const code = fake.authorize(500, start.searchParams.get('code_challenge')!);
    expect((await page.request(`/auth/callback?code=${code}&state=${state}`)).headers.get('location')).toBe('/');
    expect((await page.request(`/auth/callback?code=${code}&state=${state}`)).headers.get('location')).toBe('/?problem=expired');
  });

  it('links another account to the person, shows the union, and refuses an account someone else holds', async () => {
    const { setUp, teamInstalled, fake, browser } = server();
    await teamInstalled(await setUp());
    fake.addUser({ id: 500, login: 'me' });
    fake.addUser({ id: 600, login: 'me-work' });
    const page = browser();
    await page.signIn(500);
    const link = await page.request('/auth/sign-in?as=link');
    expect(new URL(link.headers.get('location')!).searchParams.get('prompt')).toBe('select_account');
    expect((await page.signIn(600, 'link')).headers.get('location')).toBe('/');
    expect(((await (await page.request('/api/team/me')).json()) as { accounts: unknown[] }).accounts).toHaveLength(2);
    const projects = (await (await page.request('/api/team/projects')).json()) as { projects: { fullName: string }[] };
    expect(projects.projects.map((project) => project.fullName)).toEqual(['team/board', 'team/secret']);
    const other = browser();
    fake.addUser({ id: 800, login: 'other' });
    fake.state.installations[0]!.repositories[0]!.writers.push(800);
    await other.signIn(800);
    expect((await other.signIn(600, 'link')).headers.get('location')).toBe('/?problem=taken');
  });

  it('takes GitHub’s answer only in the browser that started the round, and links an account only to its person', async () => {
    const { setUp, teamInstalled, fake, browser, store } = server();
    await teamInstalled(await setUp());
    fake.addUser({ id: 500, login: 'me' });
    fake.addUser({ id: 600, login: 'teammate' });
    const attacker = browser();
    await attacker.signIn(500);
    // The attacker sends the teammate the authorize URL of their own link; the teammate consents.
    const link = new URL((await attacker.request('/auth/sign-in?as=link')).headers.get('location')!);
    const teammate = browser();
    const code = fake.authorize(600, link.searchParams.get('code_challenge')!);
    const answer = await teammate.request(`/auth/callback?code=${code}&state=${link.searchParams.get('state')}`);
    expect(answer.headers.get('location')).toBe('/?problem=expired');
    expect(store.personOf(600)).toBeNull();
    expect(teammate.jar.has('__Host-jig-ui-team')).toBe(false);
    // Nor does the attacker's own sign-in land in the teammate's browser.
    const round = new URL((await browser().request('/auth/sign-in')).headers.get('location')!);
    const own = fake.authorize(500, round.searchParams.get('code_challenge')!);
    expect((await teammate.request(`/auth/callback?code=${own}&state=${round.searchParams.get('state')}`)).headers.get('location')).toBe(
      '/?problem=expired',
    );
    expect(teammate.jar.has('__Host-jig-ui-team')).toBe(false);
    // A link whose session ended before GitHub answered links nothing.
    const later = new URL((await attacker.request('/auth/sign-in?as=link')).headers.get('location')!);
    await attacker.request('/api/team/sign-out', { method: 'POST' });
    const late = fake.authorize(600, later.searchParams.get('code_challenge')!);
    expect((await attacker.request(`/auth/callback?code=${late}&state=${later.searchParams.get('state')}`)).headers.get('location')).toBe(
      '/?problem=expired',
    );
    expect(store.personOf(600)).toBeNull();
  });

  it('says a sign-in cancelled on GitHub so, and one GitHub could not complete, which it logs', async () => {
    const { setUp, browser, lines } = server();
    await setUp();
    const page = browser();
    const answered = async (error: string) => {
      const state = new URL((await page.request('/auth/sign-in')).headers.get('location')!).searchParams.get('state');
      return (await page.request(`/auth/callback?error=${error}&state=${state}`)).headers.get('location');
    };
    expect(await answered('access_denied')).toBe('/?problem=cancelled');
    expect(await answered('application_suspended')).toBe('/?problem=github');
    // A line break in GitHub's error stays in its own line.
    expect(await answered('x%0Aforged')).toBe('/?problem=github');
    expect(lines.filter((line) => line.startsWith('GitHub did not complete'))).toEqual([
      'GitHub did not complete a sign-in: "application_suspended" ""',
      'GitHub did not complete a sign-in: "x\\nforged" ""',
    ]);
    // An error sent to the address without a round of this browser's is nobody's to write in the log.
    expect((await browser().request('/auth/callback?error=redirect_uri_mismatch%0Aforged')).headers.get('location')).toBe(
      '/?problem=github',
    );
    expect(lines.filter((line) => line.startsWith('GitHub did not complete'))).toHaveLength(2);
  });

  it('refuses a link, and the API, without a session', async () => {
    const { setUp, browser } = server();
    await setUp();
    expect((await browser().request('/auth/sign-in?as=link')).headers.get('location')).toBe('/?problem=unauthorized');
    expect((await browser().request('/api/team/projects')).status).toBe(401);
  });

  it('ends the session on sign-out', async () => {
    const { setUp, teamInstalled, fake, browser } = server();
    await teamInstalled(await setUp());
    fake.addUser({ id: 500, login: 'me' });
    const page = browser();
    await page.signIn(500);
    const cookie = page.jar.get('__Host-jig-ui-team')!;
    await page.request('/api/team/sign-out', { method: 'POST' });
    page.jar.set('__Host-jig-ui-team', cookie);
    expect((await page.request('/api/team/me')).status).toBe(401);
  });

  it('sets a session cookie the browser keeps for this host only, over https, out of reach of scripts', async () => {
    const { setUp, teamInstalled, fake, browser } = server();
    await teamInstalled(await setUp());
    fake.addUser({ id: 500, login: 'me' });
    const cookie = (await browser().signIn(500)).headers.getSetCookie().find((one) => one.startsWith('__Host-jig-ui-team='))!;
    expect(cookie).toMatch(/; HttpOnly/);
    expect(cookie).toMatch(/; Secure/);
    expect(cookie).toMatch(/; SameSite=Lax/);
    expect(cookie).toMatch(/; Path=\//);
    expect(cookie).not.toMatch(/Domain=/i);
  });
});

describe('webhooks', () => {
  const signed = (secret: string, body: string) => `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;

  it('refuses a body larger than a megabyte before reading its signature', async () => {
    const { setUp, app } = server();
    await setUp();
    const response = await app.request(`${BASE}/webhook/github`, {
      method: 'POST',
      headers: { host: 'board.test', 'x-github-event': 'installation' },
      body: 'x'.repeat(1024 * 1024 + 1),
    });
    expect(response.status).toBe(413);
  });

  it('refuses a webhook whose signature does not match', async () => {
    const { setUp, app } = server();
    await setUp();
    const body = JSON.stringify({ action: 'deleted', installation: { id: 1 } });
    const response = await app.request(`${BASE}/webhook/github`, {
      method: 'POST',
      headers: { host: 'board.test', 'x-github-event': 'installation', 'x-hub-signature-256': signed('wrong', body) },
      body,
    });
    expect(response.status).toBe(401);
  });

  /** Sends a webhook signed as GitHub signs it. */
  const sender =
    (app: ReturnType<typeof server>['app']) =>
    (event: string, payload: unknown): Promise<Response> => {
      const body = JSON.stringify(payload);
      return Promise.resolve(
        app.request(`${BASE}/webhook/github`, {
          method: 'POST',
          headers: { host: 'board.test', 'x-github-event': event, 'x-hub-signature-256': signed('hook-secret', body) },
          body,
        }),
      );
    };

  it('notes a new installation as waiting, hides a suspended one’s projects, and reads one back or with repositories added', async () => {
    const { setUp, teamInstalled, fake, browser, app, store } = server();
    await teamInstalled(await setUp());
    const send = sender(app);
    fake.addUser({ id: 500, login: 'me' });
    const page = browser();
    await page.signIn(500);
    const projects = async () =>
      ((await (await page.request('/api/team/projects')).json()) as { projects: { fullName: string }[] }).projects;
    await send('installation', { action: 'created', installation: { id: 2, account: { id: 200, login: 'other', type: 'User' } } });
    expect(store.installations()).toMatchObject([{ id: 2, accountLogin: 'other', state: 'pending' }, { id: 1 }]);
    await send('installation', { action: 'suspend', installation: { id: 1 } });
    expect(await projects()).toEqual([]);
    await send('installation', { action: 'unsuspend', installation: { id: 1 } });
    expect((await projects()).map((project) => project.fullName)).toEqual(['team/board']);
    fake.state.installations[0]!.repositories.push({ id: 12, full_name: 'team/new', writers: [500] });
    await send('installation_repositories', { action: 'added', installation: { id: 1 } });
    expect((await projects()).map((project) => project.fullName)).toEqual(['team/board', 'team/new']);
  });

  it('logs a read a webhook started that failed', async () => {
    const { setUp, teamInstalled, fake, app, lines } = server();
    await teamInstalled(await setUp());
    fake.state.installations.length = 0;
    expect((await sender(app)('installation_repositories', { action: 'added', installation: { id: 1 } })).status).toBe(204);
    expect(lines).toContainEqual(expect.stringMatching(/^Could not read installation 1: /));
  });

  it('hides an uninstalled installation’s projects at once, and ends the sessions of a person who revoked the App', async () => {
    const { setUp, teamInstalled, fake, browser, app, store } = server();
    await teamInstalled(await setUp());
    fake.addUser({ id: 500, login: 'me' });
    const page = browser();
    await page.signIn(500);
    const send = sender(app);
    expect(
      (await send('installation_repositories', { action: 'removed', installation: { id: 1 }, repositories_removed: [{ id: 10 }] })).status,
    ).toBe(204);
    expect(((await (await page.request('/api/team/projects')).json()) as { projects: unknown[] }).projects).toEqual([]);
    await send('installation', { action: 'deleted', installation: { id: 1 } });
    expect(store.installations()).toEqual([]);
    await send('github_app_authorization', { action: 'revoked', sender: { id: 500 } });
    expect((await page.request('/api/team/me')).status).toBe(401);
  });
});

describe('secrets', () => {
  it('keeps no person’s token and no temp_clone_token in the database, and logs no secret', async () => {
    const { setUp, teamInstalled, fake, browser, store, dir, lines } = server();
    await teamInstalled(await setUp());
    fake.addUser({ id: 500, login: 'me' });
    await browser().signIn(500);
    store.close();
    const database = readFileSync(join(dir, 'team.db')).toString('latin1');
    expect(database).not.toMatch(/ghu_|ghs_|TEMP-CLONE/);
    expect(lines.join('\n')).not.toMatch(/ghu_|ghs_|hook-secret|client-secret|PRIVATE KEY/);
  });
});
