<script setup lang="ts">
  import { Ellipsis, ExternalLink } from '@lucide/vue';
  import { computed } from 'vue';
  import type { Finished } from '@/api';
  import { Button } from '@/components/ui/button';
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
  import { FINISHED_WRITES, finished, latestFirst, noFinished } from '@/lib/finished';
  import { toneText } from '@/lib/tones';

  const props = defineProps<{
    /** The read of the finished tasks Jig still keeps, shown the latest first; none yet while it runs. */
    read?: Finished;
    /** The task whose write is on its way to Jig: every menu waits for it. */
    pending?: string;
  }>();

  defineEmits<{
    readAgain: [];
    write: [task: string, write: (typeof FINISHED_WRITES)[number]['write']];
  }>();

  const none = computed(() => props.read && noFinished(props.read));
  const rows = computed(() =>
    props.read?.state === 'ready' ? latestFirst(props.read.tasks).map((task) => ({ task, ...finished(task) })) : [],
  );
</script>

<template>
  <p v-if="read === undefined" class="px-4 py-2 text-[13px] text-muted-foreground">Reading the finished tasks…</p>
  <p v-else-if="none" class="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-[13px] text-muted-foreground">
    {{ none }}
    <Button v-if="read.state === 'unreadable'" variant="outline" size="xs" @click="$emit('readAgain')">Read again</Button>
  </p>
  <ul v-else aria-label="Finished tasks">
    <li v-for="{ task, word, tone, pr } in rows" :key="task.id" class="flex items-center gap-3 border-b px-4 py-2 last:border-b-0">
      <span class="w-44 shrink-0 truncate font-mono text-xs" :title="task.id">{{ task.id }}</span>
      <span class="w-20 shrink-0 text-[13px]" :class="toneText[tone]">{{ word }}</span>
      <span class="min-w-0 flex-1 truncate text-muted-foreground">{{ task.goal }}</span>
      <template v-if="pr">
        <a
          v-if="pr.url"
          :href="pr.url"
          target="_blank"
          rel="noopener noreferrer"
          class="inline-flex shrink-0 items-center gap-1 text-[13px] underline underline-offset-2"
        >
          {{ pr.text }}<ExternalLink class="size-3" />
        </a>
        <span v-else class="shrink-0 text-[13px]">{{ pr.text }}</span>
      </template>
      <span v-if="task.updatedAt" class="shrink-0 text-xs text-muted-foreground tabular-nums">{{ task.updatedAt }}</span>
      <DropdownMenu v-if="task.offers.length > 0">
        <DropdownMenuTrigger as-child>
          <Button variant="ghost" size="icon-xs" :disabled="pending !== undefined" :aria-label="`What to do with ${task.id}`">
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" class="w-52">
          <template v-for="w in FINISHED_WRITES" :key="w.write">
            <DropdownMenuItem v-if="task.offers.includes(w.write)" @select="$emit('write', task.id, w.write)">{{
              w.label
            }}</DropdownMenuItem>
          </template>
        </DropdownMenuContent>
      </DropdownMenu>
      <span v-else class="size-6 shrink-0" aria-hidden="true" />
    </li>
  </ul>
</template>
