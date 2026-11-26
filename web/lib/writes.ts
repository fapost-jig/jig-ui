import type { ArtifactKind, ReadyDetails } from '../api';
import { parseRef } from './waits';

/** The writes on a live task its page runs as buttons, by the id of Jig's action that offers them. */
const LIVE_WRITES = ['approve-gate', 'answer-gate', 'abandon', 'archive'];

/** A person's write on a task the page runs: on a live task, or on a finished one from the list of them. */
export type TaskWrite = 'approve-gate' | 'answer-gate' | 'abandon' | 'archive' | 'unarchive' | 'drop-item';

/** What a write is called while it runs, as a refusal says it: "Jig refused archiving a". */
export const DOING: Record<TaskWrite | 'depend' | 'undepend', string> = {
  'approve-gate': 'approving the design of',
  'answer-gate': 'answering the design of',
  abandon: 'abandoning',
  archive: 'archiving',
  unarchive: 'bringing back',
  'drop-item': 'closing the roadmap item of',
  depend: 'adding a dependency to',
  undepend: 'removing a dependency of',
};

/** Which of the actions Jig offers on a live task its page runs itself. */
export function pageWrites(details: Pick<ReadyDetails, 'actions'>): Set<string> {
  return new Set(details.actions.flatMap((a) => (LIVE_WRITES.includes(a.id) ? [a.id] : [])));
}

/**
 * The documents of a design at its gate, as Jig approves them: `design.md`, and for a T4 its `spec.md` and
 * `alternatives.md` before it, where the task has them.
 */
export function gateDocuments(taskClass: string | null, listed: ArtifactKind[]): ArtifactKind[] {
  const kinds: ArtifactKind[] = taskClass === 'T4' ? ['spec', 'alternatives', 'design'] : ['design'];
  return kinds.filter((kind) => kind === 'design' || listed.includes(kind));
}

/** A dependency's target as the page names it: `task:a` is a, `epic:x` is epic x; any other reference as Jig wrote it. */
export function refName(ref: string): string {
  if (!ref.startsWith('task:') && !ref.startsWith('epic:')) return ref;
  const { kind, id } = parseRef(ref);
  return kind === 'epic' ? `epic ${id}` : id;
}

/**
 * What a live task may be made to wait for, as queue references: the other live tasks and the open epics, less what it
 * waits for already.
 */
export function dependCandidates(task: string, live: string[], openEpics: string[], dependsOn: { on: string }[]): string[] {
  const has = new Set(dependsOn.map((d) => d.on));
  return [...live.filter((id) => id !== task).map((id) => `task:${id}`), ...openEpics.map((id) => `epic:${id}`)].filter(
    (ref) => !has.has(ref),
  );
}
