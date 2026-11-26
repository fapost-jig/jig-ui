<script setup lang="ts">
  import { X } from '@lucide/vue';
  import { computed } from 'vue';
  import type { Place, PrStatus as Status, ReadyDetails, Reviewers, Task } from '@/api';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Card } from '@/components/ui/card';
  import { classAccent, idAccent, priorityAccent, toneRule } from '@/lib/tones';
  import { minute } from '@/lib/clock';
  import { cardKey } from '@/lib/task-key';
  import type { StagingStep } from '@/lib/staging';
  import { requested, waits } from '@/lib/waits';
  import { ago } from '@/lib/ago';
  import { shownPull } from '@/lib/pull';
  import WriteConfirm from './WriteConfirm.vue';
  import PrStatus from './PrStatus.vue';
  import QueueMenu from './QueueMenu.vue';
  import ReviewRequest from './ReviewRequest.vue';
  import SpecMark from './SpecMark.vue';
  import CopyButton from './CopyButton.vue';
  import PullChip from './PullChip.vue';
  import TaskNote from './TaskNote.vue';

  const props = defineProps<{
    project: string;
    task: Task;
    open: boolean;
    details?: ReadyDetails | 'unavailable';
    /** The task's column, for its queue menu; without it the card has none. */
    cards?: Task[];
    /** The board is sorted other than by Jig's queue: the menu offers no move. */
    sorted?: boolean;
    /** `cards` are only those a filter shows. */
    filtered?: boolean;
    /** A change of its place, priority or pause is on its way to Jig. */
    busy?: boolean;
    /** It changed between the board a refused change was made on and the board read after it. */
    changed?: boolean;
    /** Its spec is one of the project's: its mark opens it on the Specs view. */
    specOpens?: boolean;
    /** Its review request is open: whom the forge offers, `undefined` while the view reads them. */
    reviewing?: {
      reviewers?: Reviewers;
    };
    /** Where its pull request stands is open: the forge's answer, `undefined` while the view asks it. */
    prStatus?: {
      read?: Status;
    };
  }>();

  defineEmits<{
    toggle: [];
    move: [place: Place];
    prioritise: [priority: number | null];
    pause: [ask: boolean];
    resume: [];
    close: [];
    openSpec: [spec: string];
    staging: [step: StagingStep];
  }>();

  /** The question before closing the task is open: one press asks, the question's button closes. */
  const confirming = defineModel<boolean>('confirming', { default: false });
  /** The question before preparing it for prod is open, as the close's is. */
  const promoting = defineModel<boolean>('promoting', { default: false });
  /** The question before merging its pull request is open, as the close's is. */
  const merging = defineModel<boolean>('merging', { default: false });

  /** The note, unless all it says is the pull request the footer already shows. */
  const note = computed(() => {
    const n = waits(props.task);
    return n?.icon === 'pull' && pull.value ? undefined : n;
  });

  const request = computed(() => requested(props.task, minute.value.getTime()));
  const key = computed(() => cardKey(props.task.id, props.task.goal, false));
  const updated = computed(() => (props.task.updatedAt ? ago(props.task.updatedAt, minute.value.getTime()) : ''));

  const pull = computed(() => shownPull(props.task));

  const taskPage = computed(() => `/projects/${encodeURIComponent(props.project)}/tasks/${encodeURIComponent(props.task.id)}`);
</script>

<template>
  <Card class="gap-2 px-3 py-3" :class="[open && 'ring-foreground', busy && 'opacity-60']">
    <!-- The head: what names the task and where it comes from, set apart from what it is for. -->
    <div class="flex flex-col gap-1.5">
      <div class="flex items-center gap-1">
        <!-- The key, or the whole id broken at its hyphens, in the id's accent; copying it beside it. -->
        <span class="flex min-w-0 flex-1 items-center gap-0.5">
          <span v-if="key" class="font-mono text-xs font-medium whitespace-nowrap" :class="idAccent" :title="task.id">
            <span aria-hidden="true">{{ key }}</span
            ><span class="sr-only">{{ task.id }}</span>
          </span>
          <span v-else class="min-w-0 font-mono text-xs font-medium break-words" :class="idAccent">{{ task.id }}</span>
          <CopyButton :text="task.id" icon class="shrink-0 text-muted-foreground" />
        </span>
        <QueueMenu
          v-if="cards"
          :task="task"
          :cards="sorted ? undefined : cards"
          :filtered="filtered"
          :disabled="busy"
          @move="(place) => $emit('move', place)"
          @prioritise="(p) => $emit('prioritise', p)"
          @pause="(ask) => $emit('pause', ask)"
          @resume="$emit('resume')"
          @land="$emit('staging', 'land')"
          @review="$emit('staging', 'review')"
          @promote="promoting = true"
          @merge="merging = true"
          @status="$emit('staging', 'status')"
        />
        <Button
          v-if="task.closable"
          variant="ghost"
          size="icon-xs"
          :disabled="busy"
          :aria-label="`Close ${task.id} as done`"
          :aria-expanded="confirming"
          title="Close as done"
          @click="confirming = !confirming"
        >
          <X />
        </Button>
      </div>
      <SpecMark v-if="task.spec" :spec="task.spec" :openable="specOpens" @open="(spec) => $emit('openSpec', spec)" />
    </div>
    <RouterLink v-if="task.goal" :to="taskPage" class="line-clamp-4 text-foreground/80 hover:text-foreground" :title="`Open ${task.id}`">
      {{ task.goal }}
    </RouterLink>
    <RouterLink v-else :to="taskPage" class="w-fit text-[13px] text-muted-foreground underline underline-offset-2"
      >Open the task</RouterLink
    >
    <WriteConfirm
      v-if="task.closable && confirming && !busy"
      write="close"
      :task="task.id"
      @confirm="
        confirming = false;
        $emit('close');
      "
      @cancel="confirming = false"
    />
    <WriteConfirm
      v-if="task.promotable && promoting && !busy"
      write="promote"
      :task="task.id"
      @confirm="
        promoting = false;
        $emit('staging', 'promote');
      "
      @cancel="promoting = false"
    />
    <WriteConfirm
      v-if="task.mergeable && merging && !busy"
      write="merge"
      :task="task.id"
      @confirm="
        merging = false;
        $emit('staging', 'merge');
      "
      @cancel="merging = false"
    />
    <PrStatus v-if="prStatus && !busy" :task="task.id" :status="prStatus.read" @close="$emit('staging', 'unstatus')" />
    <ReviewRequest
      v-if="reviewing && !busy"
      :task="task.id"
      :reviewers="reviewing.reviewers"
      :asked="task.parked?.review?.waitingFor ?? []"
      @ask="(logins) => $emit('staging', { ask: logins })"
      @cancel="$emit('staging', 'unreview')"
    />
    <p v-if="busy" class="text-[13px] text-muted-foreground" role="status">sending to Jig…</p>
    <p v-if="changed" class="text-[13px]" :class="toneRule.attention">Changed while you acted</p>
    <TaskNote v-if="note" :project="project" :note="note" :link="!pull" />
    <p v-if="request && !busy" class="text-[13px]" :class="toneRule.quiet">
      {{ request }}
      <button
        type="button"
        class="underline underline-offset-2"
        :aria-label="`Cancel the pause request of ${task.id}`"
        @click="$emit('pause', false)"
      >
        cancel
      </button>
    </p>
    <!-- The footer: priority, class, the pull request with its CI, and when Jig last wrote the task. -->
    <div class="flex min-w-0 items-center gap-1.5 border-t pt-2">
      <Badge
        v-if="task.priority !== null"
        class="border-transparent font-semibold"
        :class="priorityAccent(task.priority)"
        :title="`Priority ${task.priority}`"
        >P{{ task.priority }}</Badge
      >
      <Badge v-if="task.class" class="border-transparent font-semibold" :class="classAccent(task.class)">{{ task.class }}</Badge>
      <PullChip v-if="pull" :pull="pull" />
      <span v-if="updated" class="ml-auto text-xs whitespace-nowrap text-muted-foreground" :title="task.updatedAt ?? undefined">{{
        updated
      }}</span>
    </div>
  </Card>
</template>
