import { describe, expect, it } from 'vitest';
import type { Task } from '../api';
import { pullRequests, requested, waits } from './waits';

const task = (more: Partial<Task> = {}): Task => ({
  id: 't',
  class: 'T2',
  status: 'active',
  goal: null,
  paused: false,
  pauseRequest: null,
  pauseRequestable: true,
  pausable: false,
  resumable: false,
  closable: false,
  staging: null,
  parked: null,
  stagingFlow: false,
  promotion: null,
  resumesTo: null,
  started: true,
  gate: null,
  autopilot: null,
  pullRequest: null,
  priority: null,
  queue: null,
  ...more,
});

const pr = (state: string | null, ci: string | null, url = 'https://github.com/o/r/pull/7') => ({ url, state, ci, fetchedAt: null });
const promotion = (state: string, ci: string, url: string | null = 'https://github.com/o/r/pull/9') => ({
  url,
  state,
  ci,
  fetchedAt: null,
});
const parked = (
  reason: 'review' | 'signal',
  hint: 'landing' | null = null,
  state?: 'approved' | 'changes' | 'waiting' | 'none',
  waitingFor: string[] = [],
) => ({ reason, hint, review: state ? { state, waitingFor } : null });

describe('waits', () => {
  it.each([
    ['nothing to say', {}, undefined],
    ['a design waiting at its gate', { gate: 'waiting' }, { text: 'Design waits at its gate', tone: 'attention' }],
    ['a design changed after approval', { gate: 'changed' }, { text: 'Design changed after approval', tone: 'attention' }],
    ['a stopped autopilot run', { autopilot: 'stopped' }, { text: 'Autopilot stopped with a question', tone: 'attention' }],
    ['the gate before the autopilot', { gate: 'waiting', autopilot: 'stopped' }, { text: 'Design waits at its gate', tone: 'attention' }],
    [
      'a stopped run on a paused task',
      { paused: true, autopilot: 'stopped' },
      { text: 'Autopilot stopped with a question', tone: 'attention' },
    ],
    [
      'a paused task with a pull request',
      { paused: true, pullRequest: pr('open', 'green') },
      { text: 'Paused — jig task resume t', tone: 'quiet' },
    ],
    [
      'a paused task the page resumes',
      { paused: true, resumable: true, resumesTo: 'in-progress' as const },
      { text: 'Paused', tone: 'quiet' },
    ],
    [
      'a pull request with CI green',
      { pullRequest: pr('open', 'green') },
      { text: 'Pull request open, CI green', tone: 'good', url: 'https://github.com/o/r/pull/7' },
    ],
    [
      'a pull request with CI red',
      { pullRequest: pr('open', 'red') },
      { text: 'Pull request open, CI red', tone: 'bad', url: 'https://github.com/o/r/pull/7' },
    ],
    [
      'a pull request with CI pending',
      { pullRequest: pr('open', 'pending') },
      { text: 'Pull request open, CI pending', tone: 'quiet', url: 'https://github.com/o/r/pull/7' },
    ],
    [
      'a merged pull request without CI',
      { pullRequest: pr('merged', 'none') },
      { text: 'Pull request merged', tone: 'good', url: 'https://github.com/o/r/pull/7' },
    ],
    [
      'a pull request Jig has not looked at yet',
      { pullRequest: pr(null, null) },
      { text: 'Pull request opened', tone: 'quiet', url: 'https://github.com/o/r/pull/7' },
    ],
    [
      'a pull request whose url is not a web address',
      { pullRequest: pr('open', 'green', 'file:///etc') },
      { text: 'Pull request open, CI green', tone: 'good', url: undefined },
    ],
    [
      'the gate before the pull request',
      { gate: 'changed', pullRequest: pr('open', 'red') },
      { text: 'Design changed after approval', tone: 'attention' },
    ],
    ['a ready task without a pull request', { status: 'ready' as const }, { text: 'No pull request yet', tone: 'quiet' }],
    // On Jig's staging flow the pull request is the one into staging: merged, the task is still not in the base.
    [
      'a pull request into staging whose review Jig cannot say yet',
      { status: 'ready' as const, parked: parked('review'), pullRequest: pr('open', 'green') },
      { text: 'Pull request into staging waits for review', tone: 'quiet', url: 'https://github.com/o/r/pull/7' },
    ],
    [
      'a pull request into staging the person lands, its review not known',
      { status: 'ready' as const, parked: parked('review', 'landing'), pullRequest: pr('open', 'green') },
      { text: 'Pull request into staging — yours to land', tone: 'attention', url: 'https://github.com/o/r/pull/7' },
    ],
    [
      'an approved pull request into staging the person lands',
      { status: 'ready' as const, parked: parked('review', 'landing', 'approved'), pullRequest: pr('open', 'green') },
      { text: 'Approved — yours to land', tone: 'attention', url: 'https://github.com/o/r/pull/7' },
    ],
    [
      'a review waiting for the people named',
      { status: 'ready' as const, parked: parked('review', null, 'waiting', ['alice', 'bob']), pullRequest: pr('open', 'green') },
      { text: 'Waits for review from alice, bob', tone: 'quiet', url: 'https://github.com/o/r/pull/7' },
    ],
    [
      'a review waiting with nobody named',
      { status: 'ready' as const, parked: parked('review', null, 'waiting') },
      { text: 'Waits for review', tone: 'quiet' },
    ],
    [
      'changes requested',
      { status: 'ready' as const, parked: parked('review', null, 'changes'), pullRequest: pr('open', 'red') },
      { text: 'Changes requested', tone: 'attention', url: 'https://github.com/o/r/pull/7' },
    ],
    [
      'an approved review the agent lands',
      { status: 'ready' as const, parked: parked('review', null, 'approved') },
      { text: 'Approved', tone: 'good' },
    ],
    [
      'no review requested yet',
      { status: 'ready' as const, parked: parked('review', null, 'none') },
      { text: 'No review requested yet', tone: 'quiet' },
    ],
    [
      'work on staging waiting for prepare for prod',
      { status: 'ready' as const, staging: 'on' as const, parked: parked('signal'), pullRequest: pr('merged', 'none') },
      { text: 'On staging, waits for prepare for prod', tone: 'quiet' },
    ],
    [
      'a fix not on staging yet',
      { staging: 'behind' as const, pullRequest: pr('merged', 'none') },
      { text: 'Fix not on staging yet', tone: 'quiet' },
    ],
    // Jig 0.46.0: the pull request into staging merged says nothing of the promotion.
    [
      'work on staging, not parked, with no promotion',
      { status: 'ready' as const, staging: 'on' as const, pullRequest: pr('merged', 'green') },
      { text: 'On staging', tone: 'quiet' },
    ],
    [
      'a promotion with CI red, and its link',
      { status: 'ready' as const, staging: 'on' as const, pullRequest: pr('merged', 'green'), promotion: promotion('open', 'red') },
      { text: 'Promotion open, CI red', tone: 'bad', url: 'https://github.com/o/r/pull/9' },
    ],
    [
      'a merged promotion',
      { status: 'ready' as const, staging: 'on' as const, promotion: promotion('merged', 'none') },
      { text: 'Promotion merged', tone: 'good', url: 'https://github.com/o/r/pull/9' },
    ],
    // `jig task promote` records the link at once; the state comes with the next housekeeping run.
    [
      'a promotion just opened, its state not heard yet',
      {
        status: 'ready' as const,
        staging: 'on' as const,
        promotion: { url: 'https://github.com/o/r/pull/9', state: null, ci: null, fetchedAt: null },
      },
      { text: 'Promotion opened', tone: 'quiet', url: 'https://github.com/o/r/pull/9' },
    ],
    [
      'a promotion on Jig 0.45.0, which has no link to it',
      { status: 'ready' as const, staging: 'on' as const, promotion: promotion('open', 'green', null) },
      { text: 'Promotion open, CI green', tone: 'good' },
    ],
    ['a paused task parked at staging', { paused: true, resumable: true, parked: parked('signal') }, { text: 'Paused', tone: 'quiet' }],
    ['a running autopilot', { autopilot: 'on' }, { text: 'On autopilot', tone: 'quiet' }],
  ])('%s', (_, more, expected) => {
    expect(waits(task(more))).toEqual(expected);
  });
});

describe('pullRequests', () => {
  it('shows one pull request off the staging flow, and none without one', () => {
    expect(pullRequests(task({ pullRequest: pr('open', 'green') }))).toEqual([
      { title: 'Pull request', text: 'open, CI green', url: 'https://github.com/o/r/pull/7', fetchedAt: null },
    ]);
    expect(pullRequests(task({ pullRequest: pr(null, 'none') }))).toEqual([
      { title: 'Pull request', text: 'state not known yet', url: 'https://github.com/o/r/pull/7', fetchedAt: null },
    ]);
    expect(pullRequests(task())).toEqual([]);
  });

  it('shows when Jig’s housekeeping heard each pull request, the promotion its own time', () => {
    const into = { ...pr('merged', 'green'), fetchedAt: '2026-11-17T10:00:00Z' };
    const out = { ...promotion('open', 'red'), fetchedAt: '2026-11-17T12:00:00Z' };
    expect(pullRequests(task({ staging: 'on', pullRequest: into, promotion: out })).map((p) => [p.title, p.fetchedAt])).toEqual([
      ['Pull request into staging', '2026-11-17T10:00:00Z'],
      ['Promotion', '2026-11-17T12:00:00Z'],
    ]);
  });

  it('shows the pull request into staging apart from the promotion, each with its state and link', () => {
    const into = { title: 'Pull request into staging', text: 'merged, CI green', url: 'https://github.com/o/r/pull/7', fetchedAt: null };
    expect(pullRequests(task({ staging: 'on', pullRequest: pr('merged', 'green'), promotion: promotion('open', 'red') }))).toEqual([
      into,
      { title: 'Promotion', text: 'open, CI red', url: 'https://github.com/o/r/pull/9', fetchedAt: null },
    ]);
    expect(pullRequests(task({ staging: 'on', parked: parked('signal'), pullRequest: pr('merged', 'green') }))).toEqual([into]);
    expect(pullRequests(task({ parked: parked('review'), pullRequest: pr('open', 'green') }))).toEqual([
      { title: 'Pull request into staging', text: 'open, CI green', url: 'https://github.com/o/r/pull/7', fetchedAt: null },
    ]);
    // Jig 0.45.0, read into 0.46.0's shape: the pull request into staging has no state, the promotion no link.
    expect(pullRequests(task({ staging: 'on', pullRequest: pr(null, null), promotion: promotion('open', 'green', null) }))).toEqual([
      { title: 'Pull request into staging', text: null, url: 'https://github.com/o/r/pull/7', fetchedAt: null },
      { title: 'Promotion', text: 'open, CI green', url: null, fetchedAt: null },
    ]);
    expect(
      pullRequests(task({ staging: 'on', promotion: { url: 'https://github.com/o/r/pull/9', state: null, ci: null, fetchedAt: null } })),
    ).toEqual([{ title: 'Promotion', text: 'state not known yet', url: 'https://github.com/o/r/pull/9', fetchedAt: null }]);
    expect(pullRequests(task({ staging: 'on', promotion: promotion('open', 'green') }))).toEqual([
      { title: 'Promotion', text: 'open, CI green', url: 'https://github.com/o/r/pull/9', fetchedAt: null },
    ]);
  });
});

describe('requested', () => {
  const now = Date.parse('2026-10-22T12:00:00Z');
  it('says nothing without a pause asked', () => {
    expect(requested(task(), now)).toBeUndefined();
  });
  it('says how long ago a pause was asked, whatever else the card says', () => {
    const asked = { pauseRequest: { requestedAt: '2026-10-22T11:48:00Z' } };
    expect(requested(task({ ...asked, gate: 'waiting' }), now)).toBe('Pause requested 12 min ago');
    expect(requested(task({ ...asked, gate: 'waiting' }), now + 60 * 60_000)).toBe('Pause requested 1 h ago');
  });
});
