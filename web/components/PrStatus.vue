<script setup lang="ts">
  import { inject } from 'vue';
  import type { PrStatus } from '@/api';
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
  import { INLINE_DIALOGS } from '@/lib/inline';
  import PrStatusBody from './PrStatusBody.vue';

  /**
   * Where a task's pull request stands on the forge, read when the person opened it, `undefined` while that runs, in a
   * dialog over the page; closing it is Close. In place where the page's dialogs draw inline (the canvas).
   */
  defineProps<{
    task: string;
    status?: PrStatus;
  }>();

  const emit = defineEmits<{
    close: [];
  }>();

  const inline = inject(INLINE_DIALOGS, false);
</script>

<template>
  <PrStatusBody v-if="inline" :task="task" :status="status" @close="emit('close')" />
  <Dialog v-else :open="true" @update:open="(open: boolean) => !open && emit('close')">
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle
          >Where <code class="font-mono text-sm font-normal">{{ task }}</code
          >'s pull request stands</DialogTitle
        >
        <DialogDescription class="sr-only">The forge's answer, read when you asked.</DialogDescription>
      </DialogHeader>
      <PrStatusBody :task="task" :status="status" class="border-l-0 pl-0" @close="emit('close')" />
    </DialogContent>
  </Dialog>
</template>
