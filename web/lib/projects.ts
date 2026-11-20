import type { Attention, HousekeepingAnswer, Project } from '../api';
import { reasonsOf } from './refusal';
import type { Tone } from './tones';

/** A connected project whose read has not landed yet: the Projects page lists it at once. */
export interface Reading {
  id: string;
  state: 'reading';
}

/** A project in the Projects page's list: read, or still being read. */
export type Listed = Project | Reading;

const isRead = (p: Listed): p is Project => p.state !== 'reading';

/** A person's write on a task from an item on a project's card: closing it as done, merging its pull request, landing it on staging. */
export type ItemWrite = 'close' | 'merge' | 'land';

/**
 * A write on a task from a project's card: under way, what Jig did, or what it refused, until dismissed; `board` when
 * the next step is on the project's Board — a landing Jig refused as not approved, which only the Board lands without review.
 */
export type ClosingState =
  | {
      task: string;
      write: ItemWrite;
      state: 'running';
    }
  | {
      task: string;
      write: ItemWrite;
      state: 'done';
      message: string;
    }
  | {
      task: string;
      write: ItemWrite;
      state: 'refused';
      message: string;
      board?: boolean;
    };

/**
 * The task an attention item on a project's card offers to close as done: Jig's "Merged: the task can be closed"
 * (`needs-consolidation`), for a task the project lists as closable, as its card on the board is.
 */
export function closableTask(project: Project, item: Attention): string | undefined {
  const task = item.subject.id;
  return project.state === 'ready' && item.kind === 'needs-consolidation' && task !== null && project.closable.includes(task)
    ? task
    : undefined;
}

/**
 * How many knowledge documents and changed linked files wait for the person's decision, as the project's own items say:
 * Jig gives the numbers only in their detail (`4 document(s) proposed`, `2 file(s)`). 0 with neither item.
 */
export const knowledgeWaiting = (attention: readonly Attention[]): number =>
  attention
    .filter((a) => a.kind === 'knowledge-proposed' || a.kind === 'sources-changed')
    .reduce((n, a) => n + (Number.parseInt(a.detail ?? '', 10) || 0), 0);

/** Housekeeping run from a project's card: under way, Jig's report once it ran, or why it did not, with Jig's reasons. */
export type HousekeepingState =
  | { state: 'running' }
  | {
      state: 'done';
      report: string[];
    }
  | {
      state: 'refused';
      message: string;
      reasons: string[];
    };

/** Housekeeping's answer as a card and a project's page show it: Jig's report, or why it did not run, with Jig's reasons. */
export function housekeepingOf(answer: HousekeepingAnswer): HousekeepingState | undefined {
  if ('report' in answer) return { state: 'done', report: answer.report };
  if ('error' in answer) return { state: 'refused', message: answer.error.message, reasons: reasonsOf(answer.error) };
  return undefined;
}

/** Refresh from a project's card: under way, what came of it in the page's words (`refreshReport`), or why it did not run. */
export type RefreshState =
  | { state: 'running' }
  | {
      state: 'done';
      tone: Tone;
      lines: string[];
    }
  | {
      state: 'refused';
      message: string;
    };

/** The projects by id, A–Z: case aside, and numbers by value, so `app2` comes before `app10`. */
export const byName = <P extends { id: string }>(projects: P[]): P[] =>
  [...projects].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true, sensitivity: 'base' }));

/** The projects whose id holds what was typed, whatever its case; every project when nothing is. */
export function matching<P extends { id: string }>(projects: P[], query: string): P[] {
  const typed = query.trim().toLowerCase();
  return typed ? projects.filter((p) => p.id.toLowerCase().includes(typed)) : projects;
}

/** Something to do there, or not readable. */
const needsYou = (p: Project): boolean => p.state !== 'ready' || p.attention.length > 0;

/**
 * The project whose card the workspace shows: the one asked for, if connected, even while it is read; else, once every
 * read has landed, the first that needs the person; else the first. Waiting keeps the card from jumping as reads land.
 */
export function chosen(projects: Listed[], wanted: string | undefined): Listed | undefined {
  const asked = projects.find((p) => p.id === wanted);
  if (asked || !projects.every(isRead)) return asked;
  return projects.find((p) => isRead(p) && needsYou(p)) ?? projects[0];
}

/** How far the first read of the projects has come; `undefined` once every one has landed. */
export function readProgress(projects: Listed[]):
  | {
      read: number;
      of: number;
    }
  | undefined {
  const read = projects.filter(isRead).length;
  return read < projects.length ? { read, of: projects.length } : undefined;
}

/**
 * The list with a project's own read in its place, while that place still waits for it. The first load's reads do not
 * go through `lastWins`: each answers for one project, and a project already there came from a workspace read, which
 * is as new or newer, so it stays.
 */
export const landed = (projects: Listed[], project: Project): Listed[] =>
  projects.map((p) => (p.id === project.id && !isRead(p) ? project : p));

/** The projects read so far, for what is worked out over read projects only (the upgrade lines, Upgrade all). */
export const readOnes = (projects: Listed[]): Project[] => projects.filter(isRead);
