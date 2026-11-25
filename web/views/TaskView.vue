<script setup lang="ts">
  import { ArrowLeft } from '@lucide/vue';
  import { computed, onUnmounted, ref, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import {
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
  import ActionList from '@/components/ActionList.vue';
  import AttentionItem from '@/components/AttentionItem.vue';
  import CopyButton from '@/components/CopyButton.vue';
  import DependsEditor from '@/components/DependsEditor.vue';
  import GateApproval from '@/components/GateApproval.vue';
  import GroupPanel from '@/components/GroupPanel.vue';
  import StateLine from '@/components/StateLine.vue';
  import TaskDocuments from '@/components/TaskDocuments.vue';
  import TaskFacts from '@/components/TaskFacts.vue';
  import TaskWrites from '@/components/TaskWrites.vue';
  import { Badge } from '@/components/ui/badge';
  import { landed, type OpenDocument, opened } from '@/lib/documents';
  import { lastWins } from '@/lib/last-wins';
  import { reasonsOf, writeRefusal } from '@/lib/refusal';
  import { columnAccent, toneRule } from '@/lib/tones';
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

  /** The part of the page whose write is under way, and the refusal of the last write, where it was made. */
  const busy = ref<'gate' | 'task' | 'depends'>();
  const refused = ref<{
    at: 'gate' | 'task' | 'depends';
    text: string;
  }>();

  /** Sends one write and says whether Jig made it; a refusal is worded where the write was made. */
  async function send(
    at: 'gate' | 'task' | 'depends',
    doing: string,
    request: () => Promise<{
      status: number;
      json(): Promise<unknown>;
    }>,
  ): Promise<boolean> {
    busy.value = at;
    refused.value = undefined;
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
    if (body?.error) refused.value = { at, text: writeRefusal(body.error.code, reasonsOf(body.error), doing, props.task) };
    return body?.written === true;
  }

  /** Approves the design as shown, against the oldest of its documents' reads: one rewritten since is refused. */
  async function approve(): Promise<void> {
    const revisions = gate.value?.map((d) => d.revision);
    if (!revisions?.every((r) => r !== null)) return;
    const revision = Math.min(...revisions);
    await send('gate', DOING['approve-gate'], () =>
      client.api.projects[':id'].tasks.act.$post({ param: param.value, json: { task: props.task, action: 'approve-gate', revision } }),
    );

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
  <div class="mx-auto flex max-w-3xl flex-col gap-5 px-6 py-6">
    <RouterLink
      :to="`/projects/${encodeURIComponent(project)}`"
      class="inline-flex items-center gap-1 self-start text-[13px] text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft class="size-3" />board of {{ project }}
    </RouterLink>
    <div class="flex items-center gap-3">
      <h1 class="font-mono text-lg font-semibold break-all">{{ task }}</h1>
      <CopyButton :text="task" label="copy id" />
      <Badge v-if="ready?.class" variant="outline">{{ ready.class }}</Badge>
    </div>
    <p v-if="details === undefined" class="text-muted-foreground">Reading the task…</p>
    <p v-else-if="details === 'not-connected'" role="alert" class="text-destructive">No connected project is called {{ project }}.</p>
    <p v-else-if="details === 'not-found'" role="alert" class="text-destructive">
      {{ project }} has no live task called {{ task }}. A finished task is not shown.
    </p>
    <p v-else-if="details.state !== 'ready'"><StateLine :project="details" :reading="reading" @read-again="reread" /></p>
    <template v-else>
      <p v-if="details.goal" class="text-base">{{ details.goal }}</p>
      <p v-if="note" :class="toneRule[note.tone]">{{ note.text }}</p>

      <GateApproval
        v-if="runs.has('approve-gate')"
        :documents="gate"
        :busy="busy === 'gate'"
        :refusal="refused?.at === 'gate' ? refused.text : undefined"
        @approve="approve"
        @read-again="readGate"
      />

      <GroupPanel>
        <TaskFacts :details="details" class="px-4 py-3">
          <template v-if="details.writes" #waits>
            <DependsEditor
              v-model:adding="adding"
              :task="task"
              :depends-on="details.dependsOn"
              :candidates="candidates"
              :busy="busy === 'depends'"
              :refusal="refused?.at === 'depends' ? refused.text : undefined"
              @choose="choose"
              @add="depend"
              @remove="undepend"
            />
          </template>
        </TaskFacts>
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

      <GroupPanel v-if="details.attention.length > 0" :accent="columnAccent['needs-you']" aria-labelledby="needs-you">
        <template #head><h2 id="needs-you" class="px-4 pt-3 pb-2 text-[15px] font-semibold">Needs you</h2></template>
        <div class="flex flex-col gap-3 px-4 pb-4">
          <AttentionItem v-for="(item, i) in details.attention" :key="i" :item="item" />
        </div>
      </GroupPanel>

      <GroupPanel v-if="details.housekeepingFlags.length > 0" aria-labelledby="flags">
        <template #head><h2 id="flags" class="px-4 pt-3 pb-2 text-[15px] font-semibold">Housekeeping flags</h2></template>
        <ul class="flex flex-wrap gap-2 px-4 pb-4">
          <li v-for="flag in details.housekeepingFlags" :key="flag">
            <Badge variant="outline" class="bg-card">{{ flag }}</Badge>
          </li>
        </ul>
      </GroupPanel>

      <GroupPanel aria-labelledby="actions">
        <template #head><h2 id="actions" class="px-4 pt-3 pb-2 text-[15px] font-semibold">What Jig offers now</h2></template>
        <div class="flex flex-col gap-3 px-4 pb-4">
          <TaskWrites
            v-if="runs.has('abandon') || runs.has('archive')"
            :task="task"
            :offers="runs"
            :busy="busy === 'task'"
            :refusal="refused?.at === 'task' ? refused.text : undefined"
            @abandon="(reason) => putAway('abandon', reason)"
            @archive="putAway('archive')"
          />
          <ActionList :actions="details.actions" :project="project" :task="task" :runs="runs" :writes="details.writes" />
          <p class="text-[13px] text-muted-foreground">Run a command in the project; this page follows what changes.</p>
        </div>
      </GroupPanel>
    </template>
  </div>
</template>
