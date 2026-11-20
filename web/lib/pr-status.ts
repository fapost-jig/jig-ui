import type { Attention, Merged, Project, PrStatus, TaskPullRequest } from '../api';
import { ago } from './ago';
import { named } from './staging';
import type { Tone } from './tones';

/** Where a pull request stands on the forge, once Jig could ask it. */
export type ReadStatus = Extract<PrStatus, { state: 'ready' }>;
type Check = ReadStatus['checks']['list'][number];

/** The panel's line until there is a status to show: the forge being asked, or why Jig could not ask it; `undefined` once read. */
export function statusLine(read: PrStatus | undefined, task: string): string | undefined {
  if (read === undefined) return 'Asking the forge where it stands…';
  if (read.state === 'ready') return undefined;
  if (read.state === 'refused' && read.code === 'not-found') return `${task} does not offer this any more: look at it again as it is now.`;
  if (read.state === 'refused' && read.reasons.length > 0) {
    const said = read.reasons.join(' ');
    return said.charAt(0).toUpperCase() + said.slice(1);
  }
  return `Jig could not ask the forge (${'code' in read ? read.code : read.state}).`;
}

/** How long something ran, as a person reads it: "40 s", "7 min", "1 h 5 min". */
export function lasted(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return `${Math.floor(minutes / 60)} h${rest ? ` ${rest} min` : ''}`;
}

/** A check as the status panel lists it: what came of it and how long it ran, or how long it runs; loud when it failed. */
export function checkLine(check: Check): {
  text: string;
  tone: Tone;
} {
  const time = check.durationS === null ? '' : ` ${lasted(check.durationS)}`;
  if (check.state === 'fail') return { text: `failed${time ? ` after${time}` : ''}`, tone: 'bad' };
  if (check.state === 'cancel') return { text: 'cancelled', tone: 'bad' };
  if (check.state === 'pending') return { text: time ? `running for${time}` : 'waiting to run', tone: 'quiet' };
  if (check.state === 'skipped') return { text: 'skipped', tone: 'quiet' };
  return { text: `passed${time ? ` in${time}` : ''}`, tone: 'good' };
}

/** What the review of a pull request waits for, as the forge says it now. */
export function reviewLine(review: ReadStatus['review']): string {
  if (review.state === 'approved') return 'Approved.';
  if (review.state === 'changes') return 'Changes were requested.';
  if (review.state === 'waiting')
    return review.waitingFor.length > 0 ? `Waits for review from ${named(review.waitingFor)}.` : 'Waits for review.';
  if (review.state === 'none') return 'Nobody has reviewed it.';
  return 'The forge did not say where the review stands.';
}

/** What the base branch's rules ask of a pull request; `undefined` when the forge would not say. */
export function rulesLine(protection: ReadStatus['protection'], base: string): string | undefined {
  const approvals = protection.requiredApprovals;
  const checks = protection.requiredChecks;
  const asks = [
    ...(approvals ? [`${approvals} approval${approvals === 1 ? '' : 's'}`] : []),
    ...(checks && checks.length > 0 ? [`the check${checks.length === 1 ? '' : 's'} ${checks.join(', ')}`] : []),
  ];
  if (approvals === null && checks === null) return undefined;
  return asks.length > 0 ? `${base} asks for ${asks.join(' and ')}.` : `${base} asks for no approval or check.`;
}

/** Each of Jig's words for what holds a merge back, as a sentence part; a word this Jig UI does not know as it is. */
const BLOCKER: Record<string, string> = {
  draft: 'it is a draft',
  conflict: 'it conflicts with its base',
  'mergeable-unknown': 'the forge has not worked out yet whether it merges',
  'ci-red': 'a check failed',
  'ci-pending': 'checks are still running',
  'ci-none': 'no check has run',
  'not-approved': 'the review is not approved',
};

/** What holds the merge back now, in one line, and how loud: nothing holds back an open pull request ready to merge. */
export function blockersLine(status: ReadStatus): {
  text: string;
  tone: Tone;
} {
  const pr = status.pullRequest;
  if (pr.state === 'merged') return { text: 'It is merged.', tone: 'good' };
  if (pr.state === 'closed') return { text: 'It was closed without a merge.', tone: 'quiet' };
  if (status.blockers.length === 0) return { text: 'Nothing holds it back: it can be merged.', tone: 'good' };
  const parts = status.blockers.map((b) => BLOCKER[b] ?? b);
  return { text: `Held back: ${parts.join('; ')}.`, tone: 'attention' };
}

/** The forge cache's word on a task's pull request, as an item about it says it: CI, whether it merges, the review. */
export function cachedLine(pr: TaskPullRequest, now = Date.now()): string {
  const ci = { green: 'CI green', red: 'CI red', pending: 'CI running', none: 'no CI' }[pr.ci ?? ''];
  const merges = { mergeable: 'merges cleanly', conflicting: 'conflicts with its base' }[pr.mergeable ?? ''];
  const review = pr.review && cachedReview(pr.review);
  const said = [...(pr.state !== 'open' ? [pr.state] : []), ci, merges, review].filter(Boolean).join(', ');
  const when = pr.fetchedAt ? `as of ${ago(pr.fetchedAt, now)}` : '';
  const line = [said, when].filter(Boolean).join(' — ');
  return line ? `${line.charAt(0).toUpperCase()}${line.slice(1)}.` : 'The forge cache says nothing more about it.';
}

/**
 * What an item about a task's pull request says of it in words, the forge cache's word as `cachedLine` says it — one
 * that was open on the last housekeeping run says so —; `undefined` for any other item, and for one the cache has no
 * entry for, which says Jig's own lines.
 */
export function itemLine(item: Attention, now = Date.now()): string | undefined {
  const pr = item.taskPullRequest;
  if (!pr) return undefined;
  return item.kind === 'pull-request-was-open' ? `Open on the last housekeeping run. ${cachedLine(pr, now)}` : cachedLine(pr, now);
}

function cachedReview(review: NonNullable<TaskPullRequest['review']>): string {
  if (review.state === 'approved') return 'approved';
  if (review.state === 'changes') return 'changes requested';
  if (review.state === 'waiting')
    return review.waitingFor.length > 0 ? `waits for review from ${named(review.waitingFor)}` : 'waits for review';
  return 'no review yet';
}

/**
 * Who merges a task's pull request, as an item about it says it off the staging flow: the agent, whose ship waits for CI
 * and merges it itself; nobody, when the person's agent merges its own (`agent.git: merge`) but no ship of the task waits;
 * else the person. `undefined` where the item is not about a task's pull request, or the project is on the staging flow.
 */
export function whoMerges(project: Project, item: Attention): string | undefined {
  const task = item.subject.id;
  if (project.state !== 'ready' || project.stagingFlow || item.taskPullRequest === undefined || task === null) return undefined;
  if (project.shipping.includes(task)) return 'The agent waits for CI and merges it itself.';
  if (project.agentGit === 'merge') return "The agent's ship stopped before the merge: nobody is watching it.";
  return 'The merge is yours.';
}

/** The line above the board once Jig merged a task's pull request: whether the task closed with it, and why not. */
export function mergedLine(task: string, merged: Merged): string {
  const said = merged.outcome === 'already-merged' ? `${task}'s pull request was merged already` : `Merged ${task}'s pull request`;
  if (merged.closed) return `${said} and closed the task.`;
  if (merged.closeBlocked === 'knowledge-not-recorded') return `${said}; the close waits for its knowledge decision.`;
  if (merged.closeBlocked === 'not-in-base') return `${said}; the close waits until its work reaches the base.`;
  return `${said}.`;
}
