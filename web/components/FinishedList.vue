<script setup lang="ts">
  import { ref } from 'vue';
  import type { Finished } from '@/api';
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
  import { Input } from '@/components/ui/input';
  import type { FINISHED_WRITES } from '@/lib/finished';
  import FinishedRows from './FinishedRows.vue';

  /** The finished tasks Jig still keeps, in a dialog the board's button opens, found by a word of the id or the goal. */
  defineProps<{
    /** How many the board counts, for the title while they are read. */
    count: number;
    read?: Finished;
    pending?: string;
  }>();

  defineEmits<{
    readAgain: [];
    write: [task: string, write: (typeof FINISHED_WRITES)[number]['write']];
  }>();

  const open = defineModel<boolean>('open', { default: false });
  const query = ref('');
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex max-h-[calc(100dvh-2rem)] flex-col gap-3 sm:max-w-4xl">
      <DialogHeader class="pr-8">
        <DialogTitle>{{ count }} finished {{ count === 1 ? 'task' : 'tasks' }}</DialogTitle>
        <DialogDescription>Closed, abandoned and archived tasks Jig still keeps, the latest first.</DialogDescription>
      </DialogHeader>
      <Input
        v-model="query"
        type="search"
        class="bg-card dark:bg-background"
        placeholder="Find a finished task…"
        aria-label="Find a finished task"
      />
      <div class="min-h-0 flex-1 overflow-y-auto">
        <FinishedRows
          :read="read"
          :pending="pending"
          :query="query"
          @read-again="$emit('readAgain')"
          @write="(task, write) => $emit('write', task, write)"
        />
      </div>
    </DialogContent>
  </Dialog>
</template>
