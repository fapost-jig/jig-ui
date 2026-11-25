<script setup lang="ts">
  import { inject } from 'vue';
  import { Button } from '@/components/ui/button';
  import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
  import { INLINE_DIALOGS } from '@/lib/inline';
  import { toneRule } from '@/lib/tones';

  /**
   * The question before a write the page cannot take back: closing a ready task as done — final, and Jig decides whether
   * it may —, preparing one tested on staging for prod, whose pull request may merge itself into the main branch, or
   * merging a task's pull request into its base, which only a revert takes back. A dialog over the page while it is
   * shown; closing it is Cancel.
   */
  const props = defineProps<{
    write: 'close' | 'promote' | 'merge';
    task: string;
  }>();

  const emit = defineEmits<{
    confirm: [];
    cancel: [];
  }>();

  const inline = inject(INLINE_DIALOGS, false);

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
    merge: {
      label: 'Merge',
      question: (task: string) =>
        `Merge ${task}'s pull request into its base? Jig merges it on the forge and closes the task once its knowledge decision is recorded; only a revert takes a merge back.`,
      button: 'Merge',
    },
  };

  const asks = ASKS[props.write];
</script>

<template>
  <section v-if="inline" :aria-label="`${asks.label} ${task}`" :class="toneRule.attention" class="flex flex-col gap-2 text-[13px]">
    <p>{{ asks.question(task) }}</p>
    <div class="flex gap-2">
      <Button size="xs" @click="emit('confirm')">{{ asks.button }}</Button>
      <Button variant="ghost" size="xs" @click="emit('cancel')">Cancel</Button>
    </div>
  </section>
  <Dialog v-else :open="true" @update:open="(open: boolean) => !open && emit('cancel')">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle
          >{{ asks.label }} <code class="font-mono text-sm font-normal">{{ task }}</code
          >?</DialogTitle
        >
        <DialogDescription class="text-[13px]">{{ asks.question(task) }}</DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="ghost" size="sm" @click="emit('cancel')">Cancel</Button>
        <Button size="sm" @click="emit('confirm')">{{ asks.button }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
