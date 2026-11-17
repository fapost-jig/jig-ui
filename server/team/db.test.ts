import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { TeamStore } from './db.js';

const now = new Date('2026-11-16T10:00:00Z');
const later = (minutes: number): Date => new Date(now.getTime() + minutes * 60_000);

/** A store with one approved installation holding one repository. */
function withRepository(): TeamStore {
  const store = TeamStore.memory();
  store.noteInstallation({ id: 1, accountId: 100, accountLogin: 'team', accountType: 'Organization' }, now);
  store.decideInstallation(1, 'approved', now);
  store.noteRepository(1, { id: 10, fullName: 'team/board', fork: false });
  return store;
}

describe('TeamStore', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });

  it.skipIf(process.platform === 'win32')('creates team.db readable by its owner only, and opens it again', () => {
    const dir = mkdtempSync(join(tmpdir(), 'jig-ui-team-'));
    dirs.push(dir);
    const store = TeamStore.open(join(dir, 'data'));
    store.saveApp({ id: 7, slug: 'jig-ui-x', clientId: 'Iv1', clientSecret: 's', webhookSecret: null, pem: 'PEM' }, now);
    store.close();
    expect(statSync(join(dir, 'data', 'team.db')).mode & 0o777).toBe(0o600);
    expect(statSync(join(dir, 'data')).mode & 0o777).toBe(0o700);
    const again = TeamStore.open(join(dir, 'data'));
    expect(again.app()?.slug).toBe('jig-ui-x');
    again.close();
    expect(
      readFileSync(join(dir, 'data', 'team.db'))
        .subarray(0, 15)
        .toString(),
    ).toBe('SQLite format 3');
  });

  it('keeps a new installation waiting, and keeps the decision when GitHub reports it again', () => {
    const store = TeamStore.memory();
    store.noteInstallation({ id: 1, accountId: 100, accountLogin: 'team', accountType: 'Organization' }, now);
    expect(store.installations()).toEqual([{ id: 1, accountId: 100, accountLogin: 'team', accountType: 'Organization', state: 'pending' }]);
    store.decideInstallation(1, 'approved', now);
    store.noteInstallation({ id: 1, accountId: 100, accountLogin: 'team-renamed', accountType: 'Organization' }, now);
    expect(store.installations()[0]).toMatchObject({ accountLogin: 'team-renamed', state: 'approved' });
  });

  it('keeps no repository of an installation the admin has not approved', () => {
    const store = TeamStore.memory();
    store.noteInstallation({ id: 1, accountId: 100, accountLogin: 'team', accountType: 'Organization' }, now);
    store.noteRepository(1, { id: 10, fullName: 'team/board', fork: false });
    expect(store.repositories(1)).toEqual([]);
  });

  it('takes the repositories off the server when an installation is refused', () => {
    const store = withRepository();
    store.decideInstallation(1, 'refused', now);
    expect(store.repositories(1)).toEqual([]);
  });

  it('shows a person the repositories any of their accounts may write to, and only those', () => {
    const store = withRepository();
    store.noteRepository(1, { id: 11, fullName: 'team/other', fork: false });
    const person = store.createPerson({ githubId: 500, login: 'me' }, false, now);
    expect(store.linkAccount(person, { githubId: 501, login: 'me-work' }, now)).toBe(true);
    store.setWriters(10, [501, 900], '"e1"', now);
    store.setWriters(11, [900], '"e2"', now);
    expect(store.projects(person)).toEqual([{ id: 10, fullName: 'team/board', parent: null }]);
    store.setWriters(10, [900], '"e3"', later(5));
    expect(store.projects(person)).toEqual([]);
  });

  it('refuses to link an account that belongs to someone else', () => {
    const store = TeamStore.memory();
    const one = store.createPerson({ githubId: 500, login: 'one' }, false, now);
    const two = store.createPerson({ githubId: 600, login: 'two' }, false, now);
    expect(store.linkAccount(two, { githubId: 500, login: 'one' }, now)).toBe(false);
    expect(store.person(one)?.accounts).toEqual([{ githubId: 500, login: 'one' }]);
    expect(store.person(two)?.accounts).toEqual([{ githubId: 600, login: 'two' }]);
  });

  it('replaces an installation’s repositories with what GitHub listed', () => {
    const store = withRepository();
    store.replaceRepositories(1, [{ id: 11, fullName: 'team/new', fork: true }]);
    expect(store.repositories(1)).toEqual([{ id: 11, fullName: 'team/new', fork: true, parentId: null, writersEtag: null }]);
  });

  it('drops the ETag when sign-in adds a writer, so the next poll reads the list whole', () => {
    const store = withRepository();
    store.setWriters(10, [900], '"e1"', now);
    store.addWriter(10, 500);
    expect(store.repositories(1)[0]?.writersEtag).toBeNull();
  });

  it('ends an expired session, and every session of a person who revoked the App', () => {
    const store = TeamStore.memory();
    const person = store.createPerson({ githubId: 500, login: 'me' }, false, now);
    store.createSession('a', person, now, later(10));
    store.createSession('b', person, now, later(60));
    expect(store.sessionPerson('a', later(11))).toBeNull();
    expect(store.sessionPerson('b', later(11))).toBe(person);
    store.endSessionsOf(500);
    expect(store.sessionPerson('b', later(11))).toBeNull();
  });

  it('removes an installation with its repositories and who writes to them', () => {
    const store = withRepository();
    const person = store.createPerson({ githubId: 500, login: 'me' }, false, now);
    store.setWriters(10, [500], null, now);
    store.removeInstallation(1);
    expect(store.installations()).toEqual([]);
    expect(store.projects(person)).toEqual([]);
  });
});
