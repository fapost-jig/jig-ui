import { describe, expect, it } from 'vitest';
import { fakeGitHub } from './fake-github.testing.js';
import { appJwt, GitHubError, gitHub, pkce } from './github.js';

function setUp() {
  const fake = fakeGitHub();
  fake.addUser({ id: 500, login: 'me' });
  fake.state.installations.push({
    id: 1,
    account: { id: 100, login: 'team', type: 'Organization' },
    repositories: [
      { id: 10, full_name: 'team/board', writers: [500] },
      { id: 11, full_name: 'team/fork', fork: true, parent: 10, writers: [] },
    ],
  });
  const client = gitHub({ web: fake.web, api: fake.api }, fake.fetch);
  const jwt = () => appJwt(fake.state.app.id, fake.pem, new Date());
  return { fake, client, jwt };
}

describe('gitHub', () => {
  it('exchanges the manifest code for the App, its secrets included, and nothing GitHub adds', async () => {
    const { fake, client } = setUp();
    const app = await client.convertManifest(fake.registerManifest({}));
    expect(app).toEqual({
      id: 4242,
      slug: 'jig-ui-test',
      clientId: 'Iv1.test',
      clientSecret: 'client-secret',
      webhookSecret: 'hook-secret',
      pem: fake.pem,
    });
  });

  it('names no manifest code when GitHub refuses one', async () => {
    const { client } = setUp();
    const error = await client.convertManifest('manifest-secret-code').catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: 'not-found' });
    expect((error as Error).message).not.toContain('manifest-secret-code');
  });

  it('signs a JWT GitHub accepts for the App', async () => {
    const { client, jwt } = setUp();
    expect((await client.appInstallations(jwt())).map((installation) => installation.id)).toEqual([1]);
  });

  it('takes a user token only with the verifier of the challenge the person was sent with', async () => {
    const { fake, client } = setUp();
    const { verifier, challenge } = pkce();
    const input = { clientId: 'Iv1.test', clientSecret: 'client-secret', verifier, redirectUri: 'https://board/auth/callback' };
    const token = await client.userToken({ ...input, code: fake.authorize(500, challenge) });
    expect(await client.user(token)).toEqual({ id: 500, login: 'me' });
    await expect(client.userToken({ ...input, code: fake.authorize(500, pkce().challenge) })).rejects.toMatchObject({
      code: 'unauthorized',
    });
  });

  it('lists the installations and repositories a person reaches, with whether they may push', async () => {
    const { fake, client } = setUp();
    const { verifier, challenge } = pkce();
    const token = await client.userToken({
      clientId: 'Iv1.test',
      clientSecret: 'client-secret',
      code: fake.authorize(500, challenge),
      verifier,
      redirectUri: 'x',
    });
    expect(await client.userInstallations(token)).toEqual([
      { id: 1, account: { id: 100, login: 'team', type: 'Organization' }, suspended: false },
    ]);
    expect(await client.userRepositories(token, 1)).toEqual([{ id: 10, fullName: 'team/board', fork: false, push: true }]);
  });

  it('keeps no temp_clone_token from any repository it reads', async () => {
    const { client, jwt } = setUp();
    const token = await client.installationToken(jwt, 1);
    const repositories = await client.installationRepositories(token);
    expect(JSON.stringify(repositories)).not.toContain('TEMP-CLONE');
    expect(await client.parentOf(token, 'team/fork')).toBe(10);
  });

  it('caches an installation token until it is about to expire', async () => {
    const { fake, client, jwt } = setUp();
    const first = await client.installationToken(jwt, 1);
    expect(await client.installationToken(jwt, 1)).toBe(first);
    expect(fake.state.requests.filter((request) => request.endsWith('/access_tokens'))).toHaveLength(1);
  });

  it('answers unchanged writers by their ETag, and reads them again when they change', async () => {
    const { fake, client, jwt } = setUp();
    const token = await client.installationToken(jwt, 1);
    const first = await client.writers(token, 'team/board', null);
    expect(first).toMatchObject({ unchanged: false, ids: [500] });
    const etag = first.unchanged ? null : first.etag;
    expect(etag).toBeTruthy();
    expect(await client.writers(token, 'team/board', etag)).toEqual({ unchanged: true });
    fake.state.installations[0]!.repositories[0]!.writers = [];
    expect(await client.writers(token, 'team/board', etag)).toMatchObject({ unchanged: false, ids: [] });
  });

  it('says why GitHub refused, naming the path and never the token', async () => {
    const { client } = setUp();
    const error = await client.user('ghu_not-a-token').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(GitHubError);
    expect(error).toMatchObject({ code: 'unauthorized' });
    expect(String((error as Error).message)).not.toContain('ghu_not-a-token');
  });

  it('tells a spent rate limit from other refusals', async () => {
    const limited = gitHub({ web: 'https://w', api: 'https://a' }, (() =>
      Promise.resolve(new Response('{}', { status: 403, headers: { 'x-ratelimit-remaining': '0' } }))) as typeof fetch);
    await expect(limited.user('t')).rejects.toMatchObject({ code: 'rate-limited' });
    const down = gitHub({ web: 'https://w', api: 'https://a' }, (() => Promise.reject(new Error('ECONNREFUSED'))) as typeof fetch);
    await expect(down.user('t')).rejects.toMatchObject({ code: 'failed' });
  });

  it('follows the pages of a long list', async () => {
    const pages = [
      new Response(JSON.stringify([{ id: 1 }]), { headers: { link: '<https://a/next>; rel="next"', etag: '"p1"' } }),
      new Response(JSON.stringify([{ id: 2 }])),
    ];
    const paged = gitHub({ web: 'https://w', api: 'https://a' }, (() => Promise.resolve(pages.shift()!)) as typeof fetch);
    // A list of several pages carries no ETag: the first page's would not change with a later page.
    expect(await paged.writers('t', 'o/r', null)).toEqual({ unchanged: false, ids: [1, 2], etag: null });
  });
});
