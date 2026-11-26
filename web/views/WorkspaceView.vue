<script setup lang="ts">
  import ReadingLine from '@/components/ReadingLine.vue';
  import { Loader2, RotateCw } from '@lucide/vue';
  import { computed, onUnmounted, ref, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import {
    call,
    client,
    type FoundProjects as Found,
    type Machine,
    onChange,
    type PrStatus,
    type Project,
    readAgain,
    readSettings,
    runHousekeeping,
    runRefresh,
    type Settings,
  } from '@/api';
  import ConnectForm from '@/components/ConnectForm.vue';
  import FoundProjects from '@/components/FoundProjects.vue';
  import ProjectCard from '@/components/ProjectCard.vue';
  import ProjectList from '@/components/ProjectList.vue';
  import SettingsDialog from '@/components/SettingsDialog.vue';
  import UpgradeAllDialog from '@/components/UpgradeAllDialog.vue';
  import { Button } from '@/components/ui/button';
  import { Progress } from '@/components/ui/progress';
  import { lastWins } from '@/lib/last-wins';
  import {
    byName,
    chosen,
    type ClosingState,
    type HousekeepingState,
    type ItemWrite,
    landed,
    type Listed,
    readOnes,
    readProgress,
    type RefreshState,
  } from '@/lib/projects';
  import { mergedLine } from '@/lib/pr-status';
  import { type AckState, landedLine as landedOnStaging, STAGING_DOING } from '@/lib/staging';
  import { closeRefusal, mergeRefusal, reasonsOf, stagingRefusal } from '@/lib/refusal';
  import { withConnected } from '@/lib/scan';
  import { settingRefusal } from '@/lib/settings';
  import { kindOf, reporter } from '@/lib/report';
  import { toneText } from '@/lib/tones';
  import {
    landedLine,
    machineBusy,
    machineLine,
    mergeWaitOf,
    type PlanState,
    releaseOf,
    upgradeAllPlan,
    upgradeLine,
    upgradeOf,
  } from '@/lib/upgrade';

  const route = useRoute();
  const router = useRouter();
  /** The connected projects, by name; on the first load each is listed before its read lands. */
  const projects = ref<Listed[]>();
  /** The projects read so far: what the upgrade lines and Upgrade all are worked out over. */
  const read = computed(() => readOnes(projects.value ?? []));
  const progress = computed(() => readProgress(projects.value ?? []));
  /** The project whose card is shown beside the list: `?project=` in the address, else the one `chosen` picks. */
  const shown = computed(() => chosen(projects.value ?? [], typeof route.query.project === 'string' ? route.query.project : undefined));
  const machine = ref<Machine>();
  const path = ref('');
  const busy = ref(false);
  /** Each card's open upgrade panel, by project id, until the upgrade starts or the panel closes. */
  const plans = ref<Record<string, PlanState>>({});
  /** Refresh run from each card, until dismissed; a reload forgets it. */
  const refreshes = ref<Record<string, RefreshState>>({});
  const acks = ref<Record<string, AckState>>({});
  /** Housekeeping run from each card, until dismissed; a reload forgets it. */
  const housekept = ref<Record<string, HousekeepingState>>({});
  /** A task closed, merged or landed from each card's items, while Jig writes it and, after, until dismissed. */
  const closing = ref<Record<string, ClosingState>>({});

  // A finished report is shown once, as a toast on its project's card: another project shown, it is dropped, so it does
  // not come back each time the first one is shown again. A run still under way is kept, and reports when it ends.
  watch(
    () => shown.value?.id,
    (_, left) => {
      if (left === undefined) return;
      if (housekept.value[left]?.state !== 'running') delete housekept.value[left];
      if (refreshes.value[left]?.state !== 'running') delete refreshes.value[left];
      if (closing.value[left]?.state !== 'running') delete closing.value[left];
    },
  );

  /** The pull request whose status is open under its item on each card, and the forge's answer once read. */
  const statuses = ref<
    Record<
      string,
      {
        task: string;
        read?: PrStatus;
      }
    >
  >({});

  const upgrades = computed(() => projects.value && upgradeLine(read.value));
  /** Upgrade all's confirmation is open. */
  const confirmingAll = ref(false);
  const release = computed(() => machine.value?.release ?? null);
  const allPlan = computed(() => upgradeAllPlan(read.value, release.value));
  /** No card starts an upgrade while a self-update or Upgrade all runs, nor before the machine is read. */
  const held = computed(() => machineBusy(machine.value));
  // Upgrade all waits for every upgrade under way: they run one at a time; and for every read, or its list is short.
  const offerAll = computed(
    () => allPlan.value.projects.length > 0 && !held.value && !progress.value && !read.value.some((p) => p.upgrade?.state === 'running'),
  );

  const said = computed(() => machineLine(machine.value, read.value));
  /** Projects whose upgrade waits for its pull request: Check all merges is offered while any does. */
  const offerLandAll = computed(
    () => !held.value && read.value.some((p) => mergeWaitOf(p) !== undefined && p.upgrade?.state !== 'running'),
  );

  /** Check all merges is under way. */
  const landingAll = ref(false);
  // A confirmation or a refusal of Upgrade all belongs to the moment it was asked: a run from another tab ends both.
  watch(offerAll, (offered) => {
    if (!offered) confirmingAll.value = false;
    else upgradeAllRefused.clear();
  });

  // What came of each action is a toast, replaced by the next one of its kind and gone with the page.
  const upgradingAll = reporter('upgrade-all', () => void dismissAll());
  const upgradeAllRefused = reporter('upgrade-all:refused');
  const landingAllReport = reporter('land-all');
  const connectReport = reporter('connect');
  const findReport = reporter('find');
  const settingReport = reporter('settings');
  const landReports = new Map<string, ReturnType<typeof reporter>>();
  const landReport = (id: string) => {
    let r = landReports.get(id);
    if (!r) landReports.set(id, (r = reporter(`land:${id}`)));
    return r;
  };

  // Upgrade all's run and end, and a self-update's, in one toast: while it runs, a spinner; ended, what it came to, and
  // closing it dismisses the report. The page reads the machine again on every change; the toast is drawn when its words change.
  let saidKey = '';
  watch(
    said,
    (line) => {
      const key = JSON.stringify(line ?? null);
      if (key === saidKey) return;
      saidKey = key;
      if (!line) return upgradingAll.clear();
      if (!line.ended) return upgradingAll.show({ kind: 'loading', title: line.text });
      upgradingAll.show({
        kind: kindOf(line.tone),
        title: line.text,
        description: line.reasons.map((r) => `• ${r}`).join('\n') || undefined,
        descriptionClass: 'whitespace-pre-line',
      });
    },
    { immediate: true },
  );

  const load = lastWins(
    async () => (await (await call(() => client.api.workspace.$get()))?.json()) ?? undefined,
    (read) => {
      if (!read) return;
      projects.value = byName(read.projects);
      machine.value = read.machine;
    },
  );

  /**
   * The first load: the connected ids at once, then each project as its own read lands, so one slow project holds no
   * other. The workspace read, for the machine's state, starts after them: it waits for the slowest project anyway, and
   * a browser opens six connections to a site, two of them held that long by the stream and the header's read.
   */
  async function first(): Promise<void> {
    const ids = (await (await call(() => client.api.projects.$get()))?.json())?.projects;
    if (ids && !projects.value) {
      projects.value = byName(ids.map((id) => ({ id, state: 'reading' as const })));
      await Promise.allSettled(
        ids.map(async (id) => {
          const res = await call(() => client.api.projects[':id'].$get({ param: { id: encodeURIComponent(id) } }));
          if (res?.status !== 200) return;
          const { project } = await res.json(); // before the list is read: another read may land while this body is parsed
          projects.value = landed(projects.value ?? [], project);
        }),
      );
    }
    await load();
  }

  /** Connects a path; the project's id, or why it was refused. */
  async function connectPath(target: string): Promise<
    | {
        id: string;
      }
    | {
        refused: string;
      }
    | undefined
  > {
    const res = await call(() => client.api.projects.$post({ json: { path: target } }));
    if (!res) return undefined;
    if (res.status !== 200 && res.status !== 201) return { refused: (await res.json()).error.message };
    return { id: (await res.json()).project.id };
  }

  /** The project just connected is the one shown, wherever it falls in the list. */
  async function show(id: string): Promise<void> {
    await router.replace({ query: { project: id } });
    await load();
  }

  async function connect(): Promise<void> {
    busy.value = true;
    connectReport.clear();
    const done = await connectPath(path.value);
    busy.value = false;
    if (!done) return;
    if ('refused' in done) return void connectReport.show({ kind: 'error', title: done.refused });
    path.value = '';
    await show(done.id);
  }

  /** What Find projects last found, until it is pressed again, and the found project being connected. */
  const found = ref<Found>();
  const finding = ref(false);
  const connecting = ref<string>();

  async function find(folder: string): Promise<void> {
    finding.value = true;
    findReport.clear();
    connectReport.clear();
    const res = await call(() => client.api.scan.$post({ json: { folder } }));
    finding.value = false;
    if (!res) return;
    if (res.status !== 200) {
      found.value = undefined;
      findReport.show({ kind: 'error', title: (await res.json()).error.message });
      return;
    }
    found.value = await res.json();
  }

  async function connectFound(target: string): Promise<void> {
    connecting.value = target;
    connectReport.clear();
    const done = await connectPath(target);
    connecting.value = undefined;
    if (!done) return;
    if ('refused' in done) return void connectReport.show({ kind: 'error', title: done.refused, description: target });
    if (found.value) found.value = withConnected(found.value, target);
    await show(done.id);
  }

  async function disconnect(id: string): Promise<void> {
    if (await call(() => client.api.projects[':id'].$delete({ param: { id: encodeURIComponent(id) } }))) await load();
  }

  /** The projects whose Read again is under way. */
  const reading = ref(new Set<string>());

  async function reread(id: string): Promise<void> {
    reading.value.add(id);
    const read = await readAgain(id);
    reading.value.delete(id);
    if (read) await load();
  }

  /** Read again for every connected project at once, from the page's header. */
  async function rereadAll(): Promise<void> {
    const ids = (projects.value ?? []).map((p) => p.id);
    for (const id of ids) reading.value.add(id);
    const read = await Promise.all(ids.map(readAgain));
    for (const id of ids) reading.value.delete(id);
    if (read.some(Boolean)) await load();
  }

  /** The project whose settings dialog is open, its settings (`undefined` while read), the key being written and what came of the last change is a toast. */
  const settingsFor = ref<string>();
  const settings = ref<Settings>();
  const settingKey = ref<string>();
  const settingsReading = ref(false);

  const loadSettings = lastWins(
    async () => {
      const id = settingsFor.value;
      if (id === undefined) return undefined;
      const read = await readSettings(id);
      return read === undefined ? undefined : { id, read };
    },
    ({ id, read }) => {
      if (id !== settingsFor.value) return;
      if (read === 'not-connected') settingsFor.value = undefined;
      else settings.value = read;
    },
  );

  function openSettings(id: string): void {
    settingsFor.value = id;
    settings.value = undefined;
    settingKey.value = undefined;
    settingReport.clear();
    void loadSettings();
  }

  async function rereadSettings(): Promise<void> {
    settingsReading.value = true;
    await loadSettings();
    settingsReading.value = false;
  }

  const settingsApi = client.api.projects[':id'].settings;

  /** Sends one change of a setting with the revision of the settings shown, then reads them again whatever came of it. */
  async function writeSetting(
    key: string,
    send: (id: string, revision: number) => ReturnType<typeof settingsApi.$post | typeof settingsApi.unset.$post>,
  ): Promise<void> {
    const [id, shown] = [settingsFor.value, settings.value];
    if (id === undefined || shown?.state !== 'ready' || settingKey.value !== undefined) return;
    settingKey.value = key;
    settingReport.clear();
    const res = await call(() => send(id, shown.revision));
    const error = res && res.status !== 200 ? (await res.json()).error : undefined;
    await loadSettings();
    // The dialog closed, or shows another project, since: what came of this write is not its to show.
    if (settingsFor.value !== id) return;
    settingKey.value = undefined;
    if (error?.code === 'stale-revision')
      settingReport.show({ kind: 'warning', title: 'The settings changed since they were shown: here they are as they are now.' });
    else if (error) settingReport.show({ kind: 'error', title: settingRefusal(error.code, reasonsOf(error), key) });
  }

  const setSetting = (key: string, value: string) =>
    writeSetting(key, (id, revision) => settingsApi.$post({ param: { id: encodeURIComponent(id) }, json: { key, value, revision } }));

  const unsetSetting = (key: string) =>
    writeSetting(key, (id, revision) => settingsApi.unset.$post({ param: { id: encodeURIComponent(id) }, json: { key, revision } }));

  const upgradeApi = client.api.projects[':id'].upgrade;
  const param = (id: string) => ({ param: { id: encodeURIComponent(id) } });

  /** Upgrade on a card: Jig's plan when the machine's Jig is ahead, or first the question to update it when a release is out. */
  function start(project: Project): void {
    const out = releaseOf(project, release.value);
    if (upgradeOf(project) === undefined && out !== undefined) plans.value[project.id] = { state: 'confirm-self-update', release: out };
    else void plan(project.id);
  }

  /** Updates this machine's Jig, as the card's panel asked, then asks Jig for the project's plan. */
  async function selfUpdate(id: string): Promise<void> {
    plans.value[id] = { state: 'self-updating' };
    const res = await call(() => client.api['self-update'].$post());
    if (!res) return void delete plans.value[id];
    if (res.status === 200) {
      await load();
      return plan(id);
    }
    const { error } = (await res.json()) as {
      error: {
        message: string;
        reasons?: string[];
      };
    };

    plans.value[id] = { state: 'refused', message: error.message, reasons: error.reasons ?? [] };
    await load();
  }

  /** Starts Upgrade all; the page follows it through the workspace, as it follows each project's upgrade. */
  async function upgradeAll(): Promise<void> {
    confirmingAll.value = false;
    upgradeAllRefused.clear();
    plans.value = {}; // an open plan would offer an upgrade Upgrade all is about to run
    const res = await call(() => client.api['upgrade-all'].$post());
    if (!res) return;
    if (res.status === 409) upgradeAllRefused.show({ kind: 'error', title: (await res.json()).error.message });
    await load();
  }

  /** The projects whose Check merge is being asked. */
  const checking = ref(new Set<string>());

  /** Check merge on a card: Jig lands the upgrade if its pull request is merged; the card shows what came of it. */
  async function land(id: string): Promise<void> {
    checking.value.add(id);
    landReport(id).clear();
    const res = await call(() => upgradeApi.land.$post(param(id)));
    if (res && res.status !== 200) landReport(id).show({ kind: 'error', title: (await res.json()).error.message });
    await load();
    checking.value.delete(id);
  }

  /** Check all merges: every upgrade pull request in turn; each card shows its outcome, the line sums them up. */
  async function landAll(): Promise<void> {
    landingAll.value = true;
    landingAllReport.clear();
    const res = await call(() => client.api.upgrade['land-all'].$post());
    if (!res) return void (landingAll.value = false);
    const body = await res.json();
    if ('landed' in body) landingAllReport.show({ kind: 'success', title: landedLine(body.landed) });
    else landingAllReport.show({ kind: 'error', title: body.error.message });
    await load();
    landingAll.value = false;
  }

  async function dismissAll(): Promise<void> {
    if (await call(() => client.api['upgrade-all'].$delete())) await load();
  }

  /** A refusal as the API answers it: the page's line and Jig's own reasons, when it gave any. */
  interface Refused {
    message: string;
    reasons?: string[];
  }

  /** A refusal for the card's panel. */
  const refusedPlan = (error: Refused): PlanState => ({
    state: 'refused',
    message: error.message,
    reasons: error.reasons ?? [],
  });

  /** Housekeeping on a card: Jig tidies the project, and the card shows its report until dismissed. */
  async function housekeep(id: string): Promise<void> {
    housekept.value[id] = { state: 'running' };
    const ran = await runHousekeeping(id);
    if (ran) housekept.value[id] = ran;
    else delete housekept.value[id];
    await load();
  }

  /** Mark as known on a card's bell: Jig marks the person's own commits on staging, those the card showed. */
  async function ackStaging(id: string, expect: number, shas: string[]): Promise<void> {
    acks.value[id] = { state: 'running' };
    const res = await call(() => client.api.projects[':id'].staging.ack.$post({ ...param(id), json: { expect, shas } }));
    if (!res) return void delete acks.value[id];
    const body = await res.json();
    if ('error' in body) acks.value[id] = { state: 'refused', message: body.error.message, reasons: reasonsOf(body.error) };
    else delete acks.value[id]; // marked, or the project cannot be read now: its card says which
    await load();
  }

  /** Refresh on a card: Jig brings the clone up to origin, and the card says what came of it until dismissed. */
  async function refreshClone(id: string): Promise<void> {
    refreshes.value[id] = { state: 'running' };
    const ran = await runRefresh(id);
    if (ran) refreshes.value[id] = ran;
    else delete refreshes.value[id];
    await load();
  }

  /**
   * Closes a merged task, merges a task's pull request or lands it on staging from its item on the card, with the
   * revision of the read the card shows, as its card on the board does; what Jig did, or its refusal in words, stays on
   * the card. A landing refused as not approved sends to the Board, which lands one without review.
   */
  async function writeTask(id: string, task: string, write: ItemWrite): Promise<void> {
    const project = projects.value?.find((p) => p.id === id);
    if (project?.state !== 'ready' || closing.value[id]?.state === 'running') return;
    closing.value[id] = { task, write, state: 'running' };
    const json = { task, revision: project.revision };
    const tasks = client.api.projects[':id'].tasks;
    const res =
      write === 'close'
        ? await call(() => tasks.close.$post({ ...param(id), json }))
        : write === 'merge'
          ? await call(() => tasks.merge.$post({ ...param(id), json }))
          : await call(() => tasks.land.$post({ ...param(id), json: { ...json, withoutReview: false } }));

    const body = res && (await res.json());
    const error = body && 'error' in body ? body.error : undefined;
    if (error !== undefined) {
      const reasons = reasonsOf(error);
      const message =
        write === 'close'
          ? closeRefusal(error.code, reasons, task)
          : write === 'merge'
            ? mergeRefusal(error.code, reasons, task)
            : stagingRefusal(error.code, reasons, STAGING_DOING.land, task);

      closing.value[id] = { task, write, state: 'refused', message, board: write === 'land' && error.code === 'not-approved' };
    }
    // A write that went through stays running until the read after it has landed, as the board's does.
    await load();
    if (error !== undefined) return;
    if (body && 'merged' in body) closing.value[id] = { task, write, state: 'done', message: mergedLine(task, body.merged) };
    else if (body && 'landed' in body) closing.value[id] = { task, write, state: 'done', message: landedOnStaging(task, body.landed) };
    else delete closing.value[id];
  }

  /** Opens where an item's pull request stands and asks the forge, through Jig: only now, never on a timer. */
  async function openStatus(id: string, task: string): Promise<void> {
    statuses.value[id] = { task };
    const res = await call(() =>
      client.api.projects[':id'].tasks[':task']['pr-status'].$get({
        param: { id: encodeURIComponent(id), task: encodeURIComponent(task) },
      }),
    );

    const read: PrStatus = res?.status === 200 ? (await res.json()).prStatus : { id, state: 'unreadable', code: 'failed' };
    // Closed, or opened on another item, meanwhile: that one stays.
    if (statuses.value[id]?.task === task && statuses.value[id].read === undefined) statuses.value[id] = { task, read };
  }

  /** Opens the card's upgrade panel with Jig's dry run of the upgrade. */
  async function plan(id: string): Promise<void> {
    plans.value[id] = { state: 'reading' };
    const res = await call(() => upgradeApi.plan.$post(param(id)));
    if (!res) return void delete plans.value[id];
    const body = await res.json();
    if ('plan' in body) plans.value[id] = { state: 'planned', plan: body.plan };
    else if ('error' in body) plans.value[id] = refusedPlan(body.error);
    else {
      delete plans.value[id]; // the project cannot be read now: its card says why
      await load();
    }
  }

  /** Starts the upgrade; the card follows it through the workspace, which the change stream reads again. */
  async function upgrade(id: string): Promise<void> {
    const res = await call(() => upgradeApi.$post(param(id)));
    if (!res) return;
    const body = await res.json();
    if ('error' in body) plans.value[id] = refusedPlan(body.error);
    else delete plans.value[id];
    await load();
  }

  async function dismiss(id: string): Promise<void> {
    if (await call(() => upgradeApi.$delete(param(id)))) await load();
  }

  // The toasts belong to the page: they go with it.
  onUnmounted(() => {
    for (const r of [upgradingAll, upgradeAllRefused, landingAllReport, connectReport, findReport, settingReport, ...landReports.values()])
      r.clear();
  });

  onUnmounted(onChange(() => void (projects.value === undefined ? first() : load())));
</script>

<template>
  <div class="mx-auto flex max-w-6xl flex-col gap-5 px-6 py-6">
    <div class="flex items-center gap-3">
      <h1 class="text-xl font-semibold">Projects</h1>
      <div class="ml-auto flex items-center gap-2">
        <Button
          v-if="projects?.length"
          variant="ghost"
          size="icon-xs"
          aria-label="Read every project again"
          title="Read every project again"
          :disabled="reading.size > 0"
          @click="rereadAll"
          ><RotateCw :class="reading.size > 0 && 'animate-spin'"
        /></Button>
        <Button v-if="offerLandAll || landingAll" variant="outline" size="xs" :disabled="landingAll" @click="landAll"
          ><Loader2 v-if="landingAll" class="animate-spin" />{{ landingAll ? 'Checking…' : 'Check all merges' }}</Button
        >
        <Button v-if="offerAll && !confirmingAll" variant="outline" size="xs" @click="confirmingAll = true">Upgrade all…</Button>
      </div>
    </div>
    <p v-if="upgrades" :class="toneText.attention">{{ upgrades }}</p>
    <UpgradeAllDialog
      v-if="confirmingAll && offerAll"
      :self-update="allPlan.selfUpdate"
      :projects="allPlan.projects"
      @upgrade="upgradeAll"
      @close="confirmingAll = false"
    />
    <div class="flex flex-col gap-4 border-b pb-5">
      <ConnectForm v-model="path" :busy="busy" :finding="finding" @connect="connect" @find="find" />
      <FoundProjects v-if="found" :result="found" :connecting="connecting" @connect="connectFound" />
    </div>
    <ReadingLine v-if="projects === undefined">Reading projects…</ReadingLine>
    <p v-else-if="projects.length === 0" class="text-muted-foreground">
      No projects yet. Paste the path of a project's main checkout above.
    </p>
    <div v-if="progress" class="flex flex-col gap-1" role="status">
      <p class="text-muted-foreground">Reading projects: {{ progress.read }} of {{ progress.of }}</p>
      <Progress :model-value="(progress.read / progress.of) * 100" aria-label="Projects read" />
    </div>
    <!-- One column on a narrow screen: the list above the card. -->
    <div v-if="projects?.length" class="flex flex-col gap-4 md:flex-row md:items-start">
      <ProjectList :projects="projects" :chosen="shown?.id" class="md:w-64 md:shrink-0" />
      <ReadingLine v-if="shown?.state === 'reading'" class="min-w-0 flex-1">Reading {{ shown.id }}…</ReadingLine>
      <ProjectCard
        v-else-if="shown"
        :key="shown.id"
        :project="shown"
        :plan="plans[shown.id]"
        :held="held"
        :checking="checking.has(shown.id)"
        :release="release"
        :reading="reading.has(shown.id)"
        :housekeeping="housekept[shown.id]"
        :refresh="refreshes[shown.id]"
        :ack="acks[shown.id]"
        :closing="closing[shown.id]"
        :pr-status="statuses[shown.id]"
        class="min-w-0 flex-1"
        @settings="openSettings(shown.id)"
        @disconnect="disconnect(shown.id)"
        @read-again="reread(shown.id)"
        @start="start(shown)"
        @self-update="selfUpdate(shown.id)"
        @upgrade="upgrade(shown.id)"
        @land="land(shown.id)"
        @close="delete plans[shown.id]"
        @dismiss="dismiss(shown.id)"
        @housekeeping="housekeep(shown.id)"
        @dismiss-housekeeping="delete housekept[shown.id]"
        @refresh="refreshClone(shown.id)"
        @dismiss-refresh="delete refreshes[shown.id]"
        @ack-staging="(n, shas) => ackStaging(shown!.id, n, shas)"
        @dismiss-ack="delete acks[shown.id]"
        @close-task="(task) => writeTask(shown!.id, task, 'close')"
        @merge-task="(task) => writeTask(shown!.id, task, 'merge')"
        @land-task="(task) => writeTask(shown!.id, task, 'land')"
        @dismiss-close="delete closing[shown.id]"
        @open-status="(task) => openStatus(shown!.id, task)"
        @close-status="delete statuses[shown.id]"
      />
    </div>
    <SettingsDialog
      v-if="settingsFor !== undefined"
      :open="true"
      :project="settingsFor"
      :settings="settings"
      :pending="settingKey"
      :reading="settingsReading"
      @update:open="(open) => open || (settingsFor = undefined)"
      @set="setSetting"
      @unset="unsetSetting"
      @read-again="rereadSettings"
    />
  </div>
</template>
