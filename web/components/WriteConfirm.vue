<script setup lang="ts">
  import { Button } from '@/components/ui/button';
  import { toneRule } from '@/lib/tones';

  /**
   * The question before a write the page cannot take back: closing a ready task as done — final, and Jig decides whether
   * it may —, or preparing one tested on staging for prod, whose pull request may merge itself into the main branch.
   */
  const props = defineProps<{
    write: 'close' | 'promote';
    task: string;
  }>();

  defineEmits<{
    confirm: [];
    cancel: [];
  }>();

  const ASKS = {
    close: {
      label: 'Close',
      question: (task: string) =>
        `Close ${task} as done? Jig closes it only if its pull request has merged, and asks the forge to be sure. A closed task leaves the board for good.`,
      button: 'Close task',
    },
    promote: {
      label: 'Prepare for prod',
      question: (task: string) =>
        `Prepare ${task} for prod? Jig pushes its branch and opens its pull request into the main branch; where the project merges promotions itself, it merges once its checks pass.`,
      button: 'Prepare for prod',
    },
  };

  const asks = ASKS[props.write];
</script>

<template>
  <section :aria-label="`${asks.label} ${task}`" :class="toneRule.attention" class="flex flex-col gap-2 text-[13px]">
    <p>{{ asks.question(task) }}</p>
    <div class="flex gap-2">
      <Button size="xs" @click="$emit('confirm')">{{ asks.button }}</Button>
      <Button variant="ghost" size="xs" @click="$emit('cancel')">Cancel</Button>
    </div>
  </section>
</template>
