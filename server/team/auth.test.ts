import { describe, expect, it } from 'vitest';
import { Secrets, sessions } from './auth.js';
import { TeamStore } from './db.js';

describe('Secrets', () => {
  it('makes a setup code of 128 random bits, new for every process', () => {
    const one = new Secrets();
    expect(one.setupCode).toMatch(/^[0-9a-f]{8}(-[0-9a-f]{8}){3}$/);
    expect(new Secrets().setupCode).not.toBe(one.setupCode);
  });

  it('opens a setup only with the code, and never once the admin signed in', () => {
    const secrets = new Secrets();
    expect(secrets.openSetup('wrong')).toBeNull();
    const setup = secrets.openSetup(` ${secrets.setupCode} `);
    expect(setup).toBeTruthy();
    secrets.takeAdmin(setup!);
    expect(secrets.openSetup(secrets.setupCode)).toBeNull();
  });

  it('ends a setup after ten minutes', () => {
    let now = 0;
    const secrets = new Secrets(() => now);
    const setup = secrets.openSetup(secrets.setupCode)!;
    expect(secrets.hasSetup(setup)).toBe(true);
    now = 10 * 60_000;
    expect(secrets.hasSetup(setup)).toBe(false);
  });

  it('takes the manifest state back once, and only to the setup that sent it', () => {
    const secrets = new Secrets();
    const setup = secrets.openSetup(secrets.setupCode)!;
    const state = secrets.manifestState(setup)!;
    expect(secrets.takeManifestState('another', state)).toBe(false);
    expect(secrets.takeManifestState(setup, 'forged')).toBe(false);
    expect(secrets.takeManifestState(setup, state)).toBe(true);
    expect(secrets.takeManifestState(setup, state)).toBe(false);
  });

  it('makes the admin through a setup the code opened, once', () => {
    const secrets = new Secrets();
    expect(secrets.takeAdmin('another')).toBe(false);
    const setup = secrets.openSetup(secrets.setupCode)!;
    expect(secrets.takeAdmin(setup)).toBe(true);
    expect(secrets.takeAdmin(setup)).toBe(false);
  });

  it('gives an OAuth round back once, while it is fresh, to the browser that started it', () => {
    let now = 0;
    const secrets = new Secrets(() => now);
    const { state } = secrets.startRound({ kind: 'sign-in' });
    expect(secrets.takeRound(state, undefined)).toBeNull();
    expect(secrets.takeRound(state, 'another')).toBeNull();
    expect(secrets.takeRound(state, state)).toMatchObject({ purpose: { kind: 'sign-in' } });
    expect(secrets.takeRound(state, state)).toBeNull();
    const late = secrets.startRound({ kind: 'sign-in' });
    now = 10 * 60_000;
    expect(secrets.takeRound(late.state, late.state)).toBeNull();
  });
});

describe('OAuth rounds under a flood', () => {
  it('forgets expired rounds and keeps at most a thousand open, the oldest going first', () => {
    let now = 0;
    const secrets = new Secrets(() => now);
    const first = secrets.startRound({ kind: 'sign-in' });
    for (let i = 0; i < 1500; i++) secrets.startRound({ kind: 'sign-in' });
    expect(secrets.openRounds).toBe(1000);
    expect(secrets.takeRound(first.state, first.state)).toBeNull();
    now = 10 * 60_000;
    secrets.startRound({ kind: 'sign-in' });
    expect(secrets.openRounds).toBe(1);
  });
});

describe('sessions', () => {
  it('keeps only the hash of a session id', () => {
    const store = TeamStore.memory();
    const now = new Date('2026-11-16T10:00:00Z');
    const person = store.createPerson({ githubId: 500, login: 'me' }, false, now);
    const { id } = sessions.open(store, person, now);
    expect(sessions.person(store, id, now)).toBe(person);
    expect(store.sessionPerson(id, now)).toBeNull();
    sessions.end(store, id);
    expect(sessions.person(store, id, now)).toBeNull();
  });
});
