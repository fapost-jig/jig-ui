import { describe, expect, it } from 'vitest';
import type { Attention, Project } from '../api';
import {
  blockersLine,
  cachedLine,
  checkLine,
  lasted,
  itemLine,
  mergedLine,
  type ReadStatus,
  reviewLine,
  rulesLine,
  statusLine,
  whoMerges,
} from './pr-status';

const status = (more: Partial<ReadStatus> = {}): ReadStatus => ({
  state: 'ready',
  pullRequest: { url: 'https://github.com/o/r/pull/12', state: 'open', draft: false, base: 'main', mergeable: 'clean' },
  checks: { state: 'green', list: [] },
  review: { state: 'approved', waitingFor: [] },
  protection: { mergeState: 'clean', requiredApprovals: null, requiredChecks: null },
  blockers: [],
  ...more,
});
const check = (state: ReadStatus['checks']['list'][number]['state'], durationS: number | null) => ({
  name: 'test',
  state,
  url: null,
  startedAt: null,
  completedAt: null,
  durationS,
});

describe('the status panel', () => {
  it("says the forge is being asked, or why Jig could not ask it, in Jig's words", () => {
    expect(statusLine(undefined, 'a')).toBe('Asking the forge where it stands…');
    expect(statusLine(status(), 'a')).toBeUndefined();
    const unasked = { state: 'refused' as const, code: 'forge-unavailable', reasons: ['the forge cannot be asked: no forge configured'] };
    expect(statusLine(unasked, 'a')).toBe('The forge cannot be asked: no forge configured');
    expect(statusLine({ state: 'refused', code: 'not-found', reasons: [] }, 'a')).toBe(
      'a does not offer this any more: look at it again as it is now.',
    );
    expect(statusLine({ id: 'p', state: 'unsupported', jigVersion: '0.45.0', minimum: '0.48.0' }, 'a')).toBe(
      'Jig could not ask the forge (unsupported).',
    );
  });

  it('says how long a check ran, or runs, and what came of it', () => {
    expect([lasted(40), lasted(420), lasted(3900), lasted(7200)]).toEqual(['40 s', '7 min', '1 h 5 min', '2 h']);
    expect(checkLine(check('fail', 420))).toEqual({ text: 'failed after 7 min', tone: 'bad' });
    expect(checkLine(check('pending', 1200))).toEqual({ text: 'running for 20 min', tone: 'quiet' });
    expect(checkLine(check('pending', null))).toEqual({ text: 'waiting to run', tone: 'quiet' });
    expect(checkLine(check('pass', 90))).toEqual({ text: 'passed in 2 min', tone: 'good' });
    expect(checkLine(check('pass', null))).toEqual({ text: 'passed', tone: 'good' });
    expect(checkLine(check('cancel', 5))).toEqual({ text: 'cancelled', tone: 'bad' });
    expect(checkLine(check('skipped', null))).toEqual({ text: 'skipped', tone: 'quiet' });
  });

  it('says whom the review waits for, and what the base branch asks', () => {
    expect(reviewLine({ state: 'waiting', waitingFor: ['alice', 'bob'] })).toBe('Waits for review from alice and bob.');
    expect(reviewLine({ state: 'changes', waitingFor: [] })).toBe('Changes were requested.');
    expect(reviewLine({ state: 'unknown', waitingFor: [] })).toBe('The forge did not say where the review stands.');
    const rules = (requiredApprovals: number | null, requiredChecks: string[] | null) =>
      rulesLine({ mergeState: null, requiredApprovals, requiredChecks }, 'main');
    expect(rules(1, ['test (ubuntu)', 'test (macos)'])).toBe('main asks for 1 approval and the checks test (ubuntu), test (macos).');
    expect(rules(2, null)).toBe('main asks for 2 approvals.');
    expect(rules(0, [])).toBe('main asks for no approval or check.');
    expect(rules(null, null)).toBeUndefined();
  });

  it('says what holds the merge back, in words, and a merge nothing holds back', () => {
    expect(blockersLine(status({ blockers: ['ci-red', 'not-approved'] }))).toEqual({
      text: 'Held back: a check failed; the review is not approved.',
      tone: 'attention',
    });
    expect(blockersLine(status({ blockers: ['draft', 'conflict', 'branch-rule'] })).text).toBe(
      'Held back: it is a draft; it conflicts with its base; branch-rule.',
    );
    expect(blockersLine(status())).toEqual({ text: 'Nothing holds it back: it can be merged.', tone: 'good' });
    const merged = status({ pullRequest: { ...status().pullRequest, state: 'merged' } });
    expect(blockersLine(merged)).toEqual({ text: 'It is merged.', tone: 'good' });
  });
});

describe('an item about a task’s pull request', () => {
  const now = Date.parse('2026-11-19T17:00:00Z');
  const pr = {
    state: 'open',
    url: 'https://github.com/o/r/pull/12',
    ci: 'pending',
    mergeable: 'mergeable',
    review: { state: 'waiting' as const, waitingFor: ['alice'] },
    fetchedAt: '2026-11-19T16:55:00Z',
  };

  it("says the forge cache's word in words, and as of when", () => {
    expect(cachedLine(pr, now)).toBe('CI running, merges cleanly, waits for review from alice — as of 5 min ago.');
    expect(cachedLine({ ...pr, ci: 'red', mergeable: 'conflicting', review: { state: 'changes', waitingFor: [] } }, now)).toBe(
      'CI red, conflicts with its base, changes requested — as of 5 min ago.',
    );
    expect(cachedLine({ ...pr, state: 'merged', ci: 'green', review: null }, now)).toBe(
      'Merged, CI green, merges cleanly — as of 5 min ago.',
    );
    expect(cachedLine({ ...pr, ci: null, mergeable: null, review: null, fetchedAt: null }, now)).toBe(
      'The forge cache says nothing more about it.',
    );
  });

  const item = (id: string, more: Partial<Attention> = {}): Attention => ({
    kind: 'pull-request-waiting',
    subject: { type: 'task', id },
    tasks: [id],
    title: 'A pull request is waiting for review',
    detail: null,
    todo: 'x',
    url: null,
    versions: null,
    taskPullRequest: pr,
    offers: ['merge', 'pr-status'],
    ...more,
  });
  const project = (more: Partial<Extract<Project, { state: 'ready' }>> = {}): Project => ({
    id: 'shop',
    state: 'ready',
    jigVersion: '0.46.0',
    counts: { active: 0, paused: 0, ready: 0 },
    attention: [],
    housekeepingStale: false,
    origin: null,
    stagingFlow: false,
    closable: [],
    shipping: [],
    agentGit: 'pr',
    revision: 1,
    upgrade: null,
    ...more,
  });

  it("says an item's pull request in the cache's words, the last housekeeping run's as such, and Jig's lines without one", () => {
    expect(itemLine(item('a'), now)).toBe('CI running, merges cleanly, waits for review from alice — as of 5 min ago.');
    expect(itemLine(item('a', { kind: 'pull-request-was-open' }), now)).toBe(
      'Open on the last housekeeping run. CI running, merges cleanly, waits for review from alice — as of 5 min ago.',
    );
    expect(itemLine(item('a', { taskPullRequest: null }), now)).toBeUndefined();
    expect(itemLine(item('a', { kind: 'gate-waiting', taskPullRequest: undefined }), now)).toBeUndefined();
  });

  it("says who merges: the agent's ship waiting for CI, nobody after its ship stopped, or the person", () => {
    expect(whoMerges(project({ shipping: ['a'], agentGit: 'merge' }), item('a'))).toBe('The agent waits for CI and merges it itself.');
    expect(whoMerges(project({ agentGit: 'merge' }), item('a'))).toBe("The agent's ship stopped before the merge: nobody is watching it.");
    expect(whoMerges(project(), item('a'))).toBe('The merge is yours.');
    // The staging flow's landing says it on its own; an older Jig's item says what it says.
    expect(whoMerges(project({ stagingFlow: true }), item('a'))).toBeUndefined();
    const old = item('a');
    delete old.taskPullRequest;
    expect(whoMerges(project(), old)).toBeUndefined();
  });
});

describe('mergedLine', () => {
  const merged = { pullRequest: 'https://github.com/o/r/pull/12', outcome: 'merged' as const, closed: true, closeBlocked: null };

  it('says the merge, and whether the task closed with it', () => {
    expect(mergedLine('a', merged)).toBe("Merged a's pull request and closed the task.");
    expect(mergedLine('a', { ...merged, closed: false, closeBlocked: 'knowledge-not-recorded' })).toBe(
      "Merged a's pull request; the close waits for its knowledge decision.",
    );
    expect(mergedLine('a', { ...merged, closed: false, closeBlocked: 'not-in-base' })).toBe(
      "Merged a's pull request; the close waits until its work reaches the base.",
    );
    expect(mergedLine('a', { ...merged, outcome: 'already-merged' })).toBe("a's pull request was merged already and closed the task.");
  });
});
