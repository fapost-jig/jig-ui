<script setup lang="ts">
  import { onUnmounted, ref, watch } from 'vue';
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
  import type { HousekeepingState, RefreshState } from '@/lib/projects';
  import { kindOf, reporter } from '@/lib/report';

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

  const refreshing = reporter(`refresh:${props.project}`, () => emit('dismissRefresh'));
  const housekeeping_ = reporter(`housekeeping:${props.project}`, () => emit('dismissHousekeeping'));

  // The toasts belong to the view that holds the reports: they go with it, a run's spinner included. A run kept while its
  // project is not shown (WorkspaceView keeps it) reports when that project is shown again.
  onUnmounted(() => {
    refreshing.clear();
    housekeeping_.clear();
  });

  /** Housekeeping's whole report, open in its dialog. */
  const report = ref<string[]>();

  watch(
    () => props.refresh,
    (refresh) => {
      if (!refresh) return refreshing.clear();
      if (refresh.state === 'running') {
        return refreshing.show({
          kind: 'loading',
          title: `Running jig refresh in ${props.project}…`,
          description: 'It fetches origin; a dialog for your git credentials may wait for you.',
        });
      }
      if (refresh.state === 'refused') {
        return refreshing.show({ kind: 'error', title: `Refresh of ${props.project} did not run`, description: refresh.message });
      }
      refreshing.show({
        kind: kindOf(refresh.tone),
        title: `Refresh of ${props.project}`,
        description: refresh.lines.join('\n'),
        descriptionClass: 'whitespace-pre-line',
      });
    },
    { immediate: true },
  );

  watch(
    () => props.housekeeping,
    (housekeeping) => {
      if (!housekeeping) return housekeeping_.clear();
      if (housekeeping.state === 'running') {
        return housekeeping_.show({
          kind: 'loading',
          title: `Running jig housekeeping in ${props.project}…`,
          description: 'It fetches and asks the forge; a dialog for your git credentials may wait for you.',
        });
      }
      if (housekeeping.state === 'done') {
        const lines = housekeeping.report;
        return housekeeping_.show({
          kind: 'success',
          title: `Housekeeping in ${props.project} is done`,
          description: housekeeping.summary ?? 'Nothing to change.',
          action: lines.length > 0 ? { label: 'Report', run: () => (report.value = lines) } : undefined,
        });
      }
      housekeeping_.show({
        kind: 'error',
        title: `Housekeeping in ${props.project} did not run`,
        description: [housekeeping.message, ...housekeeping.reasons.map((r) => `• ${r}`)].join('\n'),
        descriptionClass: 'whitespace-pre-line',
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
