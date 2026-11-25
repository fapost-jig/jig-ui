<script setup lang="ts">
  import { X } from '@lucide/vue';
  import { computed } from 'vue';
  import type { Place, PrStatus as Status, Reviewers, Task } from '@/api';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { classAccent, idAccent, priorityAccent, toneText } from '@/lib/tones';
  import { ago } from '@/lib/ago';
  import { shownPull } from '@/lib/pull';
  import { minute } from '@/lib/clock';
  import type { StagingStep } from '@/lib/staging';
  import { requested, waits } from '@/lib/waits';
  import WriteConfirm from './WriteConfirm.vue';
  import PrStatus from './PrStatus.vue';
  import QueueMenu from './QueueMenu.vue';
  import ReviewRequest from './ReviewRequest.vue';
  import PullChip from './PullChip.vue';
  import SpecMark from './SpecMark.vue';

  const props = defineProps<{
    project: string;
    task: Task;
    /** Kept for the board's selection; a row opens its task's page instead of showing it beside the list. */
    selected?: boolean;
    /** The task's column, for its queue menu; without it the row has none. */
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
    select: [];
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

  const note = computed(() => waits(props.task));
  const request = computed(() => requested(props.task, minute.value.getTime()));
  const updated = computed(() => (props.task.updatedAt ? ago(props.task.updatedAt, minute.value.getTime()) : ''));
  const pull = computed(() => shownPull(props.task));
  const taskPage = computed(() => `/projects/${encodeURIComponent(props.project)}/tasks/${encodeURIComponent(props.task.id)}`);
  /** The item the note says it waits for, by its name. */
  const waitsOn = computed(() => note.value?.ref?.replace(/^task:/, '').replace(/^epic:/, 'epic '));
</script>

<template>
  <div class="relative border-b hover:bg-muted/50" :class="busy && 'opacity-60'">
    <!-- One line a task, as a table's row: the whole row opens the task's page; its menu and close sit above that link. -->
    <div
      class="grid grid-cols-[minmax(0,14rem)_minmax(0,1fr)_3.5rem] items-center gap-3 py-2 pr-2 pl-4 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)_minmax(0,10rem)_minmax(0,12rem)_4.5rem_4.5rem_4.5rem_3.5rem]"
    >
      <span class="min-w-0 truncate font-mono text-xs font-medium" :class="idAccent" :title="task.id">{{ task.id }}</span>
      <RouterLink
        :to="taskPage"
        class="min-w-0 truncate text-[13px] text-foreground/80 after:absolute after:inset-0 hover:text-foreground"
        :title="task.goal ?? undefined"
      >
        {{ task.goal ?? 'no goal yet' }}
      </RouterLink>
      <span class="hidden min-w-0 lg:block">
        <SpecMark
          v-if="task.spec"
          :spec="task.spec"
          :openable="specOpens"
          class="relative z-10 max-w-full"
          @open="(spec) => $emit('openSpec', spec)"
        />
      </span>
      <span
        class="hidden min-w-0 truncate text-xs lg:block"
        :class="busy ? 'text-muted-foreground' : changed ? toneText.attention : note ? toneText[note.tone] : ''"
      >
        <template v-if="busy">sending to Jig…</template>
        <template v-else-if="changed">changed while you acted</template>
        <template v-else-if="note">{{ note.text }}{{ waitsOn ? ` ${waitsOn}` : '' }}</template>
        <template v-else-if="request">{{ request }}</template>
      </span>
      <span class="hidden gap-1 lg:flex">
        <Badge
          v-if="task.priority !== null"
          class="border-transparent font-semibold"
          :class="priorityAccent(task.priority)"
          :title="`Priority ${task.priority}`"
          >P{{ task.priority }}</Badge
        >
        <Badge v-if="task.class" class="border-transparent font-semibold" :class="classAccent(task.class)">{{ task.class }}</Badge>
      </span>
      <span class="relative z-10 hidden lg:block"><PullChip v-if="pull" :pull="pull" /></span>
      <span class="hidden text-right text-xs whitespace-nowrap text-muted-foreground lg:block" :title="task.updatedAt ?? undefined">{{
        updated
      }}</span>
      <span class="relative z-10 flex items-center justify-end">
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
      </span>
      <!-- Narrower than lg the status column is hidden: what is under way or changed shows on a line of its own. -->
      <span
        v-if="busy || changed || note || request"
        class="col-span-3 -mt-1 truncate text-xs lg:hidden"
        :class="busy ? 'text-muted-foreground' : changed ? toneText.attention : note ? toneText[note.tone] : toneText.quiet"
      >
        <template v-if="busy">sending to Jig…</template>
        <template v-else-if="changed">changed while you acted</template>
        <template v-else-if="note">{{ note.text }}{{ waitsOn ? ` ${waitsOn}` : '' }}</template>
        <template v-else>{{ request }}</template>
      </span>
    </div>
    <WriteConfirm
      v-if="task.closable && confirming && !busy"
      write="close"
      :task="task.id"
      class="relative z-10 mx-4 mb-2.5"
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
      class="relative z-10 mx-4 mb-2.5"
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
      class="relative z-10 mx-4 mb-2.5"
      @confirm="
        merging = false;
        $emit('staging', 'merge');
      "
      @cancel="merging = false"
    />
    <PrStatus
      v-if="prStatus && !busy"
      :task="task.id"
      :status="prStatus.read"
      class="relative z-10 mx-4 mb-2.5"
      @close="$emit('staging', 'unstatus')"
    />
    <ReviewRequest
      v-if="reviewing && !busy"
      :task="task.id"
      :reviewers="reviewing.reviewers"
      :asked="task.parked?.review?.waitingFor ?? []"
      class="relative z-10 mx-4 mb-2.5"
      @ask="(logins) => $emit('staging', { ask: logins })"
      @cancel="$emit('staging', 'unreview')"
    />
  </div>
</template>
