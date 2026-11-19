import type { Attention, Landed, Project, Promoted, Reviewers } from '@/api';
import { older } from './upgrade';

/** The person's own commits on staging the base does not have, as Jig 0.46.0's `staging-unowned` item lists them. */
export type OwnStaging = NonNullable<Attention['staging']>;

/** The first Jig whose `staging-unowned` item lists the person's own commits; before it, it counted everyone's. */
const OWN_STAGING_JIG_VERSION = '0.46.0';

/** Mark as known on a card: under way, or what Jig refused, with its reasons, until dismissed. */
export type AckState =
  | { state: 'running' }
  | {
      state: 'refused';
      message: string;
      reasons: string[];
    };

/**
 * The bell beside a project's name: lit with the person's own work on staging, dark on the staging flow while there is
 * none, and none off it or below Jig 0.46.0, whose item lists no commits — it counted everyone's — and stays in the
 * card's list as Jig says it.
 */
export function bellOf(project: Project): { lit: OwnStaging } | 'dark' | undefined {
  if (project.state !== 'ready') return undefined;
  const staging = project.attention.find((a) => a.kind === 'staging-unowned')?.staging;
  if (staging) return { lit: staging };
  return project.stagingFlow && !older(project.jigVersion, OWN_STAGING_JIG_VERSION) ? 'dark' : undefined;
}

/** What needs the person on a card, as Jig ordered it, without the item its bell says. */
export function listed(attention: Attention[]): Attention[] {
  return attention.filter((a) => !(a.kind === 'staging-unowned' && a.staging));
}

/** How many commits the list shows: all of them, or Jig's newest 20 of the exact count. */
export function countOf(staging: OwnStaging): string {
  const n = staging.commits;
  if (staging.list.length < n) return `The newest ${staging.list.length} of ${n} commits of yours`;
  return `${n} commit${n === 1 ? '' : 's'} of yours`;
}

/**
 * A step a card's menu takes on the staging flow, up to the view: land it, prepare it for prod (once asked on the card),
 * open the review request — the view reads whom the forge offers —, close it, or ask the logins ticked.
 */
export type StagingStep =
  | 'land'
  | 'promote'
  | 'review'
  | 'unreview'
  | {
      ask: string[];
    };

/** What a staging write is called while it runs, as a refusal says it: "Jig refused landing a". */
export const STAGING_DOING = { land: 'landing', promote: 'preparing for prod', review: 'asking review for' } as const;

/** Logins as a sentence names them: "alice", "alice and bob", "alice, bob and carol". */
export const named = (logins: string[]): string =>
  logins.length < 2 ? (logins[0] ?? '') : `${logins.slice(0, -1).join(', ')} and ${logins.at(-1)}`;

/** The line above the board once Jig landed a task on staging. */
export function landedLine(task: string, landed: Landed): string {
  if (landed.outcome === 'already-landed') return `${task} was on staging already.`;
  if (landed.withoutReview === 'person') return `Landed ${task} on staging without review; Jig said so on its pull request.`;
  return `Landed ${task} on staging.`;
}

/** The line above the board once Jig prepared a task for prod: its pull request into the main branch, and who merges it. */
export function promotedLine(task: string, promoted: Promoted): string {
  if (promoted.inBase) return `${task}'s work is in the main branch already: nothing to promote.`;
  const said = `Prepared ${task} for prod: its pull request into the main branch`;
  const merge = promoted.merge;
  if (merge?.outcome === 'person') return `${said} is yours to merge.`;
  if (merge?.outcome === 'auto-merge-on' || merge?.outcome === 'auto-merge-already-on')
    return `${said} merges itself once its checks pass.`;
  if (merge?.outcome === 'merged') return `${said} was merged at once.`;
  if (merge?.outcome === 'not-switched-on') {
    return `${said} is yours to merge: auto-merge was not switched on${merge.reason ? ` (${merge.reason})` : ''}.`;
  }
  return `${said} is open.`;
}

/** The line above the board once the forge was asked for reviews. */
export const requestedLine = (task: string, logins: string[]): string =>
  `Asked ${named(logins)} to review ${task}. Its card shows their review after the next housekeeping run.`;

/**
 * What the review request says instead of the people to tick: still asking, nobody to ask, or why Jig could not ask —
 * in Jig's words, which begin "the forge could not be asked: …".
 */
export function reviewersLine(read: Reviewers | undefined): string | undefined {
  if (read === undefined) return 'Asking the forge who reviews…';
  if (read.state === 'ready') return read.candidates.length === 0 ? 'Nobody on the forge to ask.' : undefined;
  if (read.state === 'refused' && read.reasons.length > 0) {
    const said = read.reasons.join(' ');
    return said.charAt(0).toUpperCase() + said.slice(1);
  }
  return `Jig could not ask the forge (${'code' in read ? read.code : read.state}).`;
}
