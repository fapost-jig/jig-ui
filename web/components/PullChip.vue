<script setup lang="ts">
  import { GitPullRequest } from '@lucide/vue';
  import type { ShownPull } from '@/lib/pull';

  /** A pull request as a small chip: its number and its CI's dot, a link to the forge where it has one. */
  defineProps<{
    pull: ShownPull;
  }>();
</script>

<template>
  <component
    :is="pull.url ? 'a' : 'span'"
    :href="pull.url"
    :target="pull.url ? '_blank' : undefined"
    :rel="pull.url ? 'noopener noreferrer' : undefined"
    class="inline-flex items-center gap-1 rounded-md border px-1.5 text-xs text-muted-foreground"
    :class="pull.url && 'hover:text-foreground'"
    :title="pull.title"
  >
    <GitPullRequest class="size-3" aria-hidden="true" />
    <span class="font-mono">{{ pull.number }}</span>
    <span v-if="pull.dot" class="size-1.5 rounded-full" :class="pull.dot" aria-hidden="true" />
  </component>
</template>
