import type { ArtifactKind, ReadyDetails } from '../api';

/** The writes on a live task its page runs as buttons, by the id of Jig's action that offers them. */
const LIVE_WRITES = ['approve-gate', 'abandon', 'archive'];

/** A person's write on a task the page runs: on a live task, or on a finished one from the list of them. */
export type TaskWrite = 'approve-gate' | 'abandon' | 'archive' | 'unarchive' | 'drop-item';

/** What a write is called while it runs, as a refusal says it: "Jig refused archiving a". */
export const DOING: Record<TaskWrite | 'depend' | 'undepend', string> = {
  'approve-gate': 'approving the design of',
  abandon: 'abandoning',
  archive: 'archiving',
  unarchive: 'bringing back',
  'drop-item': 'closing the roadmap item of',
  depend: 'adding a dependency to',
  undepend: 'removing a dependency of',
};

/** Which of the actions Jig offers on a live task its page runs itself; none on a Jig older than 0.46.0, where each is a command. */
export function pageWrites(details: Pick<ReadyDetails, 'actions' | 'writes'>): Set<string> {
  return new Set(details.writes ? details.actions.flatMap((a) => (LIVE_WRITES.includes(a.id) ? [a.id] : [])) : []);
}

/** What to ask the person's agent for to take a task into work: the agent does that work, never the page. */
export const startRequest = (task: string, project: string): string => `Start task ${task} in ${project}`;

/**
 * The offers the page lists to copy: those it does not run, each with Jig's command — starting a task, on a Jig that
 * takes a person's writes, as the request for the agent instead (`asks`); below 0.46.0 the page is as before.
 */
export function listedActions(
  actions: {
    id: string;
    command: string;
  }[],
  runs: Set<string>,
  writes: boolean,
  task: string,
  project: string,
): {
  id: string;
  command: string;
  asks: boolean;
}[] {
  return actions.flatMap((a) => {
    if (runs.has(a.id)) return [];
    const asks = a.id === 'start' && writes;
    return [{ id: a.id, command: asks ? startRequest(task, project) : a.command, asks }];
  });
}

/**
 * The documents of a design at its gate, as Jig approves them: `design.md`, and for a T4 its `spec.md` and
 * `alternatives.md` before it, where the task has them.
 */
export function gateDocuments(taskClass: string | null, listed: ArtifactKind[]): ArtifactKind[] {
  const kinds: ArtifactKind[] = taskClass === 'T4' ? ['spec', 'alternatives', 'design'] : ['design'];
  return kinds.filter((kind) => kind === 'design' || listed.includes(kind));
}

/** A dependency's target as the page names it: `task:a` is a, `epic:x` is epic x. */
export const refName = (ref: string): string => (ref.startsWith('epic:') ? `epic ${ref.slice(5)}` : ref.replace(/^task:/, ''));

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
