<script setup lang="ts">
  import { ExternalLink, X } from '@lucide/vue';
  import { computed } from 'vue';
  import type { Place, ReadyDetails, Task } from '@/api';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Card } from '@/components/ui/card';
  import { toneRule } from '@/lib/tones';
  import { minute } from '@/lib/clock';
  import { cardKey } from '@/lib/task-key';
  import { requested, waits } from '@/lib/waits';
  import CloseConfirm from './CloseConfirm.vue';
  import QueueMenu from './QueueMenu.vue';
  import SpecMark from './SpecMark.vue';
  import TaskBrief from './TaskBrief.vue';

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
  }>();

  defineEmits<{
    toggle: [];
    move: [place: Place];
    prioritise: [priority: number | null];
    pause: [ask: boolean];
    resume: [];
    close: [];
    openSpec: [spec: string];
  }>();

  /** The question before closing the task is open: one press asks, the question's button closes. */
  const confirming = defineModel<boolean>('confirming', { default: false });

  const note = computed(() => waits(props.task));
  const request = computed(() => requested(props.task, minute.value.getTime()));
  const key = computed(() => cardKey(props.task.id, props.task.goal, props.open));
</script>

<template>
  <Card class="gap-2 px-3 py-3" :class="[open && 'ring-foreground', busy && 'opacity-60']">
    <div class="flex items-start gap-1">
      <button type="button" class="flex min-w-0 flex-1 flex-col gap-2 text-left" :aria-expanded="open" @click="$emit('toggle')">
        <!-- The key, or the whole id broken at its hyphens, then the badges together: on one line where they fit. -->
        <span class="flex w-full flex-wrap items-center gap-1">
          <span v-if="key" class="mr-auto font-mono text-xs whitespace-nowrap text-muted-foreground" :title="task.id">
            <span aria-hidden="true">{{ key }}</span
            ><span class="sr-only">{{ task.id }}</span>
          </span>
          <span v-else class="mr-auto min-w-0 font-mono text-xs break-words" :class="task.goal ? 'text-muted-foreground' : 'font-medium'">
            {{ task.id }}
          </span>
          <span v-if="task.priority !== null || task.class" class="flex gap-1">
            <Badge v-if="task.priority !== null" variant="secondary" :title="`Priority ${task.priority}`">P{{ task.priority }}</Badge>
            <Badge v-if="task.class" variant="outline">{{ task.class }}</Badge>
          </span>
        </span>
        <span v-if="task.goal" class="font-medium" :class="!open && 'line-clamp-2'">{{ task.goal }}</span>
      </button>
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
    <CloseConfirm
      v-if="task.closable && confirming && !busy"
      :task="task.id"
      @close="
        confirming = false;
        $emit('close');
      "
      @cancel="confirming = false"
    />
    <p v-if="busy" class="text-[13px] text-muted-foreground" role="status">sending to Jig…</p>
    <p v-if="changed" class="text-[13px]" :class="toneRule.attention">Changed while you acted</p>
    <p v-if="note" class="text-[13px]" :class="toneRule[note.tone]">
      {{ note.text }}
      <a
        v-if="note.url"
        :href="note.url"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 underline underline-offset-2"
      >
        open<ExternalLink class="size-3" />
      </a>
    </p>
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
    <TaskBrief v-if="open" :project="project" :task="task.id" :details="details" class="mt-1 border-t pt-2" />
  </Card>
</template>
