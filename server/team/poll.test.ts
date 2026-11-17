import { describe, expect, it } from 'vitest';
import { TeamStore } from './db.js';
import { fakeGitHub } from './fake-github.testing.js';
import { gitHub } from './github.js';
import { pollAll, poller } from './poll.js';

// The fake checks the App's JWT against its own clock: a fixed time here would expire with the real one.
const now = () => new Date();

function setUp() {
  const fake = fakeGitHub();
  const store = TeamStore.memory();
  const { app } = fake.state;
  store.saveApp(
    {
      id: app.id,
      slug: app.slug,
      clientId: app.client_id,
      clientSecret: app.client_secret,
      webhookSecret: app.webhook_secret,
      pem: app.pem,
    },
    now(),
  );
  fake.state.installations.push({
    id: 1,
    account: { id: 100, login: 'team', type: 'Organization' },
    repositories: [
      { id: 10, full_name: 'team/board', writers: [500] },
      { id: 11, full_name: 'me/board', fork: true, parent: 10, writers: [500, 600] },
    ],
  });
  const lines: string[] = [];
  const deps = { store, github: gitHub({ web: fake.web, api: fake.api }, fake.fetch), now, log: (line: string) => lines.push(line) };
  const person = store.createPerson({ githubId: 500, login: 'me' }, false, now());
  return { fake, store, deps, lines, person };
}

describe('pollAll', () => {
  it('records a new installation as waiting and reads none of its repositories', async () => {
    const { fake, store, deps } = setUp();
    await pollAll(deps);
    expect(store.installations()).toMatchObject([{ id: 1, accountLogin: 'team', state: 'pending' }]);
    expect(store.repositories(1)).toEqual([]);
    expect(fake.state.requests.some((request) => request.includes('/installation/repositories'))).toBe(false);
  });

  it('reads an approved installation: its repositories, a fork’s parent, and who writes to each', async () => {
    const { store, deps, person } = setUp();
    await pollAll(deps);
    store.decideInstallation(1, 'approved', now());
    await pollAll(deps);
    expect(store.projects(person)).toEqual([
      { id: 11, fullName: 'me/board', parent: { id: 10, fullName: 'team/board' } },
      { id: 10, fullName: 'team/board', parent: null },
    ]);
  });

  it('takes a project away within one poll of a person losing write access', async () => {
    const { fake, store, deps, person } = setUp();
    await pollAll(deps);
    store.decideInstallation(1, 'approved', now());
    await pollAll(deps);
    fake.state.installations[0]!.repositories[0]!.writers = [];
    await pollAll(deps);
    expect(store.projects(person).map((project) => project.id)).toEqual([11]);
  });

  it('asks for unchanged writers with their ETag, and GitHub answers 304', async () => {
    const { store, deps } = setUp();
    await pollAll(deps);
    store.decideInstallation(1, 'approved', now());
    await pollAll(deps);
    const etags = store.repositories(1).map((repository) => repository.writersEtag);
    await pollAll(deps);
    expect(store.repositories(1).map((repository) => repository.writersEtag)).toEqual(etags);
    expect(etags.every(Boolean)).toBe(true);
  });

  it('drops an installation GitHub no longer has, and hides a suspended one’s repositories', async () => {
    const { fake, store, deps, person } = setUp();
    await pollAll(deps);
    store.decideInstallation(1, 'approved', now());
    await pollAll(deps);
    fake.state.installations[0]!.suspended = true;
    await pollAll(deps);
    expect(store.projects(person)).toEqual([]);
    expect(store.installations()[0]?.state).toBe('approved');
    fake.state.installations.length = 0;
    await pollAll(deps);
    expect(store.installations()).toEqual([]);
  });

  it('keeps no temp_clone_token anywhere in the database', async () => {
    const { store, deps } = setUp();
    await pollAll(deps);
    store.decideInstallation(1, 'approved', now());
    await pollAll(deps);
    expect(JSON.stringify(store.repositories(1))).not.toContain('TEMP-CLONE');
  });
});

describe('pollInstallation', () => {
  it('reads the other repositories when one fails, and logs the one', async () => {
    const { store, deps, person, lines } = setUp();
    await pollAll(deps);
    store.decideInstallation(1, 'approved', now());
    let calls = 0;
    const writers = deps.github.writers;
    const flaky = {
      ...deps,
      github: {
        ...deps.github,
        writers: (...args: Parameters<typeof writers>) => (++calls === 1 ? Promise.reject(new Error('boom')) : writers(...args)),
      },
    };
    await pollAll(flaky);
    expect(store.projects(person)).toHaveLength(1);
    expect(lines).toEqual([expect.stringMatching(/^Could not read .*boom/)]);
  });

  it('takes an installation on an enterprise, which has a slug and no login', async () => {
    const { fake, store, deps } = setUp();
    fake.state.installations.push({ id: 2, account: { id: 200, slug: 'acme', name: 'Acme' }, repositories: [] });
    await pollAll(deps);
    expect(store.installations()).toMatchObject([
      { id: 2, accountLogin: 'acme', accountType: 'Enterprise' },
      { id: 1, accountLogin: 'team' },
    ]);
  });
});

describe('poller', () => {
  it('runs one pass at a time, and one more when asked during a pass', async () => {
    const { fake, deps } = setUp();
    const polling = poller(deps, 60_000);
    await Promise.all([polling.soon(), polling.soon(), polling.soon()]);
    await polling.soon();
    polling.stop();
    expect(fake.state.requests.filter((request) => request === 'GET /api/app/installations').length).toBeLessThanOrEqual(3);
  });

  it('logs a failure without a token, and goes on', async () => {
    const { deps, lines } = setUp();
    const broken = { ...deps, github: { ...deps.github, appInstallations: () => Promise.reject(new Error('boom')) } };
    await poller(broken, 60_000).soon();
    expect(lines).toEqual([expect.stringContaining('boom')]);
  });
});
