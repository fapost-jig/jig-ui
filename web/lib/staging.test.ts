import { describe, expect, it } from 'vitest';
import type { Attention, Project } from '../api';
import { bellOf, countOf, listed } from './staging';

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
