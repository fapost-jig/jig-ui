<script setup lang="ts">
  import { Loader2 } from '@lucide/vue';
  import { workingText } from '@/lib/tones';

  /** A line saying the page is reading or asking something now: a turning mark and the words in the colour of work under way. */
</script>

<template>
  <p class="flex items-center gap-2 text-[13px]" :class="workingText" role="status">
    <Loader2 class="size-3.5 shrink-0 animate-spin" aria-hidden="true" />
    <span><slot /></span>
  </p>
</template>
