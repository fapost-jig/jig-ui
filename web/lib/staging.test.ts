import { describe, expect, it } from 'vitest';
import type { Attention, Project } from '../api';
import { bellOf, countOf, landedLine, listed, named, promotedLine, requestedLine, reviewersLine } from './staging';

const item = (kind: string, more: Partial<Attention> = {}): Attention => ({
  kind,
  subject: { type: 'project', id: null },
  tasks: [],
  title: kind,
  detail: null,
  todo: 'x',
  url: null,
  versions: null,
  ...more,
});
const own = { commits: 2, list: [{ sha: 'a'.repeat(40), subject: 'Fix the label', date: '2026-11-18T17:04:55+02:00' }] };
const ready = (attention: Attention[], stagingFlow = true, jigVersion = '0.46.0'): Project => ({
  id: 'shop',
  state: 'ready',
  jigVersion,
  counts: { active: 0, paused: 0, ready: 0 },
  attention,
  housekeepingStale: false,
  origin: null,
  stagingFlow,
  closable: [],
  shipping: [],
  agentGit: null,
  revision: 1,
  upgrade: null,
});

describe('bellOf', () => {
  it("lights the bell with the person's own work on staging", () => {
    expect(bellOf(ready([item('gate-waiting'), item('staging-unowned', { staging: own })]))).toEqual({ lit: own });
  });

  it('keeps it dark on the staging flow with none, and shows none off it or on a project not read', () => {
    expect(bellOf(ready([item('gate-waiting')]))).toBe('dark');
    expect(bellOf(ready([], false))).toBeUndefined();
    expect(bellOf({ id: 'shop', state: 'unreadable', code: 'timeout', upgrade: null })).toBeUndefined();
  });

  it('shows no bell below Jig 0.46.0, and leaves its item, which lists no commits, to the list', () => {
    const old = item('staging-unowned');
    expect(bellOf(ready([old], true, '0.45.0'))).toBeUndefined();
    expect(bellOf(ready([], true, '0.45.2'))).toBeUndefined();
    expect(listed([old])).toEqual([old]);
  });
});

describe('listed', () => {
  it("drops only the item the bell says, keeping Jig's order", () => {
    const [a, b] = [item('gate-waiting'), item('base-behind-origin')];
    expect(listed([a, item('staging-unowned', { staging: own }), b])).toEqual([a, b]);
  });
});

describe('countOf', () => {
  it('says the exact count, and that the list is only the newest when Jig cut it', () => {
    expect(countOf({ ...own, commits: 1 })).toBe('1 commit of yours');
    expect(countOf({ ...own, list: [...own.list, ...own.list] })).toBe('2 commits of yours');
    expect(countOf({ commits: 34, list: Array.from({ length: 20 }, () => own.list[0]!) })).toBe('The newest 20 of 34 commits of yours');
  });
});

describe('what a staging write came to', () => {
  it('names one, two or more logins as a sentence does', () => {
    expect([named(['alice']), named(['alice', 'bob']), named(['alice', 'bob', 'carol'])]).toEqual([
      'alice',
      'alice and bob',
      'alice, bob and carol',
    ]);
  });

  it('says a landing, one without review and one Jig found done', () => {
    const landed = { outcome: 'landed' as const, pullRequest: null, withoutReview: null };
    expect(landedLine('a', landed)).toBe('Landed a on staging.');
    expect(landedLine('a', { ...landed, withoutReview: 'person' })).toBe(
      'Landed a on staging without review; Jig said so on its pull request.',
    );
    // The project asks no approval: an ordinary landing.
    expect(landedLine('a', { ...landed, withoutReview: 'git.staging_review is none' })).toBe('Landed a on staging.');
    expect(landedLine('a', { ...landed, outcome: 'already-landed' })).toBe('a was on staging already.');
  });

  it('says who merges a promotion, and a task whose work is in the base already', () => {
    const promoted = (outcome: string | null, reason: string | null = null) =>
      promotedLine('a', {
        pullRequest: 'https://github.com/o/r/pull/9',
        inBase: false,
        merge: outcome === null ? null : { outcome: outcome as 'person', reason },
      });
    const said = 'Prepared a for prod: its pull request into the main branch';
    expect(promoted('person')).toBe(`${said} is yours to merge.`);
    expect(promoted('auto-merge-on')).toBe(`${said} merges itself once its checks pass.`);
    expect(promoted('auto-merge-already-on')).toBe(`${said} merges itself once its checks pass.`);
    expect(promoted('merged')).toBe(`${said} was merged at once.`);
    expect(promoted('not-switched-on', 'the repository allows no auto-merge')).toBe(
      `${said} is yours to merge: auto-merge was not switched on (the repository allows no auto-merge).`,
    );
    expect(promotedLine('a', { pullRequest: null, inBase: true, merge: null })).toBe(
      "a's work is in the main branch already: nothing to promote.",
    );
  });

  it('says whom a review was asked of, and when the card shows it', () => {
    expect(requestedLine('a', ['alice', 'bob'])).toBe(
      'Asked alice and bob to review a. Its card shows their review after the next housekeeping run.',
    );
  });

  it('says what the review request shows instead of people: asking, nobody, or why Jig could not ask', () => {
    expect(reviewersLine(undefined)).toBe('Asking the forge who reviews…');
    expect(reviewersLine({ state: 'ready', source: 'history', candidates: [] })).toBe('Nobody on the forge to ask.');
    expect(reviewersLine({ state: 'ready', source: 'history', candidates: [{ login: 'alice', name: null, reviews: 1 }] })).toBeUndefined();
    expect(
      reviewersLine({ state: 'refused', code: 'forge-unavailable', reasons: ['the forge could not be asked: gh is not signed in'] }),
    ).toBe('The forge could not be asked: gh is not signed in');
    expect(reviewersLine({ id: 'shop', state: 'unreadable', code: 'timeout' })).toBe('Jig could not ask the forge (timeout).');
  });
});
