import { hc, type InferRequestType, type InferResponseType } from 'hono/client';
import { ref } from 'vue';
import type { AppType } from '../server/http/app';
import { housekeepingOf, type HousekeepingState, type RefreshState } from './lib/projects';
import { refreshOf } from './lib/refresh';
/** The server's API, typed by its own routes (`AppType`); only its type crosses into the page. */
export const client = hc<AppType>('/');
type Api = typeof client.api;
type Ok<R> = InferResponseType<R, 200>;

export type Project = Ok<Api['workspace']['$get']>['projects'][number];
/** The runs that change this machine's Jig or every project: a self-update, Upgrade all. */
export type Machine = Ok<Api['workspace']['$get']>['machine'];
/** A newer Jig UI on npm and the command that stops this one, or `null`. */
export type Newer = Ok<Api['instance']['newer']['$get']>['newer'];
/** This machine's Jig and the newest Jig released; `null` while it cannot be told. */
export type MachineJig = Ok<Api['instance']['jig']['$get']>['jig'];
export type Attention = Extract<Project, { state: 'ready' }>['attention'][number];
export type Board = Ok<Api['projects'][':id']['board']['$get']>['board'];
export type Column = Extract<Board, { state: 'ready' }>['columns'][number];
export type Task = Column['cards'][number];
export type TaskDetails = Ok<Api['projects'][':id']['tasks'][':task']['$get']>['task'];
/** A task's details when its project could be read. */
export type ReadyDetails = Extract<TaskDetails, { state: 'ready' }>;
type Documents = Api['projects'][':id']['tasks'][':task']['artifacts'];
/** A task's documents that are there, or why the project's Jig cannot list them. */
export type TaskArtifacts = Ok<Documents['$get']>['artifacts'];
export type TaskArtifact = Ok<Documents[':kind']['$get']>['artifact'];
export type ArtifactKind = Extract<TaskArtifact, { state: 'ready' }>['kind'];
/** The finished tasks Jig still keeps, or why they cannot be read. */
export type Finished = Ok<Api['projects'][':id']['finished']['$get']>['finished'];
export type Settings = Ok<Api['projects'][':id']['settings']['$get']>['settings'];
/** Whom the forge offers to review a pull request into the staging branch, or why Jig could not ask it. */
export type Reviewers = Ok<Api['projects'][':id']['reviewers']['$get']>['reviewers'];
type Tasks = Api['projects'][':id']['tasks'];
/** What a person's landing on staging did. */
export type Landed = Extract<Ok<Tasks['land']['$post']>, { landed: unknown }>['landed'];
/** What preparing a task for prod did. */
export type Promoted = Extract<Ok<Tasks['promote']['$post']>, { promoted: unknown }>['promoted'];
/** The answer to a person's landing, promotion or review request on the staging flow, or a merge. */
export type Staged = Awaited<
  ReturnType<Tasks['land']['$post'] | Tasks['promote']['$post'] | Tasks['request-review']['$post'] | Tasks['merge']['$post']>
>;
/** What a person's merge of a task's pull request did, and whether the task closed with it. */
export type Merged = Extract<Ok<Tasks['merge']['$post']>, { merged: unknown }>['merged'];
/** Where a task's pull request stands on the forge now, or why Jig could not ask it. */
export type PrStatus = Ok<Tasks[':task']['pr-status']['$get']>['prStatus'];
/** An attention item's task pull request as the forge cache had it (Jig 0.46.0). */
export type TaskPullRequest = NonNullable<Attention['taskPullRequest']>;
export type Setting = Extract<Settings, { state: 'ready' }>['keys'][number];
export type Specs = Ok<Api['projects'][':id']['specs']['$get']>['specs'];
export type Spec = Extract<Specs, { state: 'ready' }>['specs'][number];
/** One of a spec's documents as it is written, or why the project's Jig cannot read it. */
export type SpecText = Ok<Api['projects'][':id']['specs'][':spec']['documents'][':kind']['$get']>['text'];
export type SpecDocument = Extract<SpecText, { state: 'ready' }>['kind'];
export type SpecItem = Spec['phases'][number]['items'][number];
export type Failure = InferResponseType<Api['projects']['$post'], 422>;
type KnowledgeApi = Api['projects'][':id']['knowledge'];
/** What waits for a person's decision in a project's knowledge, or why its Jig cannot list it. */
export type Knowledge = Ok<KnowledgeApi['$get']>['knowledge'];
export type ReadyKnowledge = Extract<Knowledge, { state: 'ready' }>;
export type Proposal = ReadyKnowledge['proposals'][number];
export type LinkedSource = ReadyKnowledge['sources'][number];
/** How a stub's linked file changed since it was approved, or why the project's Jig cannot say. */
export type SourceDiff = Ok<KnowledgeApi[':doc']['diff']['$get']>['diff'];
/** A proposed document's text and the file a stub links, or why the project cannot be read. */
export type DocumentText = Ok<KnowledgeApi[':doc']['text']['$get']>['text'];
/** Documents and how each was decided, as the route takes them: each document once. */
export type DocumentDecision = NonNullable<InferRequestType<KnowledgeApi['decide']['$post']>['json']['decisions']>[number];
/** A decision as the route takes it: Jig's command, `reviewed` keeping a changed file. */
export type Decision = DocumentDecision['decision'];
/** The answer to a knowledge decision. */
export type Decided = Awaited<ReturnType<KnowledgeApi['decide']['$post']>>;
type Queue = Api['projects'][':id']['queue'];
/** Where a move puts a task, as the move route takes it. */
export type Place = NonNullable<InferRequestType<Queue['move']['$post']>['json']['place']>;
type Items = Api['projects'][':id']['specs']['items'];
/** Where a move puts a roadmap item, as the move route takes it. */
export type ItemPlace = NonNullable<InferRequestType<Items['move']['$post']>['json']['place']>;
/** The answer to an edit of a roadmap. */
export type Edited = Awaited<ReturnType<Items['add']['$post'] | Items['move']['$post'] | Items['file']['$post']>>;
/** The answer to a write of the queue. */
export type Written = Awaited<
  ReturnType<Queue['move']['$post'] | Queue['priority']['$post'] | Queue['pause']['$post'] | Queue['pause']['cancel']['$post']>
>;

/** What Find projects found under a folder. */
export type FoundProjects = Ok<Api['scan']['$post']>;

/** What upgrading a project's Jig would do: Jig's dry run of it. */
/** What Check all merges came to: the projects landed, still waiting for a merge, and stopped. */
export type LandedAll = Ok<Api['upgrade']['land-all']['$post']>['landed'];

/** How a ready project's clone stands against origin as of its last fetch; `null` while it cannot be told. */
export type Origin = Extract<Project, { state: 'ready' }>['origin'];

/** What bringing a project's clone up to origin did (`jig refresh`), without git's messages or a path. */
export type Refreshed = Extract<Ok<Api['projects'][':id']['refresh']['$post']>, { refreshed: unknown }>['refreshed'];

export type UpgradePlan = Extract<Ok<Api['projects'][':id']['upgrade']['plan']['$post']>, { plan: unknown }>['plan'];

/** Why the page cannot show anything: the session or the server ended, the registry cannot be read, or the server failed. */
export const failure = ref<
  | {
      kind: 'registry-unreadable';
      message: string;
    }
  | { kind: 'session-ended' }
  | { kind: 'not-running' }
  | { kind: 'internal' }
  | undefined
>();

/** A call that turns the end of the session or of the server, or a failure of the server, into `failure`. */
export async function call<
  R extends {
    status: number;
    json(): Promise<unknown>;
  },
>(request: () => Promise<R>): Promise<R | undefined> {
  let res: R;
  try {
    res = await request();
  } catch {
    failure.value = { kind: 'not-running' };
    return undefined;
  }
  if (res.status === 401) failure.value = { kind: 'session-ended' };
  else if (res.status === 500) {
    const body = (await res.json().catch(() => undefined)) as Partial<Failure> | undefined;
    failure.value =
      body?.error?.code === 'registry-unreadable' ? { kind: 'registry-unreadable', message: body.error.message } : { kind: 'internal' };
  } else return res;
  return undefined;
}

/** One task in full, or why there is none: no such project, no such live task; undefined when `call` failed. */
export async function readTask(project: string, task: string): Promise<TaskDetails | 'not-connected' | 'not-found' | undefined> {
  const res = await call(() =>
    client.api.projects[':id'].tasks[':task'].$get({ param: { id: encodeURIComponent(project), task: encodeURIComponent(task) } }),
  );
  if (!res) return undefined;
  if (res.status === 200) return (await res.json()).task;
  return (await res.json()).error.code === 'not-found' ? 'not-found' : 'not-connected';
}

/** A task's documents, or why there are none: no such project, no such task; undefined when `call` failed. */
export async function readArtifacts(project: string, task: string): Promise<TaskArtifacts | 'not-connected' | 'not-found' | undefined> {
  const param = { id: encodeURIComponent(project), task: encodeURIComponent(task) };
  const res = await call(() => client.api.projects[':id'].tasks[':task'].artifacts.$get({ param }));
  if (!res) return undefined;
  if (res.status === 200) return (await res.json()).artifacts;
  return (await res.json()).error.code === 'not-found' ? 'not-found' : 'not-connected';
}

/** A project's settings, or `not-connected` when no project has the id; undefined when `call` failed. */
export async function readSettings(project: string): Promise<Settings | 'not-connected' | undefined> {
  const res = await call(() => client.api.projects[':id'].settings.$get({ param: { id: encodeURIComponent(project) } }));
  if (!res) return undefined;
  return res.status === 200 ? (await res.json()).settings : 'not-connected';
}

/** One of a task's documents as it is written, or `not-found` when it is gone; undefined when `call` failed. */
export async function readArtifact(project: string, task: string, kind: ArtifactKind): Promise<TaskArtifact | 'not-found' | undefined> {
  const param = { id: encodeURIComponent(project), task: encodeURIComponent(task), kind };
  const res = await call(() => client.api.projects[':id'].tasks[':task'].artifacts[':kind'].$get({ param }));
  if (!res) return undefined;
  if (res.status === 200) return (await res.json()).artifact;
  return 'not-found';
}

/** One of a spec's documents as it is written, or `not-found` when Jig lists no such; undefined when `call` failed. */
export async function readSpecText(project: string, spec: string, kind: SpecDocument): Promise<SpecText | 'not-found' | undefined> {
  const param = { id: encodeURIComponent(project), spec: encodeURIComponent(spec), kind };
  const res = await call(() => client.api.projects[':id'].specs[':spec'].documents[':kind'].$get({ param }));
  if (!res) return undefined;
  if (res.status === 200) return (await res.json()).text;
  return 'not-found';
}

/**
 * Answers a task's design at its gate (`jig task gate <id> answered --answer <text>`), where the approval is offered:
 * `revision` is the design's read, the oldest of its documents', and a design rewritten since is refused `stale-revision`.
 * Returns the request itself, as the approval's is sent through `call`: a blank answer is refused 422 `usage` before Jig runs.
 */
export function answerGate(project: string, task: string, answer: string, revision: number) {
  return client.api.projects[':id'].tasks.act.$post({
    param: { id: encodeURIComponent(project) },
    json: { task, action: 'answer-gate', answer, revision },
  });
}

/** Reads a project through Jig now (Read again); `false` when the request did not get through. */
export async function readAgain(project: string): Promise<boolean> {
  return (await call(() => client.api.projects[':id'].read.$post({ param: { id: encodeURIComponent(project) } }))) !== undefined;
}

/**
 * Runs `jig housekeeping` in a project (Housekeeping): Jig's report, or why it did not run with Jig's reasons;
 * `undefined` when the request did not get through, or the project cannot be read now and its state says why.
 */
export async function runHousekeeping(project: string): Promise<HousekeepingState | undefined> {
  const res = await call(() => client.api.projects[':id'].housekeeping.$post({ param: { id: encodeURIComponent(project) } }));
  return res && housekeepingOf(await res.json());
}

/**
 * Runs `jig refresh` in a project (Refresh): what came of it in the page's words, or why it did not run; `undefined`
 * when the request did not get through, or the project cannot be read now and its state says why.
 */
export async function runRefresh(project: string): Promise<RefreshState | undefined> {
  const res = await call(() => client.api.projects[':id'].refresh.$post({ param: { id: encodeURIComponent(project) } }));
  return res && refreshOf(await res.json());
}

/** Housekeeping's and Refresh's answers, whatever their status. */
export type HousekeepingAnswer = InferResponseType<Api['projects'][':id']['housekeeping']['$post']>;
export type RefreshAnswer = InferResponseType<Api['projects'][':id']['refresh']['$post']>;

/** A project's state as every read of it reports it, without the upgrade the workspace adds. */
export type ProjectState<P = Project> = P extends unknown ? Omit<P, 'upgrade'> : never;

/** What a project's state means, for a person. */
export function describe(project: ProjectState): string {
  if (project.state === 'ready') return `Jig ${project.jigVersion}`;
  if (project.state === 'unsupported') {
    const found = project.jigVersion ? `Jig ${project.jigVersion}` : 'A Jig of unknown version';
    return `${found} — Jig UI needs ${project.minimum} or later. Run jig upgrade in the project.`;
  }
  if (project.state === 'incompatible') {
    return `Jig ${project.jigVersion} answers in a form this Jig UI does not read. Update Jig UI: npx @fapost/jig-ui@latest, or jig-ui if it was installed without Node.js.`;
  }
  if (project.state === 'unreadable') {
    const why = project.code === 'timeout' ? 'Jig did not answer within 30 s' : `Jig could not be read (${project.code})`;
    return `${why}. It is read again on the next change, every minute, or with Read again.`;
  }
  return project.reason === 'missing' ? 'The project directory is not there any more.' : 'There is no Jig in the project any more.';
}

/** A link only for a web address: the url comes from the project's files. */
export const link = (url: string | null): string | undefined => (url?.startsWith('https://') ? url : undefined);

/** Told a project's id when it changed, or nothing when anything may have: the stream came back after a gap. */
type Listener = (project?: string) => void;
const listeners = new Set<Listener>();
let events: EventSource | undefined;

/**
 * Follows the server's change signals; one stream for the whole page. Returns the unsubscribe.
 * It is also the first read: `listener` runs once the stream is open — at once if it already is —
 * because a read made before the server follows the project is read again when it starts to.
 */
export function onChange(listener: Listener): () => void {
  if (listeners.size === 0) document.addEventListener('visibilitychange', follow); // added once: same function
  listeners.add(listener);
  follow();
  if (events?.readyState === EventSource.OPEN) listener();
  return () => listeners.delete(listener);
}

/**
 * Opens the stream while the tab is visible and closes it while hidden: a browser gives one site
 * six connections over HTTP/1.1, and a stream per open tab would use them up.
 */
function follow(): void {
  if (document.hidden) {
    events?.close();
    events = undefined;
    return;
  }
  if (events) return;
  events = new EventSource('/api/events');
  // Signals sent while no stream was open are lost — before the first open too, when the tab
  // loaded hidden: everything is fetched again on every open.
  events.addEventListener('open', () => {
    for (const listener of listeners) listener();
  });
  events.addEventListener('changed', (event) => {
    const { project } = JSON.parse((event as MessageEvent<string>).data) as { project: string };
    for (const listener of listeners) listener(project);
  });
  // The browser retries on its own; asking the server says whether it ended or the session did.
  events.addEventListener('error', () => void call(() => client.api.instance.$get()));
}
