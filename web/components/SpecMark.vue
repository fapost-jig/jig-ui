<script setup lang="ts">
  import { Milestone } from '@lucide/vue';
  import type { Task } from '@/api';
  import { epicAccent } from '@/lib/tones';

  /**
   * The spec a task was filed from, on its card: its title, else its id, and the phase, marked when the task goes into
   * the spec's epic. `openable` when the project's specs list it: a press asks the board to open it on the Specs view;
   * a spec not in the checkout is only named.
   */
  defineProps<{
    spec: NonNullable<Task['spec']>;
    openable?: boolean;
  }>();

  defineEmits<{
    open: [spec: string];
  }>();
</script>

<template>
  <!-- A chip of its own, so it reads apart from the goal; tinted in the epic's accent when the task goes into the epic. -->
  <component
    :is="openable ? 'button' : 'span'"
    :type="openable ? 'button' : undefined"
    class="flex w-fit max-w-full min-w-0 items-center gap-1 rounded-md px-2 py-0.5 text-left text-xs"
    :class="[spec.epic ? epicAccent : 'bg-muted text-muted-foreground', openable && 'underline-offset-2 hover:underline']"
    :title="openable ? `Open the spec ${spec.id}` : spec.id"
    @click="openable && $emit('open', spec.id)"
  >
    <Milestone class="size-3 shrink-0" aria-hidden="true" />
    <span class="truncate">{{ spec.title ?? spec.id }}</span>
    <span v-if="spec.phase !== null" class="shrink-0 whitespace-nowrap">· Ph {{ spec.phase }}</span>
    <span v-if="spec.epic" class="shrink-0 whitespace-nowrap" title="Goes into the spec's epic">· epic</span>
  </component>
</template>
