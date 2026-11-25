<script setup lang="ts">
  import { BookCheck, Columns3, ExternalLink, Milestone, Plus, RotateCw, Rows3 } from '@lucide/vue';
  import { computed, onUnmounted, type Ref, ref, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import {
    type Board,
    call,
    client,
    type DocumentDecision,
    type DocumentText,
    type Edited,
    type Finished,
    type ItemPlace,
    type Knowledge,
    link,
    onChange,
    type Place,
    type PrStatus,
    readAgain,
    readTask,
    runHousekeeping,
    runRefresh,
    type ReadyDetails,
    type Reviewers,
    type SourceDiff,
    type SpecItem,
    type Specs,
    type Staged,
    type Written,
  } from '@/api';
  import BoardColumns from '@/components/BoardColumns.vue';
  import ChoreReports from '@/components/ChoreReports.vue';
  import BoardFilter from '@/components/BoardFilter.vue';
  import BoardList from '@/components/BoardList.vue';
  import EpicMenu from '@/components/EpicMenu.vue';
  import FileItemDialog from '@/components/FileItemDialog.vue';
  import FinishedList from '@/components/FinishedList.vue';
  import KnowledgeView from '@/components/KnowledgeView.vue';
  import NewTaskForm from '@/components/NewTaskForm.vue';
  import SpecBoard from '@/components/SpecBoard.vue';
  import SpecList from '@/components/SpecList.vue';
  import StateLine from '@/components/StateLine.vue';
  import { Button } from '@/components/ui/button';
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
  import { Toggle } from '@/components/ui/toggle';
  import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
  import { conflict } from '@/lib/conflict';
  import { listed } from '@/lib/specs';
  import { useDecisions } from '@/lib/decisions';
  import { movable } from '@/lib/epics';
  import { type FINISHED_WRITES, settleFinished } from '@/lib/finished';
  import { DOING } from '@/lib/writes';
  import { knowledgeRefusal, newer, noKnowledge } from '@/lib/knowledge';
  import { lastWins } from '@/lib/last-wins';
  import { mergedLine } from '@/lib/pr-status';
  import { knowledgeWaiting, type HousekeepingState, type RefreshState } from '@/lib/projects';
  import {
    closeRefusal,
    fileItemRefusal,
    mergeRefusal,
    mergeShowsStatus,
    reasonsOf,
    refusal,
    roadmapRefusal,
    stagingRefusal,
    writeRefusal,
  } from '@/lib/refusal';
  import { filtered, fromQuery, reorders, sift, type Sift, specsOf, toQuery } from '@/lib/sift';
  import { landedLine, promotedLine, requestedLine, STAGING_DOING, type StagingStep } from '@/lib/staging';
  import { toneText } from '@/lib/tones';

  const props = defineProps<{
    id: string;
  }>();

  const board = ref<Board | 'not-connected'>();

  const param = { id: encodeURIComponent(props.id) };

  /** How many finished tasks Jig still keeps; the tasks are read only when the person asks, and hidden on every visit. */
  const finishedCount = computed(() => (typeof board.value === 'object' && board.value.state === 'ready' ? board.value.finishedCount : 0));
  const showFinished = ref(false);
  // With the last one gone the toggle goes too; the next one to finish is not shown unasked.
  watch(
    () => finishedCount.value === 0,
    (none) => none && (showFinished.value = false),
  );

  /** The finished tasks as last read; none while the first read since opening the list runs. */
  const finished = ref<Finished>();
  /** The shown list is a good one kept over a torn read; the next torn read in a row is believed. */
  let held = false;
  // A run with the list closed lands nothing, yet still keeps an older read from landing. Any failure is this list's, not the project's.
  // A refresh keeps a good list over one torn read (see settleFinished); a read made afresh is believed at once.
  const loadFinished = lastWins(
    async () => {
      if (!showFinished.value) return undefined;
      const res = await call(() => client.api.projects[':id'].finished.$get({ param }));
      return res?.status === 200 ? (await res.json()).finished : ({ id: props.id, state: 'unreadable', code: 'failed' } as const);
    },
    (read) => {
      const settled = settleFinished(finished.value, read, held);
      finished.value = settled.shown;
      held = settled.held;
    },
  );

  function readFinishedAfresh(): void {
    finished.value = undefined;
    held = false;
    void loadFinished();
  }
  watch(showFinished, readFinishedAfresh);

  const load = lastWins(
    async () => {
      const res = await call(() => client.api.projects[':id'].board.$get({ param }));
      return res && (res.status === 404 ? ('not-connected' as const) : (await res.json()).board);
    },
    (read) => (board.value = read),
  );

  /** Read again is under way. */
  const reading = ref(false);

  async function reread(): Promise<void> {
    reading.value = true;
    const read = await readAgain(props.id);
    reading.value = false;
    if (read) await readShown();
  }

  /** What the page shows, read again after Read again, Refresh or Housekeeping: the knowledge too in its view. */
  const readShown = () =>
    Promise.all([load(), loadSpecs(), loadWaiting(), loadFinished(), view.value === 'knowledge' ? loadKnowledge() : undefined]);

  /** Refresh and Housekeeping from the page's header, as on the project's card: under way, or what came of it until dismissed. */
  const refresh = ref<RefreshState>();
  const housekeeping = ref<HousekeepingState>();

  async function refreshClone(): Promise<void> {
    refresh.value = { state: 'running' };
    refresh.value = await runRefresh(props.id);
    await readShown();
  }

  async function housekeep(): Promise<void> {
    housekeeping.value = { state: 'running' };
    housekeeping.value = await runHousekeeping(props.id);
    await readShown();
  }

  const specs = ref<Specs | 'not-connected'>();
  const loadSpecs = lastWins(
    async () => {
      const res = await call(() => client.api.projects[':id'].specs.$get({ param }));
      return res && (res.status === 404 ? ('not-connected' as const) : (await res.json()).specs);
    },
    (read) => (specs.value = read),
  );

  /**
   * The counts beside the views: the live tasks, the specs, and the knowledge waiting for the person as the project's own
   * read says it, without reading the knowledge (feature-knowledge: two Jig runs, only while its view shows).
   */
  const waiting = ref<number | null>();
  const loadWaiting = lastWins(
    async () => {
      const res = await call(() => client.api.projects[':id'].$get({ param }));
      const project = res?.status === 200 ? (await res.json()).project : undefined;
      return res && (project?.state === 'ready' ? knowledgeWaiting(project.attention) : null);
    },
    (read) => (waiting.value = read),
  );

  const counts = computed(() => ({
    tasks:
      typeof board.value === 'object' && board.value.state === 'ready'
        ? board.value.columns.reduce((n, c) => n + c.cards.length, 0)
        : undefined,
    specs: typeof specs.value === 'object' && specs.value.state === 'ready' ? specs.value.specs.length : undefined,
    knowledge: waiting.value || undefined,
  }));

  const route = useRoute();
  const router = useRouter();

  /**
   * Board, List, Specs or Knowledge, remembered by this browser only; storage that throws leaves the board. A link that
   * names one (`?view=knowledge`, from the workspace card) opens it, and the address drops it.
   */
  const VIEW = 'jig-ui.board-view';
  const VIEWS = ['board', 'list', 'specs', 'knowledge'] as const;
  type View = (typeof VIEWS)[number];
  const isView = (v: unknown): v is View => VIEWS.includes(v as View);
  function storedView(): View {
    try {
      const stored = localStorage.getItem(VIEW);
      return isView(stored) ? stored : 'board';
    } catch {
      return 'board';
    }
  }
  const view = ref(storedView());
  function show(next: unknown): void {
    if (!isView(next)) return; // a press on the pressed item asks for none
    view.value = next;
    try {
      localStorage.setItem(VIEW, next);
    } catch {
      // Storage refused: the choice holds until the page closes.
    }
  }
  if (route.query.view !== undefined) {
    show(route.query.view);
    void router.replace({ query: { ...route.query, view: undefined } });
  }

  /** The task whose details are open: expanded on the board, in the pane of the list. Its details are read on demand. */
  const selected = ref<string>();
  const details = ref<ReadyDetails | 'unavailable'>();
  // A run with nothing selected lands nothing, yet still keeps an older read from landing.
  const readSelected = lastWins(
    async () => {
      if (selected.value === undefined) return undefined;
      const read = await readTask(props.id, selected.value);
      return typeof read === 'object' && read.state === 'ready' ? read : ('unavailable' as const);
    },
    (read) => (details.value = read),
  );

  watch(selected, () => {
    details.value = undefined;
    void readSelected();
  });

  const cards = computed(() =>
    board.value !== undefined && board.value !== 'not-connected' && board.value.state === 'ready'
      ? board.value.columns.flatMap((c) => c.cards)
      : [],
  );

  const liveIds = computed(() => cards.value.map((t) => t.id));

  /** Each live task's board column, by its id: the Specs view's cards say where an item's task stands. */
  const columnOf = computed(
    () =>
      new Map(
        typeof board.value === 'object' && board.value.state === 'ready'
          ? board.value.columns.flatMap((c) => c.cards.map((t) => [t.id, { id: c.id, title: c.title }] as const))
          : [],
      ),
  );

  /** How Board and List look at the board — sort and filters — kept in the page's address, so a reload or a link keeps it. */
  const sifting = computed({
    get: () => fromQuery(route.query),
    set: (next: Sift) => void router.replace({ query: { ...toQuery(next), spec: route.query.spec } }),
  });

  const sifted = computed(() =>
    typeof board.value === 'object' && board.value.state === 'ready' ? sift(board.value.columns, sifting.value) : [],
  );

  const shownCount = computed(() => sifted.value.reduce((n, c) => n + c.cards.length, 0));

  const sorted = computed(() => !reorders(sifting.value));

  /**
   * The task whose change is on its way to Jig, and what the last change came to when Jig refused it — with the cards
   * that changed since it was made, when the refusal was a stale revision — or, for a step on the staging flow, what Jig
   * did, with its pull request's link, and one press that follows from it. Dismissing it, or the next change, clears both.
   */
  const pending = ref<string>();
  interface Notice {
    text: string;
    changed: string[];
    url?: string;
    action?: {
      label: string;
      run: () => void;
    };
  }
  const notice = ref<Notice>();

  /**
   * Sends one change with the revision of the board it was made on, then reads the board again whatever came of it:
   * the card moves when Jig's order does, never before. `explain` words a refusal with the reasons Jig gave, where the
   * change has any to show, and may add a press that follows from it. Answers what Jig answered when it wrote.
   */
  async function write(
    task: string,
    doing: string,
    send: (revision: number) => Promise<Written | Staged>,
    explain?: (code: string, reasons: string[]) => string | Omit<Notice, 'changed'> | undefined,
  ) {
    const shown = board.value;
    if (typeof shown !== 'object' || shown.state !== 'ready' || pending.value !== undefined) return undefined;
    pending.value = task;
    notice.value = undefined;
    const res = await call(() => send(shown.revision));
    const body = res && (await res.json());
    const error = body && 'error' in body ? body.error : undefined;
    const code = error?.code;
    // The read this change started, not what the board shows: a read started after it may land in its place.
    const read = await load();
    if (code === 'stale-revision') {
      const seen = typeof read === 'object' && read.state === 'ready' ? conflict(shown.columns, read.columns, task) : undefined;
      notice.value = {
        text: `The project changed while you were ${doing} ${task}${seen ? ` — ${seen.said}` : ''}. Try again on the board as it is now.`,
        changed: seen?.changed ?? [],
      };
    } else if (error !== undefined) {
      const explained = explain?.(error.code, reasonsOf(error)) ?? refusal(error.code, doing, task);
      notice.value = typeof explained === 'string' ? { text: explained, changed: [] } : { ...explained, changed: [] };
    }
    pending.value = undefined;
    return error === undefined ? body : undefined;
  }

  const move = (task: string, place: Place) =>
    write(task, 'moving', (revision) => client.api.projects[':id'].queue.move.$post({ param, json: { task, place, revision } }));

  /** A pause asked of the task, or taken back; a task nobody started, which no stage would take a request at, is paused at once. */
  const pause = (task: string, ask: boolean) =>
    !ask
      ? write(task, 'taking back the pause request of', (revision) =>
          client.api.projects[':id'].queue.pause.cancel.$post({ param, json: { task, revision } }),
        )
      : cards.value.find((t) => t.id === task)?.pausable
        ? write(task, 'pausing', (revision) => client.api.projects[':id'].tasks.pause.$post({ param, json: { task, revision } }))
        : write(task, 'asking to pause', (revision) => client.api.projects[':id'].queue.pause.$post({ param, json: { task, revision } }));

  const resume = (task: string) =>
    write(task, 'resuming', (revision) => client.api.projects[':id'].tasks.resume.$post({ param, json: { task, revision } }));

  /** Closes a ready task as done; Jig's refusal — its pull request not merged, say — is shown in its own words. */
  const close = (task: string) =>
    write(
      task,
      'closing',
      (revision) => client.api.projects[':id'].tasks.close.$post({ param, json: { task, revision } }),
      (code, reasons) => closeRefusal(code, reasons, task),
    );

  /**
   * Lands a task's pull request on staging as the person. Jig refuses one not approved, naming whom it waits for; the
   * notice then offers to land it without review — the same write, which Jig says so on the pull request.
   */
  async function land(task: string, withoutReview = false): Promise<void> {
    const body = await write(
      task,
      STAGING_DOING.land,
      (revision) => client.api.projects[':id'].tasks.land.$post({ param, json: { task, withoutReview, revision } }),
      (code, reasons) => ({
        text: stagingRefusal(code, reasons, STAGING_DOING.land, task),
        ...(code === 'not-approved' ? { action: { label: 'Land without review', run: () => void land(task, true) } } : {}),
      }),
    );

    if (body && 'landed' in body) notice.value = { text: landedLine(task, body.landed), changed: [] };
  }

  /** Prepares a task tested on staging for prod, once asked on its card: the notice links its pull request into the base. */
  async function promote(task: string): Promise<void> {
    const body = await write(
      task,
      STAGING_DOING.promote,
      (revision) => client.api.projects[':id'].tasks.promote.$post({ param, json: { task, revision } }),
      (code, reasons) => stagingRefusal(code, reasons, STAGING_DOING.promote, task),
    );

    if (body && 'promoted' in body) {
      notice.value = { text: promotedLine(task, body.promoted), changed: [], url: link(body.promoted.pullRequest) };
    }
  }

  /**
   * Merges a task's pull request into its base, once asked on its card: the notice says whether the task closed with it.
   * Where Jig refused and the pull request is still open, the notice offers where it stands.
   */
  async function merge(task: string): Promise<void> {
    const body = await write(
      task,
      'merging',
      (revision) => client.api.projects[':id'].tasks.merge.$post({ param, json: { task, revision } }),
      (code, reasons) => ({
        text: mergeRefusal(code, reasons, task),
        ...(mergeShowsStatus(code) ? { action: { label: 'Status…', run: () => void openStatus(task) } } : {}),
      }),
    );

    if (body && 'merged' in body) notice.value = { text: mergedLine(task, body.merged), changed: [], url: link(body.merged.pullRequest) };
  }

  /** The card whose pull request's status is open, one at a time, and the forge's answer once read. */
  const prStatus = ref<{
    task: string;
    read?: PrStatus;
  }>();

  // The open card's, landing only while it is still open: closed, or opened again, meanwhile, and that one's read lands.
  const readStatus = lastWins(
    async () => {
      const task = prStatus.value?.task;
      if (task === undefined) return undefined;
      const res = await call(() =>
        client.api.projects[':id'].tasks[':task']['pr-status'].$get({ param: { ...param, task: encodeURIComponent(task) } }),
      );

      const read: PrStatus = res?.status === 200 ? (await res.json()).prStatus : { id: props.id, state: 'unreadable', code: 'failed' };
      return { task, read };
    },
    (answer) => {
      if (prStatus.value?.task === answer.task) prStatus.value = answer;
    },
  );

  /** Opens where a card's pull request stands and asks the forge, through Jig: only now, never on a timer. */
  function openStatus(task: string): Promise<unknown> {
    prStatus.value = { task };
    return readStatus();
  }

  /** The card whose review request is open, one at a time, and whom the forge offers once read. */
  const reviewing = ref<{
    task: string;
    reviewers?: Reviewers;
  }>();

  // The open card's, landing only while it is still open: closed, or opened again, meanwhile, and that one's read lands.
  const readReviewers = lastWins(
    async () => {
      const task = reviewing.value?.task;
      if (task === undefined) return undefined;
      const res = await call(() => client.api.projects[':id'].reviewers.$get({ param }));
      const reviewers: Reviewers =
        res?.status === 200 ? (await res.json()).reviewers : { id: props.id, state: 'unreadable', code: 'failed' };

      return { task, reviewers };
    },
    (answer) => {
      if (reviewing.value?.task === answer.task) reviewing.value = answer;
    },
  );

  /** Opens a card's review request and asks the forge, through Jig, whom to offer: only now, never on a timer. */
  function openReview(task: string): Promise<unknown> {
    reviewing.value = { task };
    return readReviewers();
  }

  async function askReview(task: string, logins: string[]): Promise<void> {
    // Another card's write is on its way, and this one would not be sent: the panel stays open with its ticks.
    if (pending.value !== undefined) return;
    const body = await write(
      task,
      STAGING_DOING.review,
      (revision) => client.api.projects[':id'].tasks['request-review'].$post({ param, json: { task, reviewers: logins, revision } }),
      (code, reasons) => stagingRefusal(code, reasons, STAGING_DOING.review, task),
    );

    reviewing.value = undefined;
    if (body && 'requested' in body) notice.value = { text: requestedLine(task, body.requested), changed: [] };
  }

  /** A step a card's menu took on its pull request. */
  function staging(task: string, step: StagingStep): void {
    if (step === 'land') void land(task);
    else if (step === 'promote') void promote(task);
    else if (step === 'merge') void merge(task);
    else if (step === 'status') void openStatus(task);
    else if (step === 'unstatus') prStatus.value = undefined;
    else if (step === 'review') void openReview(task);
    else if (step === 'unreview') reviewing.value = undefined;
    else void askReview(task, step.ask);
  }

  /**
   * A finished task's write from its menu, with the revision of the finished list it was chosen on; then the list and the
   * board are read again — a task brought back is live again. Jig's note, or why it refused, goes to the notice.
   */
  async function writeFinished(task: string, write: (typeof FINISHED_WRITES)[number]['write']): Promise<void> {
    const shown = finished.value;
    if (shown?.state !== 'ready' || pending.value !== undefined) return;
    pending.value = task;
    notice.value = undefined;
    const res = await call(() =>
      client.api.projects[':id'].tasks.act.$post({ param, json: { task, action: write, revision: shown.revision } }),
    );

    const body = res && (await res.json());
    await Promise.all([loadFinished(), load()]);
    if (body && 'error' in body)
      notice.value = { text: writeRefusal(body.error.code, reasonsOf(body.error), DOING[write], task), changed: [] };
    else if (body && 'note' in body && body.note) notice.value = { text: body.note, changed: [] };
    pending.value = undefined;
  }

  /** The spec the Specs view shows, kept in the address (`?spec=`) like the board's sort: the first when it names none of them. */
  const chosenSpec = computed(() =>
    typeof specs.value === 'object' && specs.value.state === 'ready'
      ? (specs.value.specs.find((s) => s.id === route.query.spec) ?? listed(specs.value.specs)[0])
      : undefined,
  );

  function chooseSpec(spec: unknown): void {
    if (typeof spec === 'string') void router.replace({ query: { ...route.query, spec } });
  }

  /** The ids of the project's specs, once read: only a card's spec among them opens, or the Specs view would show another. */
  const specIds = computed(() =>
    typeof specs.value === 'object' && specs.value.state === 'ready' ? specs.value.specs.map((s) => s.id) : [],
  );

  /** A card's spec, opened on the Specs view as a press on Specs and a choice of its row in the list would: the board's view stays in the address. */
  function openSpec(spec: string): void {
    show('specs');
    chooseSpec(spec);
  }

  /** The spec whose epic's or roadmap's change is on its way to Jig; the notice says what Jig refused, as for a task. */
  const pendingSpec = ref<string>();

  /** Sends one change of an epic with the revision of the specs it was made on, then reads them again. */
  async function writeEpic(epic: string, doing: string, send: (revision: number) => Promise<Written>): Promise<void> {
    const shown = specs.value;
    if (typeof shown !== 'object' || shown.state !== 'ready' || pendingSpec.value !== undefined) return;
    pendingSpec.value = epic;
    notice.value = undefined;
    const res = await call(() => send(shown.revision));
    const code = res && res.status !== 200 ? (await res.json()).error.code : undefined;
    await loadSpecs();
    if (code === 'stale-revision') {
      notice.value = {
        text: `The project changed while you were ${doing} epic ${epic}. Try again on the specs as they are now.`,
        changed: [],
      };
    } else if (code !== undefined) notice.value = { text: refusal(code, doing, `epic ${epic}`), changed: [] };
    pendingSpec.value = undefined;
  }

  const moveEpic = (epic: string, place: Place) =>
    writeEpic(epic, 'moving', (revision) => client.api.projects[':id'].queue.epic.move.$post({ param, json: { epic, place, revision } }));

  const prioritiseEpic = (epic: string, priority: number | null) =>
    writeEpic(epic, 'setting the priority of', (revision) =>
      client.api.projects[':id'].queue.epic.priority.$post({ param, json: { epic, priority, revision } }),
    );

  /**
   * Sends one edit of a spec's roadmap with the revision of the specs it was made on, then reads them again whatever came
   * of it — and the board, where a task filed from an item shows: an item moves when Jig's roadmap does, never before.
   * What came of it, for a person — Jig's note, or why it was refused — with the code of a refusal; `undefined` when it
   * was not sent or the server did not answer.
   */
  async function editRoadmap(
    spec: string,
    doing: string,
    send: (revision: number) => Promise<Edited>,
    explain?: (refused: Refused) => string | undefined,
  ): Promise<
    | {
        code?: string;
        text: string | null;
        taken?: boolean;
      }
    | undefined
  > {
    const shown = specs.value;
    if (typeof shown !== 'object' || shown.state !== 'ready' || pendingSpec.value !== undefined) return undefined;
    pendingSpec.value = spec;
    notice.value = undefined;
    const res = await call(() => send(shown.revision));
    const body = res && (await res.json());
    await Promise.all([loadSpecs(), load()]);
    pendingSpec.value = undefined;
    if (!body) return undefined;
    // A project no longer ready is not written: the specs read again show its state.
    if (!('error' in body)) return { text: 'note' in body ? body.note : null };
    const { code } = body.error;
    const reasons = reasonsOf(body.error);
    if (code === 'stale-revision')
      return { code, text: `The project changed while you were ${doing}. Try again on the specs as they are now.` };
    const filed = 'filed' in body.error && body.error.filed === true;
    const taken = 'taken' in body.error && body.error.taken === true;
    return { code, taken, text: explain?.({ code, reasons, filed, taken }) ?? roadmapRefusal(code, reasons, doing, spec) };
  }

  /**
   * A roadmap edit Jig refused: its code, its reasons, and for filing an item's task whether the task was filed, and
   * whether its id is a finished task's.
   */
  type Refused = {
    code: string;
    reasons: string[];
    filed: boolean;
    taken: boolean;
  };

  /** An edit made on the card: what came of it goes to the notice. */
  async function edit(
    spec: string,
    doing: string,
    send: (revision: number) => Promise<Edited>,
    explain?: (refused: Refused) => string | undefined,
  ) {
    const outcome = await editRoadmap(spec, doing, send, explain);
    if (outcome?.text) notice.value = { text: outcome.text, changed: [] };
  }

  const addItem = (spec: string, phase: number, text: string) =>
    edit(
      spec,
      `adding an item to Phase ${phase} of ${spec}`,
      (revision) => client.api.projects[':id'].specs.items.add.$post({ param, json: { spec, phase, text, revision } }),
      ({ code }) =>
        code === 'usage'
          ? 'Jig does not take this item: one line of at most 500 characters, not led by a task id — File task… names one.'
          : undefined,
    );

  const moveItem = (spec: string, item: string, place: ItemPlace) =>
    edit(spec, `moving an item of ${spec}`, (revision) =>
      client.api.projects[':id'].specs.items.move.$post({ param, json: { spec, item, place, revision } }),
    );

  /** The item whose task the File task… dialog files, and why its last try was refused — in the dialog, which stays open. */
  const filingItem = ref<{
    spec: string;
    item: SpecItem;
    refusal?: {
      text: string;
      taken: boolean;
    };
  }>();

  async function fileItem(task: string, goal: string | null): Promise<void> {
    const shown = filingItem.value;
    if (!shown?.item.id) return;
    const { spec, item } = shown;
    const id = item.id!;
    const outcome = await editRoadmap(
      spec,
      `filing the task of an item of ${spec}`,
      (revision) => client.api.projects[':id'].specs.items.file.$post({ param, json: { spec, item: id, task, goal, revision } }),
      ({ code, reasons, filed, taken }) => fileItemRefusal(code, reasons, task, filed, taken),
    );

    if (!outcome || filingItem.value !== shown) return;
    if (outcome.code === undefined) {
      filingItem.value = undefined;
      if (outcome.text) notice.value = { text: outcome.text, changed: [] };
    } else shown.refusal = { text: outcome.text ?? '', taken: outcome.taken === true };
  }

  /** The new-task form: open, its request on its way, and why the last one was refused. */
  const filing = ref(false);
  const filingBusy = ref(false);
  const filingRefusal = ref<{
    code: string;
    text: string;
  }>();

  /** Files a task — no revision: it writes nothing that exists — then reads the board, where it shows in Backlog. */
  async function file(task: string, goal: string): Promise<void> {
    if (filingBusy.value) return;
    filingBusy.value = true;
    filingRefusal.value = undefined;
    const res = await call(() => client.api.projects[':id'].tasks.$post({ param, json: { task, goal } }));
    if (res?.status === 200) filing.value = false;
    else if (res) {
      const { code } = (await res.json()).error;
      const text =
        code === 'already-exists'
          ? `The project has a task called ${task} already, maybe a finished one. Choose another id.`
          : code === 'usage'
            ? 'Jig does not take this id or goal: one line of goal, not starting with #.'
            : refusal(code, 'filing', task);

      filingRefusal.value = { code, text };
    }
    filingBusy.value = false;
    await load();
  }

  const prioritise = (task: string, priority: number | null) =>
    write(task, 'setting the priority of', (revision) =>
      client.api.projects[':id'].queue.priority.$post({ param, json: { task, priority, revision } }),
    );

  /** What waits for a decision in the project's knowledge, read only while the view shows it, and each diff and text open there. */
  const knowledge = ref<Knowledge | 'not-connected'>();
  const diffs = ref<Partial<Record<string, SourceDiff | 'reading' | 'not-found'>>>({});
  const texts = ref<Partial<Record<string, DocumentText | 'reading' | 'not-found'>>>({});
  function showKnowledge(read: Knowledge | 'not-connected'): void {
    knowledge.value = read;
    // A diff stays open while its file is still listed as changed, and is read again with the list.
    const changed = new Set(
      typeof read === 'object' && read.state === 'ready' ? read.sources.filter((s) => s.state === 'changed').map((s) => s.id) : [],
    );

    for (const doc of Object.keys(diffs.value)) {
      if (changed.has(doc)) void readDiff(doc);
      else delete diffs.value[doc];
    }
    // A document's text likewise, while the document is still proposed.
    const proposed = new Set(typeof read === 'object' && read.state === 'ready' ? read.proposals.map((p) => p.id) : []);
    for (const doc of Object.keys(texts.value)) {
      if (proposed.has(doc)) void readText(doc);
      else delete texts.value[doc];
    }
  }

  const loadKnowledge = lastWins(async () => {
    const res = await call(() => client.api.projects[':id'].knowledge.$get({ param }));
    return res && (res.status === 404 ? ('not-connected' as const) : (await res.json()).knowledge);
  }, showKnowledge);

  const noneKnown = computed(() => (typeof knowledge.value === 'object' ? noKnowledge(knowledge.value) : undefined));

  /**
   * Reads what one document shows while it is open, each document through its own `lastWins`: an older answer never
   * overwrites a newer one, and nothing lands once the document is closed.
   */
  function perDocument<T>(
    open: Ref<Partial<Record<string, T | 'reading' | 'not-found'>>>,
    read: (doc: string) => Promise<T | 'not-found' | undefined>,
  ): (doc: string) => Promise<unknown> {
    const reads = new Map<string, () => Promise<unknown>>();
    return (doc) => {
      if (open.value[doc] === undefined) open.value[doc] = 'reading';
      let run = reads.get(doc);
      if (!run) {
        run = lastWins(
          () => read(doc),
          (answer) => doc in open.value && (open.value[doc] = answer),
        );

        reads.set(doc, run);
      }
      return run();
    };
  }

  const readDiff = perDocument(diffs, async (doc) => {
    const res = await call(() =>
      client.api.projects[':id'].knowledge[':doc'].diff.$get({ param: { ...param, doc: encodeURIComponent(doc) } }),
    );

    return res && (res.status === 200 ? (await res.json()).diff : 'not-found');
  });

  function toggleDiff(doc: string, open: boolean): void {
    if (open) void readDiff(doc);
    else delete diffs.value[doc];
  }

  const readText = perDocument(texts, async (doc) => {
    const res = await call(() =>
      client.api.projects[':id'].knowledge[':doc'].text.$get({ param: { ...param, doc: encodeURIComponent(doc) } }),
    );

    return res && (res.status === 200 ? (await res.json()).text : 'not-found');
  });

  function toggleText(doc: string, open: boolean): void {
    if (open) void readText(doc);
    else delete texts.value[doc];
  }

  /**
   * Sends decisions as one write with the revision of the knowledge shown — the read after the previous write —, then
   * reads the knowledge again whatever came of it; Jig's note, or why it refused, goes to the notice. Answers whether
   * Jig wrote them: a project no longer ready writes nothing, and the knowledge read again shows its state.
   */
  async function send(decisions: DocumentDecision[]): Promise<boolean> {
    const shown = knowledge.value;
    if (typeof shown !== 'object' || shown.state !== 'ready') return false;
    notice.value = undefined;
    const res = await call(() =>
      client.api.projects[':id'].knowledge.decide.$post({ param, json: { decisions, revision: shown.revision } }),
    );

    const body = res && (await res.json());
    const read = await loadKnowledge();
    // A read the change signal started after this one lands later, if at all: until then the knowledge shown is this one,
    // so what was sent shows as waiting and the next write goes on a revision after this one's.
    if (read !== undefined && newer(read, knowledge.value)) showKnowledge(read);
    if (!body) return false;
    if ('written' in body) {
      if (body.note) notice.value = { text: body.note, changed: [] };
      return true;
    }
    if (!('error' in body)) return false;
    const { code } = body.error;
    const reasons = reasonsOf(body.error);
    const doc = 'doc' in body.error && typeof body.error.doc === 'string' ? body.error.doc : null;
    // Given back: this write's decisions and every one queued behind it.
    notice.value = { text: knowledgeRefusal(code, reasons, doc, decisions.length + deciding.queued.value.size), changed: [] };
    return false;
  }

  const deciding = useDecisions(
    send,
    () => typeof knowledge.value === 'object' && knowledge.value.state === 'ready' && knowledge.value.canDecideMany,
  );

  watch(view, (shown) => shown === 'knowledge' && void loadKnowledge());

  onUnmounted(
    onChange((project) => {
      if (project !== undefined && project !== props.id) return;
      void load();
      void loadSpecs();
      void loadWaiting();
      void loadFinished();
      void readSelected();
      if (view.value === 'knowledge') void loadKnowledge();
    }),
  );
</script>

<template>
  <div class="flex h-full flex-col">
    <Collapsible v-model:open="filing" class="shrink-0" @update:open="filingRefusal = undefined">
      <div class="flex shrink-0 items-center gap-3 border-b px-4 py-2">
        <h1 class="text-[15px] font-semibold">{{ id }}</h1>
        <Toggle v-if="finishedCount > 0" v-model="showFinished" variant="outline" size="sm">
          {{ finishedCount }} finished {{ finishedCount === 1 ? 'task' : 'tasks' }}
        </Toggle>
        <template v-if="typeof board === 'object' && board.state === 'ready'">
          <Button variant="outline" size="sm" :disabled="refresh?.state === 'running'" @click="refreshClone">{{
            refresh?.state === 'running' ? 'Refreshing…' : 'Refresh'
          }}</Button>
          <Button variant="outline" size="sm" :disabled="housekeeping?.state === 'running'" @click="housekeep">{{
            housekeeping?.state === 'running' ? 'Housekeeping…' : 'Housekeeping'
          }}</Button>
        </template>
        <Button
          v-if="typeof board === 'object'"
          variant="ghost"
          size="icon-sm"
          :aria-label="`Read ${id} again`"
          :title="`Read ${id} again`"
          :disabled="reading"
          @click="reread"
          ><RotateCw :class="reading && 'animate-spin'"
        /></Button>
        <ToggleGroup
          v-if="typeof board === 'object' && board.state === 'ready'"
          type="single"
          variant="outline"
          size="sm"
          class="ml-auto"
          aria-label="View"
          :model-value="view"
          @update:model-value="show"
        >
          <ToggleGroupItem value="board"
            ><Columns3 />Board<span v-if="counts.tasks !== undefined" class="text-muted-foreground tabular-nums">{{
              counts.tasks
            }}</span></ToggleGroupItem
          >
          <ToggleGroupItem value="list"
            ><Rows3 />List<span v-if="counts.tasks !== undefined" class="text-muted-foreground tabular-nums">{{
              counts.tasks
            }}</span></ToggleGroupItem
          >
          <ToggleGroupItem value="specs"
            ><Milestone />Specs<span v-if="counts.specs !== undefined" class="text-muted-foreground tabular-nums">{{
              counts.specs
            }}</span></ToggleGroupItem
          >
          <ToggleGroupItem value="knowledge" :aria-label="counts.knowledge ? `Knowledge, ${counts.knowledge} waiting for you` : undefined"
            ><BookCheck />Knowledge<span v-if="counts.knowledge" :class="toneText.attention" class="tabular-nums">{{
              counts.knowledge
            }}</span></ToggleGroupItem
          >
        </ToggleGroup>
        <CollapsibleTrigger v-if="typeof board === 'object' && board.state === 'ready'" as-child>
          <Button variant="outline" size="sm"><Plus />New task</Button>
        </CollapsibleTrigger>
      </div>
      <CollapsibleContent class="border-b px-4 py-3">
        <NewTaskForm :busy="filingBusy" :refusal="filingRefusal?.text" :taken="filingRefusal?.code === 'already-exists'" @file="file" />
      </CollapsibleContent>
    </Collapsible>

    <div v-if="refresh || housekeeping" class="flex shrink-0 flex-col gap-2 border-b px-4 py-2">
      <ChoreReports
        :project="id"
        :refresh="refresh"
        :housekeeping="housekeeping"
        @dismiss-refresh="refresh = undefined"
        @dismiss-housekeeping="housekeeping = undefined"
      />
    </div>

    <FinishedList
      v-if="showFinished"
      :read="finished"
      :pending="pending"
      class="max-h-48 shrink-0 overflow-y-auto border-b"
      @read-again="readFinishedAfresh"
      @write="writeFinished"
    />

    <BoardFilter
      v-if="typeof board === 'object' && board.state === 'ready' && (view === 'board' || view === 'list')"
      v-model="sifting"
      :shown="shownCount"
      :total="cards.length"
      :specs="specsOf(board.columns, sifting.specs)"
      class="shrink-0"
    />

    <p v-if="notice" role="status" class="flex shrink-0 items-center gap-2 border-b px-4 py-2 text-[13px]" :class="toneText.attention">
      {{ notice.text }}
      <a
        v-if="notice.url"
        :href="notice.url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex shrink-0 items-center gap-1 underline underline-offset-2"
      >
        open<ExternalLink class="size-3" />
      </a>
      <Button v-if="notice.action" variant="outline" size="xs" class="shrink-0 text-foreground" @click="notice.action.run()">
        {{ notice.action.label }}
      </Button>
      <button type="button" class="ml-auto underline underline-offset-2" @click="notice = undefined">dismiss</button>
    </p>

    <p v-if="board === undefined" class="p-4 text-muted-foreground">Reading the board…</p>
    <p v-else-if="board === 'not-connected'" role="alert" class="p-4 text-destructive">No connected project is called {{ id }}.</p>
    <p v-else-if="board.state !== 'ready'" class="p-4"><StateLine :project="board" :reading="reading" @read-again="reread" /></p>

    <BoardColumns
      v-else-if="view === 'board'"
      :project="id"
      :columns="sifted"
      :sorted="sorted"
      :filtered="filtered(sifting)"
      :selected="selected"
      :details="details"
      :pending="pending"
      :changed="notice?.changed"
      :specs="specIds"
      :reviewing="reviewing"
      :pr-status="prStatus"
      @toggle="(task) => (selected = selected === task ? undefined : task)"
      @move="move"
      @prioritise="prioritise"
      @pause="pause"
      @resume="resume"
      @close="close"
      @open-spec="openSpec"
      @staging="staging"
    />

    <div v-else-if="view === 'specs'" class="min-h-0 flex-1 overflow-y-auto">
      <p v-if="specs === undefined" class="p-4 text-muted-foreground">Reading the specs…</p>
      <p v-else-if="specs === 'not-connected'" role="alert" class="p-4 text-destructive">No connected project is called {{ id }}.</p>
      <p v-else-if="specs.state !== 'ready'" class="p-4"><StateLine :project="specs" :reading="reading" @read-again="reread" /></p>
      <p v-else-if="specs.specs.length === 0" class="p-4 text-muted-foreground">
        No specs in this project. A spec is written with the <code>jig-idea</code> skill and kept in <code>.ai/specs/</code>.
      </p>
      <div v-else-if="chosenSpec" class="grid gap-5 px-6 py-5 md:grid-cols-[240px_minmax(0,1fr)] md:items-start">
        <SpecList :specs="specs.specs" :chosen="chosenSpec.id" @choose="chooseSpec" />
        <SpecBoard
          :key="chosenSpec.id"
          :spec="chosenSpec"
          :project="id"
          :columns="columnOf"
          :busy="pendingSpec === chosenSpec.id"
          :editable="specs.editable"
          :disabled="pendingSpec !== undefined"
          @add="(phase, text) => addItem(chosenSpec!.id, phase, text)"
          @move="(item, place) => moveItem(chosenSpec!.id, item, place)"
          @file="(item) => (filingItem = { spec: chosenSpec!.id, item })"
        >
          <template v-if="movable(chosenSpec)" #menu>
            <EpicMenu
              :spec="chosenSpec"
              :specs="listed(specs.specs)"
              :disabled="pendingSpec !== undefined"
              @move="(place) => moveEpic(chosenSpec!.id, place)"
              @prioritise="(priority) => prioritiseEpic(chosenSpec!.id, priority)"
            />
          </template>
        </SpecBoard>
      </div>
      <FileItemDialog
        v-if="filingItem"
        :key="filingItem.item.id ?? ''"
        :open="true"
        :spec="filingItem.spec"
        :item="filingItem.item"
        :live="liveIds"
        :busy="pendingSpec !== undefined"
        :refusal="filingItem.refusal?.text"
        :taken="filingItem.refusal?.taken"
        @update:open="(open) => !open && (filingItem = undefined)"
        @file="fileItem"
      />
    </div>

    <div v-else-if="view === 'knowledge'" class="min-h-0 flex-1 overflow-y-auto">
      <p v-if="knowledge === undefined" class="p-4 text-muted-foreground">Reading the knowledge…</p>
      <p v-else-if="knowledge === 'not-connected'" role="alert" class="p-4 text-destructive">No connected project is called {{ id }}.</p>
      <p v-else-if="noneKnown" class="p-4 text-muted-foreground">{{ noneKnown }}</p>
      <KnowledgeView
        v-else-if="knowledge.state === 'ready'"
        :knowledge="knowledge"
        :diffs="diffs"
        :texts="texts"
        :queued="deciding.queued.value"
        :sending="deciding.sending.value"
        @decide="deciding.decide"
        @take-back="deciding.takeBack"
        @toggle="toggleDiff"
        @toggle-text="toggleText"
      />
    </div>

    <BoardList
      v-else
      :project="id"
      :columns="sifted"
      :sorted="sorted"
      :filtered="filtered(sifting)"
      :selected="selected"
      :details="details"
      :pending="pending"
      :changed="notice?.changed"
      :specs="specIds"
      :reviewing="reviewing"
      :pr-status="prStatus"
      @select="(task) => (selected = task)"
      @move="move"
      @prioritise="prioritise"
      @pause="pause"
      @resume="resume"
      @close="close"
      @open-spec="openSpec"
      @staging="staging"
    />
  </div>
</template>
