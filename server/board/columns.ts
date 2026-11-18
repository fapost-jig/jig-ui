import type { Task } from '../source/project-source.js';

export type ColumnId = 'backlog' | 'in-progress' | 'needs-you' | 'paused' | 'ready' | 'review' | 'on-staging';

/** A task on the board, with the column a resume would put it in: `null` unless it is resumable. */
export type Card = Task & {
  resumesTo: ColumnId | null;
};

export interface Column {
  id: ColumnId;
  title: string;
  cards: Card[];
}

/**
 * The board's order: what waits for the person first, then what moves, what waits on other people at the staging
 * branch, what is done, what is not begun, what is set aside. Review and On staging only on Jig's staging flow.
 */
const COLUMNS: {
  id: ColumnId;
  title: string;
}[] = [
  { id: 'needs-you', title: 'Needs you' },
  { id: 'in-progress', title: 'In progress' },
  { id: 'review', title: 'Review' },
  { id: 'on-staging', title: 'On staging' },
  { id: 'ready', title: 'Ready' },
  { id: 'backlog', title: 'Backlog' },
  { id: 'paused', title: 'Paused' },
];

/** Where a task stands, from Jig's state alone; the first rule that fits wins. */
export function columnOf(task: Task): ColumnId {
  if (task.paused) return 'paused';
  if (!task.started) return 'backlog';
  if (task.gate === 'waiting' || task.gate === 'changed' || task.autopilot === 'stopped') return 'needs-you';
  if (task.parked?.reason === 'review') return 'review';
  if (task.parked?.reason === 'signal') return 'on-staging';
  if (task.status === 'ready') return 'ready';
  return 'in-progress';
}

/** The column a task sits in, with its title. */
export function placeOf(task: Task): {
  id: ColumnId;
  title: string;
} {
  const id = columnOf(task);
  return { id, title: COLUMNS.find((c) => c.id === id)?.title ?? id };
}

/** Jig's queue order: the top level first, then each open epic's by its name, by position there; a task not queued after them all. */
function byQueue(a: Task, b: Task): number {
  if (!a.queue || !b.queue) return a.queue ? -1 : b.queue ? 1 : 0;
  const [x, y] = [a.queue.level, b.queue.level];
  if (x !== y) return x === null ? -1 : y === null ? 1 : x < y ? -1 : 1;
  return a.queue.position - b.queue.position;
}

/**
 * What a resume changes, so the rules say where the task lands: a paused task's `paused` only; a task parked at the
 * staging branch is taken back for a fix, and Jig makes it `active` and parks it no more (0.45.0).
 */
const resumed = (task: Task): Task => (task.paused ? { ...task, paused: false } : { ...task, status: 'active', parked: null });

const card = (task: Task): Card => ({ ...task, resumesTo: task.resumable ? columnOf(resumed(task)) : null });

const STAGING: ColumnId[] = ['review', 'on-staging'];

/**
 * The board: every column, in a fixed order, its cards in Jig's queue order and the tasks not queued after them in the
 * order Jig listed them (the sort is stable). Computed on every read, never stored. Review and On staging are there when
 * the project is on Jig's staging flow (`stagingFlow` of its read), even before it has a task.
 */
export function columns(tasks: Task[], stagingFlow: boolean): Column[] {
  return COLUMNS.filter((c) => stagingFlow || !STAGING.includes(c.id)).map((c) => ({
    ...c,
    cards: tasks
      .filter((t) => columnOf(t) === c.id)
      .sort(byQueue)
      .map(card),
  }));
}
