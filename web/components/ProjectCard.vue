<script setup lang="ts">
  import { computed, onUnmounted, ref, watch } from 'vue';
  import { useRouter } from 'vue-router';
  import { Bell, BellDot, ExternalLink, Loader2, Settings, Unplug } from '@lucide/vue';
  import { link, type PrStatus, type Project } from '@/api';
  import { Button } from '@/components/ui/button';
  import { Card } from '@/components/ui/card';
  import { whoMerges } from '@/lib/pr-status';
  import { type ClosingState, closableTask, type HousekeepingState, type RefreshState } from '@/lib/projects';
  import { staleFetch } from '@/lib/refresh';
  import { reporter } from '@/lib/report';
  import { type AckState, bellOf, listed } from '@/lib/staging';
  import { toneRule, toneText } from '@/lib/tones';
  import { mergeWaitOf, needsUpgrade, type PlanState, upgradeMark } from '@/lib/upgrade';
  import AttentionItem from './AttentionItem.vue';
  import ChoreReports from './ChoreReports.vue';
  import StagingWork from './StagingWork.vue';
  import StateLine from './StateLine.vue';
  import UpgradePanel from './UpgradePanel.vue';

  const props = defineProps<{
    project: Project;
    /** Check merge is being asked, before the run shows on the card. */
    checking?: boolean;
    /** The upgrade panel before a run, when it is open. */
    plan?: PlanState;
    /** A self-update or Upgrade all is under way: no upgrade starts from the card meanwhile. */
    held?: boolean;
    /** The newest Jig release a connected project names: a project older than it has an upgrade to make too. */
    release?: string | null;
    /** Its Read again is under way. */
    reading?: boolean;
    /** Housekeeping from the card: under way, or what came of it until dismissed. */
    housekeeping?: HousekeepingState;
    /** A task closed, merged or landed from one of the card's items: under way, or what came of it until dismissed. */
    closing?: ClosingState;
    /** The task whose pull request's status is open under its item, and the forge's answer once read. */
    prStatus?: {
      task: string;
      read?: PrStatus;
    };
    /** Refresh from the card: under way, or what came of it until dismissed. */
    refresh?: RefreshState;
    /** Mark as known on the bell's list: under way, or what Jig refused until dismissed. */
    ack?: AckState;
  }>();

  const board = computed(() => `/projects/${encodeURIComponent(props.project.id)}`);

  /** The item whose question is open: held by its kind and task, so a list that shifts under it never moves it to another. */
  const asking = ref<string>();
  const keyOf = (item: {
    kind: string;
    subject: {
      id: string | null;
    };
  }) => `${item.kind}:${item.subject.id ?? ''}`;

  const mark = computed(() => upgradeMark(props.project));
  /** The clone last fetched more than a day ago; its Refresh is beside it unless Jig's behind-origin item has one. */
  const stale = computed(() => (props.project.state === 'ready' ? staleFetch(props.project.origin) : undefined));
  const behind = computed(() => props.project.state === 'ready' && props.project.attention.some((a) => a.kind === 'base-behind-origin'));
  const merge = computed(() => mergeWaitOf(props.project));
  const bell = computed(() => bellOf(props.project));
  /** The bell's list is open; it closes when the bell goes dark, so a new commit of the person's lights it shut. */
  const showing = ref(false);
  watch(bell, (b) => {
    if (typeof b !== 'object') showing.value = false;
  });

  /** What needs the person, without the work on staging the bell says. */
  const items = computed(() => (props.project.state === 'ready' ? listed(props.project.attention) : []));
  // Check merge while the upgrade waits and nothing runs on the card.
  const checkable = computed(() => merge.value !== undefined && props.project.upgrade?.state !== 'running' && !props.held);
  // Offered on a project with an upgrade to make — now, or after a self-update — and nothing about one on the card yet.
  const upgradable = computed(
    () => needsUpgrade(props.project, props.release ?? null) && !props.project.upgrade && !props.plan && !props.held,
  );

  const emit = defineEmits<{
    /** Settings…, an icon on the card: the view opens the dialog and reads them. */
    settings: [];
    disconnect: [];
    readAgain: [];
    /** Upgrade on the card: the view asks Jig for the plan, or first to update this machine's Jig. */
    start: [];
    selfUpdate: [];
    upgrade: [];
    /** Check merge: bring the upgrade here once its pull request is merged. */
    land: [];
    close: [];
    dismiss: [];
    /** Housekeeping on the card: the view runs `jig housekeeping` in the project. */
    housekeeping: [];
    dismissHousekeeping: [];
    /** Refresh on the card: the view runs `jig refresh` in the project. */
    refresh: [];
    dismissRefresh: [];
    /** Close task on a merged task's item, confirmed: the view closes it as done. */
    closeTask: [task: string];
    /** Merge on a pull request's item, confirmed, and Land on staging: the view writes it as the person. */
    mergeTask: [task: string];
    landTask: [task: string];
    dismissClose: [];
    /** Status… on a pull request's item, and its Close: the view asks the forge where it stands, or closes that. */
    openStatus: [task: string];
    closeStatus: [];
    /** Mark as known on the bell's list: the view asks Jig to mark the person's commits on staging it lists. */
    ackStaging: [expect: number, shas: string[]];
    dismissAck: [];
  }>();

  const router = useRouter();

  /** What Jig did with a write from an item, as a toast: done goes by itself; refused stays until closed, and offers the Board where only it lands. */
  const writing = reporter(`write:${props.project.id}`, () => emit('dismissClose'));
  watch(
    () => props.closing,
    (closing) => {
      if (!closing) return writing.clear();
      if (closing.state === 'running') return;
      if (closing.state === 'done') return writing.show({ kind: 'success', title: closing.message });
      writing.show({
        kind: 'error',
        title: closing.message,
        action: closing.board ? { label: 'Land it from the Board', run: () => void router.push(board.value) } : undefined,
      });
    },
    { immediate: true },
  );

  // A write's toast goes with its card: another project shown, or the workspace left.
  onUnmounted(writing.clear);
</script>

<template>
  <Card class="gap-3 px-5 py-4" :aria-labelledby="`project-${project.id}`" role="article">
    <div class="flex items-center gap-3">
      <h2 :id="`project-${project.id}`" class="shrink-0 text-base font-semibold">
        <RouterLink v-if="project.state === 'ready'" :to="board" class="underline-offset-2 hover:underline">{{ project.id }}</RouterLink>
        <template v-else>{{ project.id }}</template>
      </h2>
      <Button
        v-if="typeof bell === 'object'"
        variant="ghost"
        size="icon-xs"
        :class="toneText.attention"
        :aria-label="`Your work on staging: ${bell.lit.commits} commit${bell.lit.commits === 1 ? '' : 's'}`"
        :aria-expanded="showing"
        @click="showing = !showing"
        ><BellDot
      /></Button>
      <span
        v-else-if="bell === 'dark'"
        role="img"
        class="text-muted-foreground/60"
        aria-label="Nothing of yours on staging"
        title="Nothing of yours on staging that the base does not have"
        ><Bell class="size-3.5"
      /></span>
      <StateLine :project="project" :reading="reading" class="text-[13px] text-muted-foreground" @read-again="$emit('readAgain')" />
      <span v-if="mark" class="text-[13px]" :class="toneText.attention">{{ mark }}</span>
      <div class="ml-auto flex shrink-0 items-center gap-2">
        <Button v-if="upgradable" variant="outline" size="xs" @click="$emit('start')">Upgrade…</Button>
        <Button
          v-if="project.state === 'ready' && project.upgrade?.state !== 'running'"
          variant="outline"
          size="xs"
          :disabled="housekeeping?.state === 'running'"
          @click="$emit('housekeeping')"
          ><Loader2 v-if="housekeeping?.state === 'running'" class="animate-spin" />{{
            housekeeping?.state === 'running' ? 'Housekeeping…' : 'Housekeeping'
          }}</Button
        >
        <Button v-if="project.state === 'ready'" variant="outline" size="xs" as-child><RouterLink :to="board">Board</RouterLink></Button>
        <!-- Beside the card's actions as icons, no menu. Disconnect asks nothing: the project's files stay, and it connects again by its path. -->
        <template v-if="project.upgrade?.state !== 'running'">
          <Button
            v-if="project.state === 'ready'"
            variant="ghost"
            size="icon-xs"
            :aria-label="`Settings of ${project.id}`"
            title="Settings…"
            @click="$emit('settings')"
            ><Settings
          /></Button>
          <Button variant="ghost" size="icon-xs" :aria-label="`Disconnect ${project.id}`" title="Disconnect" @click="$emit('disconnect')"
            ><Unplug
          /></Button>
        </template>
      </div>
    </div>
    <StagingWork
      v-if="typeof bell === 'object' && showing"
      :project="project.id"
      :staging="bell.lit"
      :ack="ack"
      @ack="(n, shas) => $emit('ackStaging', n, shas)"
      @dismiss="$emit('dismissAck')"
    />
    <div v-if="merge" :class="toneRule.attention" class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span>
        {{ merge.state === 'open' ? 'The upgrade' : 'The merged upgrade' }}{{ merge.to ? ` to ${merge.to}` : '' }}
        {{ merge.state === 'open' ? 'waits for its pull request to be merged.' : 'is not here yet.' }}
      </span>
      <a
        v-if="link(merge.url)"
        :href="link(merge.url)"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 underline underline-offset-2"
      >
        Open pull request<ExternalLink class="size-3" />
      </a>
      <Button v-if="checkable || checking" variant="outline" size="xs" :disabled="checking" @click="$emit('land')"
        ><Loader2 v-if="checking" class="animate-spin" />{{ checking ? 'Checking…' : 'Check merge' }}</Button
      >
    </div>
    <UpgradePanel
      v-if="project.upgrade || plan"
      :project="project.id"
      :run="project.upgrade"
      :plan="plan"
      @self-update="$emit('selfUpdate')"
      @upgrade="$emit('upgrade')"
      @close="$emit('close')"
      @dismiss="$emit('dismiss')"
    />
    <template v-if="project.state === 'ready'">
      <p>{{ project.counts.active }} active · {{ project.counts.paused }} paused · {{ project.counts.ready }} ready</p>
      <p v-if="items.length === 0 && typeof bell !== 'object'" class="text-[13px] text-muted-foreground">Nothing needs you here.</p>
      <ul v-else-if="items.length > 0" class="flex flex-col gap-3" :aria-label="`What needs you in ${project.id}`">
        <li v-for="(item, i) in items" :key="i">
          <AttentionItem
            :item="item"
            :project="project.id"
            :closes="closableTask(project, item)"
            :writes="project.upgrade?.state !== 'running'"
            :who="whoMerges(project, item)"
            :writing="closing?.state === 'running' && closing.task === item.subject.id ? closing.write : undefined"
            :pr-status="prStatus && prStatus.task === item.subject.id && item.taskPullRequest !== undefined ? prStatus : undefined"
            :asking="asking === keyOf(item)"
            :refreshable="project.upgrade?.state !== 'running'"
            :refreshing="refresh?.state === 'running'"
            @update:asking="(open) => (asking = open ? keyOf(item) : undefined)"
            @close="(task) => $emit('closeTask', task)"
            @merge="(task) => $emit('mergeTask', task)"
            @land="(task) => $emit('landTask', task)"
            @status="(task) => $emit('openStatus', task)"
            @unstatus="$emit('closeStatus')"
            @refresh="$emit('refresh')"
          />
        </li>
      </ul>
      <p v-if="project.housekeepingStale" class="text-[13px] text-muted-foreground">
        Pull request facts may be out of date until Housekeeping runs.
      </p>
      <p v-if="stale" class="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
        {{ stale }}
        <Button
          v-if="!behind && project.upgrade?.state !== 'running'"
          variant="outline"
          size="xs"
          class="text-foreground"
          :disabled="refresh?.state === 'running'"
          @click="$emit('refresh')"
          ><Loader2 v-if="refresh?.state === 'running'" class="animate-spin" />{{
            refresh?.state === 'running' ? 'Refreshing…' : 'Refresh'
          }}</Button
        >
      </p>
    </template>
    <ChoreReports
      :project="project.id"
      :refresh="refresh"
      :housekeeping="housekeeping"
      @dismiss-refresh="$emit('dismissRefresh')"
      @dismiss-housekeeping="$emit('dismissHousekeeping')"
    />
  </Card>
</template>
