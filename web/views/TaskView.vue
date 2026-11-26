<script setup lang="ts">
  import ReadingLine from '@/components/ReadingLine.vue';
  import { ArrowLeft } from '@lucide/vue';
  import { computed, onUnmounted, ref, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import {
    answerGate,
    type ArtifactKind,
    call,
    client,
    onChange,
    readAgain,
    readArtifact,
    readArtifacts,
    readTask,
    type TaskArtifact,
    type TaskArtifacts,
    type TaskDetails,
  } from '@/api';
  import AgentPrompts from '@/components/AgentPrompts.vue';
  import AttentionItem from '@/components/AttentionItem.vue';
  import CopyButton from '@/components/CopyButton.vue';
  import DependsEditor from '@/components/DependsEditor.vue';
  import GateApproval from '@/components/GateApproval.vue';
  import GroupPanel from '@/components/GroupPanel.vue';
  import SpecMark from '@/components/SpecMark.vue';
  import StateLine from '@/components/StateLine.vue';
  import TaskDocuments from '@/components/TaskDocuments.vue';
  import TaskFacts from '@/components/TaskFacts.vue';
  import TaskNote from '@/components/TaskNote.vue';
  import TaskWrites from '@/components/TaskWrites.vue';
  import { Badge } from '@/components/ui/badge';
  import { landed, type OpenDocument, opened } from '@/lib/documents';
  import { lastWins } from '@/lib/last-wins';
  import { reasonsOf, writeRefusal } from '@/lib/refusal';
  import { reporter } from '@/lib/report';
  import { columnAccent, idAccent, inProgressFill, toneRule } from '@/lib/tones';
  import { agentPrompts } from '@/lib/agent-prompts';
  import { ago } from '@/lib/ago';
  import { minute } from '@/lib/clock';
  import { needsYou, timeline } from '@/lib/timeline';
  import { waits } from '@/lib/waits';
  import { dependCandidates, DOING, gateDocuments, pageWrites } from '@/lib/writes';

  const props = defineProps<{
    project: string;
    task: string;
  }>();

  const router = useRouter();
  const param = computed(() => ({ id: encodeURIComponent(props.project) }));

  const details = ref<TaskDetails | 'not-connected' | 'not-found'>();
  const ready = computed(() => (typeof details.value === 'object' && details.value.state === 'ready' ? details.value : undefined));

  const load = lastWins(
    () => readTask(props.project, props.task),
    (read) => (details.value = read),
  );

  /** Read again is under way. */
  const reading = ref(false);

  async function reread(): Promise<void> {
    reading.value = true;
    const read = await readAgain(props.project);
    reading.value = false;
    if (read) await load();
  }

  /** The task's documents Jig lists. */
  const documents = ref<TaskArtifacts | 'not-connected' | 'not-found'>();
  /** The document open in a dialog, being read or as read: one at a time. */
  const open = ref<OpenDocument<ArtifactKind, TaskArtifact>>();
  const listing = ref(false);

  const list = lastWins(
    () => readArtifacts(props.project, props.task),
    (read) => (documents.value = read),
  );

  const readDocument = lastWins(
    async () => {
      const document = open.value;
      if (!document) return undefined;
      const read = await readArtifact(props.project, props.task, document.kind);
      // A first read that did not get through is the document's own failure; a reread that fails keeps what is shown.
      if (read === undefined && open.value?.read !== 'reading') return undefined;
      return { ...document, read: read ?? ('failed' as const) };
    },
    (read) => (open.value = landed(open.value, read)),
  );

  function openDocument(kind: ArtifactKind): void {
    open.value = opened(props.task, kind);
    void readDocument();
  }

  async function relist(): Promise<void> {
    listing.value = true;
    await list();
    listing.value = false;
  }

  const note = computed(() => (ready.value ? waits(ready.value) : undefined));

  const needs = computed(() => !!ready.value && needsYou(ready.value));
  const events = computed(() => (ready.value ? timeline(ready.value) : []));

  /** The actions Jig offers that this page runs as buttons; the rest stay commands. */
  const runs = computed(() => (ready.value ? pageWrites(ready.value) : new Set<string>()));

  /** The documents Jig approves at the gate, while it offers the approval. */
  const gateKinds = computed(() => {
    if (!ready.value || !runs.value.has('approve-gate')) return [];
    const listed =
      typeof documents.value === 'object' && documents.value.state === 'ready' ? documents.value.artifacts.map((a) => a.kind) : [];

    return gateDocuments(ready.value.class, listed);
  });

  /** The design at its gate as read for the approval: each document with the revision it was read at, `null` when not read. */
  const gate = ref<
    {
      kind: ArtifactKind;
      content: string | null;
      revision: number | null;
    }[]
  >();

  const readGate = lastWins(
    () =>
      Promise.all(
        gateKinds.value.map(async (kind) => {
          const read = await readArtifact(props.project, props.task, kind);
          return typeof read === 'object' && read.state === 'ready'
            ? { kind, content: read.content, revision: read.revision }
            : { kind, content: null, revision: null };
        }),
      ),
    (read) => (gate.value = read.length > 0 ? read : undefined),
  );

  // Another task's page does not open with this one's document.
  watch(
    () => [props.project, props.task],
    () => (open.value = undefined),
  );

  watch(
    () => gateKinds.value.join(),
    () => void readGate(),
  );

  /** The part of the page whose write is under way. */
  const busy = ref<'gate' | 'task' | 'depends'>();
  /** Which press of the gate is on its way. */
  const gateSending = ref<'approve' | 'answer'>();

  /** The toast of a part's refusal: one each, replaced by the next write there, and gone with the page. */
  const refusals = {
    gate: reporter(`refusal:${props.project}:${props.task}:gate`),
    task: reporter(`refusal:${props.project}:${props.task}:task`),
    depends: reporter(`refusal:${props.project}:${props.task}:depends`),
  };

  onUnmounted(() => Object.values(refusals).forEach((r) => r.clear()));

  /** Sends one write and says whether Jig made it; a refusal is a toast that stays until closed. */
  async function send(
    at: 'gate' | 'task' | 'depends',
    doing: string,
    request: () => Promise<{
      status: number;
      json(): Promise<unknown>;
    }>,
  ): Promise<boolean> {
    busy.value = at;
    refusals[at].clear();
    const res = await call(request);
    const body =
      res &&
      ((await res.json()) as {
        written?: true;
        error?: {
          code: string;
        };
      });

    busy.value = undefined;
    if (body?.error) {
      refusals[at].show({ kind: 'error', title: writeRefusal(body.error.code, reasonsOf(body.error), doing, props.task) });
    }
    return body?.written === true;
  }

  /** Approves the design as shown, against the oldest of its documents' reads: one rewritten since is refused. */
  async function approve(): Promise<void> {
    const revisions = gate.value?.map((d) => d.revision);
    if (!revisions?.every((r) => r !== null)) return;
    const revision = Math.min(...revisions);
    gateSending.value = 'approve';
    await send('gate', DOING['approve-gate'], () =>
      client.api.projects[':id'].tasks.act.$post({ param: param.value, json: { task: props.task, action: 'approve-gate', revision } }),
    );

    await Promise.all([load(), list(), readGate()]);
  }

  /** The answer written at the gate, kept while it is sent and cleared once Jig took it. */
  const gateAnswer = ref('');

  /** Answers the design as shown instead of approving it, against the same reads an approval goes by. */
  async function answerDesign(text: string): Promise<void> {
    const revisions = gate.value?.map((d) => d.revision);
    if (!revisions?.every((r) => r !== null)) return;
    gateSending.value = 'answer';
    const done = await send('gate', DOING['answer-gate'], () => answerGate(props.project, props.task, text, Math.min(...revisions)));
    if (done) gateAnswer.value = '';
    await Promise.all([load(), list(), readGate()]);
  }

  /** Gives the task up or archives it; once Jig has, it is no longer live, and the board shows it among the finished. */
  async function putAway(write: 'abandon' | 'archive', reason?: string): Promise<void> {
    const shown = ready.value;
    if (!shown) return;
    const done = await send('task', DOING[write], () =>
      client.api.projects[':id'].tasks.act.$post({
        param: param.value,
        json: { task: props.task, action: write, reason, revision: shown.revision },
      }),
    );

    if (done) await router.push(`/projects/${encodeURIComponent(props.project)}`);
    else await load();
  }

  /** What the task may be made to wait for, read when Add… opens: the board's live tasks and the specs' open epics. */
  const candidates = ref<string[]>();
  async function choose(): Promise<void> {
    candidates.value = undefined;
    const [board, specs] = await Promise.all([
      call(() => client.api.projects[':id'].board.$get({ param: param.value })),
      call(() => client.api.projects[':id'].specs.$get({ param: param.value })),
    ]);

    const shownBoard = board?.status === 200 ? (await board.json()).board : undefined;
    const shownSpecs = specs?.status === 200 ? (await specs.json()).specs : undefined;
    candidates.value = dependCandidates(
      props.task,
      shownBoard?.state === 'ready' ? shownBoard.columns.flatMap((c) => c.cards.map((t) => t.id)) : [],
      shownSpecs?.state === 'ready' ? shownSpecs.specs.flatMap((s) => (s.epic?.state === 'open' ? [s.id] : [])) : [],
      ready.value?.dependsOn ?? [],
    );
  }

  /** The dependency editor's Add… is open. */
  const adding = ref(false);

  async function depend(on: string, reason: string): Promise<void> {
    const shown = ready.value;
    if (!shown) return;
    const done = await send('depends', DOING.depend, () =>
      client.api.projects[':id'].queue.depend.$post({
        param: param.value,
        json: { task: props.task, on, reason, revision: shown.revision },
      }),
    );

    if (done) adding.value = false;
    await load();
  }

  async function undepend(on: string): Promise<void> {
    const shown = ready.value;
    if (!shown) return;
    await send('depends', DOING.undepend, () =>
      client.api.projects[':id'].queue.undepend.$post({ param: param.value, json: { task: props.task, on, revision: shown.revision } }),
    );

    await load();
  }

  onUnmounted(
    onChange((project) => {
      if (project !== undefined && project !== props.project) return;
      void load();
      void list();
      void readGate();
      void readDocument();
    }),
  );
</script>

<template>
  <div class="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-6">
    <RouterLink
      :to="`/projects/${encodeURIComponent(project)}`"
      class="inline-flex items-center gap-1 self-start text-[13px] text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft class="size-3" />Board of {{ project }}
    </RouterLink>
    <ReadingLine v-if="details === undefined">Reading the task…</ReadingLine>
    <p v-else-if="details === 'not-connected'" role="alert" class="text-destructive">No connected project is called {{ project }}.</p>
    <p v-else-if="details === 'not-found'" role="alert" class="text-destructive">
      {{ project }} has no live task called {{ task }}. A finished task is not shown.
    </p>
    <p v-else-if="details.state !== 'ready'"><StateLine :project="details" :reading="reading" @read-again="reread" /></p>
    <!-- The task on two thirds of the page, what is known of it on the third beside: stacked on a narrow screen. -->
    <div v-else class="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div class="flex min-w-0 flex-col gap-5">
        <div class="flex flex-col gap-2.5">
          <div class="flex items-center gap-1">
            <h1 class="font-mono text-xl font-semibold break-all" :class="idAccent">{{ task }}</h1>
            <CopyButton :text="task" icon class="shrink-0 text-muted-foreground" />
          </div>
          <SpecMark v-if="details.spec" :spec="details.spec" />
          <p v-if="details.goal" class="text-base leading-relaxed text-foreground/80">{{ details.goal }}</p>
          <TaskNote v-if="note" :project="project" :note="note" link />
        </div>

        <GateApproval
          v-if="runs.has('approve-gate')"
          v-model:answer="gateAnswer"
          :answerable="runs.has('answer-gate')"
          :documents="gate"
          :busy="busy === 'gate'"
          :sending="gateSending"
          @approve="approve"
          @answer="answerDesign"
          @read-again="readGate"
        />

        <GroupPanel v-if="needs" :accent="columnAccent['needs-you']" aria-labelledby="needs-you">
          <template #head><h2 id="needs-you" class="px-4 pt-3 pb-2 text-[15px] font-semibold">Needs you</h2></template>
          <div class="flex flex-col gap-3 px-4 pb-4">
            <div v-if="details.autopilot === 'stopped' && details.run?.stopReason" :class="toneRule.attention" role="note">
              <p class="font-semibold">The autopilot asks</p>
              <p class="text-foreground">{{ details.run.stopReason }}</p>
            </div>
            <AttentionItem v-for="(item, i) in details.attention" :key="i" :item="item" />
            <ul v-if="details.housekeepingFlags.length > 0" class="flex flex-wrap items-center gap-2">
              <li class="text-[13px] text-muted-foreground">Housekeeping flags</li>
              <li v-for="flag in details.housekeepingFlags" :key="flag">
                <Badge variant="outline" class="bg-card">{{ flag }}</Badge>
              </li>
            </ul>
          </div>
        </GroupPanel>

        <TaskDocuments
          v-if="documents !== 'not-connected' && documents !== 'not-found'"
          :task="task"
          :documents="documents"
          :open="open"
          :reading="listing"
          @open="openDocument"
          @close="open = undefined"
          @read-again="relist"
        />
      </div>

      <div class="flex min-w-0 flex-col gap-4">
        <TaskWrites
          v-if="runs.has('abandon') || runs.has('archive')"
          :task="task"
          :offers="runs"
          :busy="busy === 'task'"
          @abandon="(reason) => putAway('abandon', reason)"
          @archive="putAway('archive')"
        />

        <GroupPanel aria-labelledby="details">
          <template #head><h2 id="details" class="px-4 pt-3 pb-2 text-[15px] font-semibold">Details</h2></template>
          <div class="mx-2 mb-2 rounded-lg bg-card px-3 py-2 ring-1 ring-border">
            <TaskFacts :details="details" :stop="false">
              <template #waits>
                <DependsEditor
                  v-model:adding="adding"
                  :task="task"
                  :depends-on="details.dependsOn"
                  :candidates="candidates"
                  :busy="busy === 'depends'"
                  @choose="choose"
                  @add="depend"
                  @remove="undepend"
                />
              </template>
            </TaskFacts>
          </div>
        </GroupPanel>

        <AgentPrompts :prompts="agentPrompts(details)" />

        <GroupPanel v-if="events.length > 0" aria-labelledby="timeline">
          <template #head><h2 id="timeline" class="px-4 pt-3 pb-2 text-[15px] font-semibold">Timeline</h2></template>
          <ol class="mx-2 mb-2 flex flex-col gap-2 rounded-lg bg-card px-3 py-2.5 text-[13px] ring-1 ring-border">
            <li v-for="(e, i) in events" :key="i" class="flex items-baseline gap-2.5">
              <span
                class="size-2 shrink-0 translate-y-[-1px] rounded-full"
                :class="i === 0 ? inProgressFill : 'bg-border'"
                aria-hidden="true"
              />
              <span class="flex-1">{{ e.text }}</span>
              <span class="text-xs whitespace-nowrap text-muted-foreground" :title="e.at">{{ ago(e.at, minute.getTime()) || e.at }}</span>
            </li>
          </ol>
        </GroupPanel>
      </div>
    </div>
  </div>
</template>
