import { link, type Task } from '../api';
import { ago } from './ago';
import type { Tone } from './tones';

/**
 * What a card says about where its task waits — the gate, the autopilot run, a pause, where it stands on Jig's
 * staging flow, the pull request — how loud, and the pull request's link when the note is about it. The first rule
 * that fits wins.
 */
export function waits(task: Omit<Task, 'resumesTo'>):
  | {
      text: string;
      tone: Tone;
      url?: string;
    }
  | undefined {
  if (task.gate === 'waiting') return { text: 'Design waits at its gate', tone: 'attention' };
  if (task.gate === 'changed') return { text: 'Design changed after approval', tone: 'attention' };
  if (task.autopilot === 'stopped') return { text: 'Autopilot stopped with a question', tone: 'attention' };
  // Below Jig 0.35.0 `jig task resume` takes no revision to write against (fapost-lab/jig#295): the page names the command.
  if (task.paused) return { text: task.resumable ? 'Paused' : `Paused — jig task resume ${task.id}`, tone: 'quiet' };
  const pr = task.pullRequest;
  // On Jig's staging flow the pull request is the one into staging: merged, the work is still not in the base.
  if (task.parked?.reason === 'review') return { ...inReview(task.parked), url: link(pr?.url ?? null) };
  if (task.parked?.reason === 'signal') return { text: 'On staging, waits for prepare for prod', tone: 'quiet' };
  if (task.staging === 'behind') return { text: 'Fix not on staging yet', tone: 'quiet' };
  // `jig task promote` records the promotion's link; its state waits for the next housekeeping run.
  const promotion = task.promotion;
  if (promotion?.state || promotion?.url) {
    return { text: `Promotion ${promotion.state ?? 'opened'}${ci(promotion)}`, tone: tone(promotion), url: link(promotion.url) };
  }
  if (task.staging === 'on') return { text: 'On staging', tone: 'quiet' };
  if (pr) return { text: `Pull request ${pr.state ?? 'opened'}${ci(pr)}`, tone: tone(pr), url: link(pr.url) };
  if (task.status === 'ready') return { text: 'No pull request yet', tone: 'quiet' };
  return task.autopilot === 'on' ? { text: 'On autopilot', tone: 'quiet' } : undefined;
}

type Pull = {
  state: string | null;
  ci: string | null;
};

/** Jig's CI is green, red, pending or none (its housekeeping); `none` is not said. */
const ci = (p: Pull): string => (p.ci && p.ci !== 'none' ? `, CI ${p.ci}` : '');

/** A merge is good whatever CI said. */
const tone = (p: Pull): Tone => (p.ci === 'red' ? 'bad' : p.ci === 'green' || p.state === 'merged' ? 'good' : 'quiet');

/**
 * What a card in Review says: the review of its pull request into staging as Jig last heard it from the forge
 * (Jig 0.46.0), loud when it is the person's move — theirs to land, or changes asked of their agent — and, where Jig
 * cannot say, that it waits for one.
 */
function inReview(parked: NonNullable<Task['parked']>): {
  text: string;
  tone: Tone;
} {
  const review = parked.review;
  if (parked.hint === 'landing') {
    return {
      text: review?.state === 'approved' ? 'Approved — yours to land' : 'Pull request into staging — yours to land',
      tone: 'attention',
    };
  }
  if (review?.state === 'waiting') {
    return {
      text: review.waitingFor.length > 0 ? `Waits for review from ${review.waitingFor.join(', ')}` : 'Waits for review',
      tone: 'quiet',
    };
  }
  if (review?.state === 'changes') return { text: 'Changes requested', tone: 'attention' };
  if (review?.state === 'approved') return { text: 'Approved', tone: 'good' };
  if (review?.state === 'none') return { text: 'No review requested yet', tone: 'quiet' };
  return { text: 'Pull request into staging waits for review', tone: 'quiet' };
}

/**
 * A task's pull request as its details show it. On Jig's staging flow, once the task waits at the staging branch or its
 * work went there, the pull request into staging and the promotion into the base are shown apart, each with its own
 * state, CI and link; a project on Jig 0.45.0 has no link to the promotion and no state of the one into staging.
 * Elsewhere, one pull request.
 */
export function pullRequests(task: Pick<Task, 'pullRequest' | 'staging' | 'parked' | 'promotion'>): {
  title: string;
  text: string | null;
  url: string | null;
}[] {
  const pr = task.pullRequest;
  const promotion = task.promotion;
  const said = (p: Pull) => `${p.state ?? 'state not known yet'}${ci(p)}`;
  if (task.staging === null && task.parked === null && !promotion)
    return pr ? [{ title: 'Pull request', text: said(pr), url: pr.url }] : [];
  return [
    ...(pr ? [{ title: 'Pull request into staging', text: pr.state ? said(pr) : null, url: pr.url }] : []),
    ...(promotion?.state || promotion?.url ? [{ title: 'Promotion', text: said(promotion), url: promotion.url }] : []),
  ];
}

/** What a card says of a pause asked of its task, with how long ago; shown beside any note `waits` gives. */
export function requested(task: Task, now = Date.now()): string | undefined {
  return task.pauseRequest ? `Pause requested ${ago(task.pauseRequest.requestedAt, now)}` : undefined;
}
