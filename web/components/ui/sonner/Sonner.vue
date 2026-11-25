<script setup lang="ts">
  import { Toaster as Sonner, type ToasterProps } from 'vue-sonner';
  import 'vue-sonner/style.css';
  import { theme } from '@/lib/theme';

  /** The page's toaster (shadcn-vue's Sonner): the theme's colours, the page's radius, the page's theme. */
  const props = defineProps<ToasterProps>();
</script>

<template>
  <Sonner
    v-bind="props"
    class="toaster group"
    :theme="theme"
    :style="{
      '--normal-bg': 'var(--popover)',
      '--normal-text': 'var(--popover-foreground)',
      '--normal-border': 'var(--border)',
      '--border-radius': 'var(--radius)',
    }"
  />
</template>
