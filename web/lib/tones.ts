import type { Lane } from './specs';

/** How loud a fact about a task is: it waits for the person, it went well, it went wrong, or neither. */
export type Tone = 'attention' | 'good' | 'bad' | 'quiet';

/** The colours that carry a meaning; nothing else on the page picks a colour of its own. */
export const toneText: Record<Tone, string> = {
  attention: 'text-amber-700 dark:text-amber-300',
  good: 'text-emerald-700 dark:text-emerald-300',
  bad: 'text-destructive',
  quiet: 'text-muted-foreground',
};

/** A tone as a rule on the left of its text, the way a card and an attention item show it. */
export const toneRule: Record<Tone, string> = {
  attention: 'border-l-2 border-amber-500 pl-2 text-amber-700 dark:text-amber-300',
  good: 'border-l-2 border-emerald-500 pl-2 text-emerald-700 dark:text-emerald-300',
  bad: 'border-l-2 border-destructive pl-2 text-destructive',
  quiet: 'border-l-2 border-border pl-2 text-muted-foreground',
};

/** A task's id on its card, so the eye finds the task: an accent that means nothing more. */
export const idAccent = 'text-indigo-600 dark:text-indigo-300';

/** A spec's epic on a task's card: the task goes into the spec's epic branch. */
export const epicAccent = 'bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300';

/** A task's priority mark by how urgent it is: P0–P1 red, P2 orange, lower quiet; never green or amber, which mean done and needs you. */
export function priorityAccent(priority: number): string {
  if (priority <= 1) return 'bg-red-500/15 text-red-700 dark:text-red-300';
  if (priority === 2) return 'bg-orange-500/15 text-orange-700 dark:text-orange-300';
  return 'bg-slate-500/15 text-slate-700 dark:text-slate-300';
}

/** A task's class mark: T3 and T4, which stop at a human gate, stand out; the rest are quiet. */
export function classAccent(cls: string): string {
  return /^T[34]$/.test(cls)
    ? 'bg-violet-500/15 text-violet-700 dark:text-violet-300'
    : 'bg-slate-500/15 text-slate-700 dark:text-slate-300';
}

/** Attention as a filled mark, the count on a project's tab. */
export const attentionFill = 'bg-amber-500 text-black';

/** Wrong as a filled mark, the `!` on the tab of a project that cannot be read. */
export const badFill = 'bg-red-600 text-white';

/** Done as a filled bar, a roadmap's progress. */
export const doneFill = 'bg-emerald-500';

/** In progress as a fill, its column's stripe and the In work lane's, and the latest event of a task's timeline. */
export const inProgressFill = 'bg-sky-500';

/** Work under way as words: a line saying the page reads or asks something now. */
export const workingText = 'text-sky-700 dark:text-sky-300';

/** A pull request's CI as a dot, by Jig's word for it: green passed, red failed, pending running. */
export const ciDot: Record<string, string> = { green: 'bg-emerald-500', red: 'bg-red-500', pending: inProgressFill };

/** CI not heard yet — housekeeping has not asked the forge since the pull request opened — as a hollow dot. */
export const notHeardDot = 'border border-muted-foreground bg-transparent';

/** How a finished task ended, as a chip: closed went well; abandoned and archived are only put away. */
export const endingAccent: Record<string, string> = {
  closed: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300',
  abandoned: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
  archived: 'bg-slate-500/15 text-slate-700 dark:text-slate-300',
};

/** Each column's accent, by the column ids the board API sends; an id this page does not know gets none. */
export const columnAccent: Record<string, string> = {
  'needs-you': 'bg-amber-500',
  'in-progress': inProgressFill,
  review: 'bg-violet-500',
  'on-staging': 'bg-teal-500',
  ready: 'bg-emerald-500',
  backlog: 'bg-slate-400',
  paused: 'bg-zinc-400',
};

/** Each lane's accent on a roadmap board: to file a grey that means nothing more, in work as In progress, done as done. */
export const laneAccent: Record<Lane, string> = {
  'to-file': 'bg-muted-foreground/40',
  'in-work': inProgressFill,
  done: doneFill,
};
