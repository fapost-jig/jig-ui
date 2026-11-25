<script setup lang="ts">
  import { doneFill } from '@/lib/tones';

  /** `compact` is the bar of a list row: thin, filling the width its row leaves, and the count only when not `hideCount`. */
  defineProps<{
    done: number;
    total: number;
    compact?: boolean;
    hideCount?: boolean;
  }>();
</script>

<template>
  <span class="flex items-center gap-2" :class="compact && 'min-w-0 flex-1 gap-1.5'">
    <span
      class="shrink-0 overflow-hidden rounded-full bg-muted"
      :class="compact ? 'h-[3px] min-w-4 flex-1' : 'h-1.5 w-24'"
      role="progressbar"
      aria-valuemin="0"
      :aria-valuemax="total"
      :aria-valuenow="done"
      :aria-label="`${done} of ${total} done`"
    >
      <span class="block h-full" :class="doneFill" :style="{ width: total === 0 ? '0%' : `${(done / total) * 100}%` }" />
    </span>
    <span v-if="!hideCount" class="text-xs text-muted-foreground tabular-nums">{{ done }}/{{ total }}</span>
  </span>
</template>
