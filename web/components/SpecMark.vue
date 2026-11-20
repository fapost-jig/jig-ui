<script setup lang="ts">
  import type { Task } from '@/api';
  import { Badge } from '@/components/ui/badge';

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
  <component
    :is="openable ? 'button' : 'span'"
    :type="openable ? 'button' : undefined"
    class="flex w-fit max-w-full min-w-0 items-center gap-1 text-left text-[13px] text-muted-foreground"
    :class="openable && 'underline-offset-2 hover:text-foreground hover:underline'"
    :title="openable ? `Open the spec ${spec.id}` : spec.id"
    @click="openable && $emit('open', spec.id)"
  >
    <span class="truncate">{{ spec.title ?? spec.id }}</span>
    <span v-if="spec.phase !== null" class="shrink-0 whitespace-nowrap">· Phase {{ spec.phase }}</span>
    <Badge v-if="spec.epic" variant="outline" class="shrink-0" title="Goes into the spec's epic">epic</Badge>
  </component>
</template>
