<script setup lang="ts">
  import ReadingLine from './ReadingLine.vue';
  import { Ellipsis, ExternalLink } from '@lucide/vue';
  import { computed } from 'vue';
  import type { Finished } from '@/api';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
  import { FINISHED_WRITES, finished, latestFirst, noFinished } from '@/lib/finished';
  import { endingAccent, idAccent } from '@/lib/tones';

  /**
   * The finished tasks Jig still keeps, the latest first, one line a task — its id, how it ended, its goal, its pull
   * request, its day and what Jig offers to do with it —; `query` keeps those whose id or goal holds its words.
   */
  const props = defineProps<{
    /** The read of the finished tasks Jig still keeps; none yet while it runs. */
    read?: Finished;
    /** The task whose write is on its way to Jig: every menu waits for it. */
    pending?: string;
    query?: string;
  }>();

  defineEmits<{
    readAgain: [];
    write: [task: string, write: (typeof FINISHED_WRITES)[number]['write']];
  }>();

  const none = computed(() => props.read && noFinished(props.read));
  const rows = computed(() => {
    if (props.read?.state !== 'ready') return [];
    const words = (props.query ?? '').trim().toLowerCase();
    return latestFirst(props.read.tasks)
      .filter((t) => !words || `${t.id} ${t.goal ?? ''}`.toLowerCase().includes(words))
      .map((task) => ({ task, ...finished(task) }));
  });
</script>

<template>
  <ReadingLine v-if="read === undefined" class="py-2">Reading the finished tasks…</ReadingLine>
  <p v-else-if="none" class="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-[13px] text-muted-foreground">
    {{ none }}
    <Button v-if="read.state === 'unreadable'" variant="outline" size="xs" @click="$emit('readAgain')">Read again</Button>
  </p>
  <p v-else-if="rows.length === 0" class="py-2 text-[13px] text-muted-foreground">No finished task matches that.</p>
  <ul v-else aria-label="Finished tasks" class="rounded-lg border bg-card">
    <li
      v-for="{ task, word, pr } in rows"
      :key="task.id"
      class="grid grid-cols-[minmax(0,13rem)_5.5rem_minmax(0,1fr)_auto] items-center gap-3 border-b px-3 py-2 last:border-b-0 sm:grid-cols-[minmax(0,13rem)_5.5rem_minmax(0,1fr)_7rem_5.5rem_auto]"
    >
      <span class="truncate font-mono text-xs font-medium" :class="idAccent" :title="task.id">{{ task.id }}</span>
      <Badge class="w-fit border-transparent font-semibold" :class="endingAccent[word] ?? endingAccent.archived">{{ word }}</Badge>
      <span class="min-w-0 truncate text-[13px] text-foreground/80" :title="task.goal ?? undefined">{{ task.goal }}</span>
      <span class="hidden min-w-0 sm:block">
        <template v-if="pr">
          <a
            v-if="pr.url"
            :href="pr.url"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <span class="truncate font-mono">{{ pr.text }}</span><ExternalLink class="size-3 shrink-0" />
          </a>
          <span v-else class="truncate font-mono text-xs text-muted-foreground">{{ pr.text }}</span>
        </template>
      </span>
      <span class="hidden text-xs text-muted-foreground tabular-nums sm:block">{{ task.updatedAt }}</span>
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
      <span v-else class="size-6" aria-hidden="true" />
    </li>
  </ul>
</template>
