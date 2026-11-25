<script setup lang="ts">
  import { onUnmounted, ref, watch } from 'vue';
  import { toast } from 'vue-sonner';
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
  import type { HousekeepingState, RefreshState } from '@/lib/projects';

  /**
   * What came of Refresh and Housekeeping in a project, on its card and its page, as toasts in the page's corner: one
   * while it runs, replaced by Jig's answer in the page's words — gone by itself — or by why it did not run, which stays
   * until closed. A toast closed is the report dismissed. Housekeeping's toast says only what it changed; its whole
   * report opens in a dialog from the toast. It draws nothing else in place.
   */
  const props = defineProps<{
    project: string;
    refresh?: RefreshState;
    housekeeping?: HousekeepingState;
  }>();

  const emit = defineEmits<{
    dismissRefresh: [];
    dismissHousekeeping: [];
  }>();

  // The toasts belong to the view that holds the reports: they go with it, a run's spinner included — the report of a
  // run that ends after the view went is not shown.
  onUnmounted(() => {
    toast.dismiss(`refresh:${props.project}`);
    toast.dismiss(`housekeeping:${props.project}`);
  });

  /** Housekeeping's whole report, open in its dialog. */
  const report = ref<string[]>();

  /** How long a report that went well stays, in ms; one that went wrong stays until closed. */
  const SHOWN_MS = 8000;

  watch(
    () => props.refresh,
    (refresh) => {
      const id = `refresh:${props.project}`;
      if (!refresh) return void toast.dismiss(id);
      if (refresh.state === 'running') {
        toast.loading(`Running jig refresh in ${props.project}…`, {
          id,
          description: 'It fetches origin; a dialog for your git credentials may wait for you.',
        });

        return;
      }
      const gone = () => emit('dismissRefresh');
      if (refresh.state === 'refused') {
        toast.error(`Refresh of ${props.project} did not run`, { id, description: refresh.message, duration: Infinity, onDismiss: gone });
        return;
      }
      const shown = {
        id,
        description: refresh.lines.join('\n'),
        descriptionClass: 'whitespace-pre-line',
        onDismiss: gone,
        onAutoClose: gone,
      };

      if (refresh.tone === 'bad') toast.error(`Refresh of ${props.project}`, { ...shown, duration: Infinity });
      else if (refresh.tone === 'attention') toast.warning(`Refresh of ${props.project}`, { ...shown, duration: SHOWN_MS });
      else toast.success(`Refresh of ${props.project}`, { ...shown, duration: SHOWN_MS });
    },
    { immediate: true },
  );

  watch(
    () => props.housekeeping,
    (housekeeping) => {
      const id = `housekeeping:${props.project}`;
      if (!housekeeping) return void toast.dismiss(id);
      if (housekeeping.state === 'running') {
        toast.loading(`Running jig housekeeping in ${props.project}…`, {
          id,
          description: 'It fetches and asks the forge; a dialog for your git credentials may wait for you.',
        });

        return;
      }
      const gone = () => emit('dismissHousekeeping');
      if (housekeeping.state === 'done') {
        const lines = housekeeping.report;
        toast.success(`Housekeeping in ${props.project} is done`, {
          id,
          description: housekeeping.summary ?? 'Nothing to change.',
          duration: SHOWN_MS,
          onDismiss: gone,
          onAutoClose: gone,
          action: lines.length > 0 ? { label: 'Report', onClick: () => (report.value = lines) } : undefined,
        });

        return;
      }
      toast.error(`Housekeeping in ${props.project} did not run`, {
        id,
        description: [housekeeping.message, ...housekeeping.reasons.map((r) => `• ${r}`)].join('\n'),
        descriptionClass: 'whitespace-pre-line',
        duration: Infinity,
        onDismiss: gone,
      });
    },
    { immediate: true },
  );
</script>

<template>
  <Dialog :open="report !== undefined" @update:open="(open: boolean) => !open && (report = undefined)">
    <DialogContent class="flex max-h-[calc(100dvh-2rem)] flex-col gap-3 sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Housekeeping in {{ project }}</DialogTitle>
        <DialogDescription>Jig's report, as it wrote it.</DialogDescription>
      </DialogHeader>
      <pre class="min-h-0 flex-1 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed whitespace-pre-wrap">{{
        report?.join('\n')
      }}</pre>
    </DialogContent>
  </Dialog>
</template>
