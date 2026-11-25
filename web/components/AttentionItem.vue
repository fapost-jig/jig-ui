<script setup lang="ts">
  import { ExternalLink, Loader2 } from '@lucide/vue';
  import { computed } from 'vue';
  import { type Attention, link, type PrStatus as Status } from '@/api';
  import { Button } from '@/components/ui/button';
  import { minute } from '@/lib/clock';
  import { itemLine } from '@/lib/pr-status';
  import type { ItemWrite } from '@/lib/projects';
  import { toneRule } from '@/lib/tones';
  import PrStatus from './PrStatus.vue';
  import WriteConfirm from './WriteConfirm.vue';

  /**
   * `project`: the project the item is about, given where the item can link to its page — the workspace card.
   * `closes`: the item's task, where it can be closed as done from here. `writes`: where the item's task's pull request
   * can be merged, landed on staging or asked where it stands from here, the item's offers; `who`: who merges it.
   * `writing`: the item's write on its way to Jig. `prStatus`: where its pull request stands is open, `read` once the
   * forge answered. `refreshable`: a clone behind origin can be brought up from here; `refreshing`: that refresh is on
   * its way to Jig.
   */
  const props = defineProps<{
    item: Attention;
    project?: string;
    closes?: string;
    writes?: boolean;
    who?: string;
    writing?: ItemWrite;
    prStatus?: {
      read?: Status;
    };
    refreshable?: boolean;
    refreshing?: boolean;
  }>();

  defineEmits<{
    /** Close task, confirmed: the view closes the item's task. */
    close: [task: string];
    /** Merge, confirmed: the view merges the item's task's pull request. */
    merge: [task: string];
    /** Land on staging: the view lands the item's task. */
    land: [task: string];
    /** Status…, or its Close: the view asks the forge where the pull request stands, or closes that. */
    status: [task: string];
    unstatus: [];
    /** Refresh on a clone behind origin: the view runs `jig refresh` in the project. */
    refresh: [];
  }>();

  /** Knowledge waiting for the person is decided on the project's page, in its Knowledge view. */
  const decide = computed(() =>
    props.project !== undefined && (props.item.kind === 'knowledge-proposed' || props.item.kind === 'sources-changed')
      ? { path: `/projects/${encodeURIComponent(props.project)}`, query: { view: 'knowledge' } }
      : undefined,
  );

  /** The item's task's pull request in words, from the forge cache; Jig's own lines where there is none. */
  const said = computed(() => itemLine(props.item, minute.value.getTime()));
  const task = computed(() => props.item.subject.id ?? undefined);
  const offers = computed(() => (props.writes && task.value ? (props.item.offers ?? []) : []));

  /** The question before the task is closed, or its pull request merged, is open: one press asks, the question's button writes. */
  const asking = defineModel<boolean>('asking', { default: false });
</script>

<template>
  <div :class="toneRule.attention" class="flex flex-col gap-2">
    <div class="flex items-start gap-3">
      <div class="min-w-0 flex-1">
        <p class="font-medium">
          {{ item.title
          }}<span v-if="item.subject.id" class="font-normal">
            — <code class="text-xs">{{ item.subject.id }}</code></span
          >
        </p>
        <p v-if="said" class="text-[13px] text-muted-foreground">{{ said }}</p>
        <p v-else-if="item.detail" class="text-[13px] text-muted-foreground">{{ item.detail }}</p>
        <p class="text-foreground">
          {{ said ? (who ?? '') : item.todo }}
          <a
            v-if="link(item.url)"
            :href="link(item.url)"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 underline underline-offset-2"
          >
            {{ item.kind.startsWith('pull-request') ? 'Open pull request' : 'Open link' }}<ExternalLink class="size-3" />
          </a>
          <RouterLink v-if="decide" :to="decide" class="underline underline-offset-2">Decide on the page</RouterLink>
        </p>
      </div>
      <div v-if="offers.length || (refreshable && item.kind === 'base-behind-origin') || closes" class="flex shrink-0 gap-2">
        <Button
          v-if="refreshable && item.kind === 'base-behind-origin'"
          variant="outline"
          size="xs"
          class="text-foreground"
          :disabled="refreshing"
          @click="$emit('refresh')"
        >
          <Loader2 v-if="refreshing" class="animate-spin" />{{ refreshing ? 'Refreshing…' : 'Refresh' }}
        </Button>
        <Button
          v-if="closes"
          variant="outline"
          size="xs"
          class="text-foreground"
          :disabled="writing !== undefined"
          :aria-label="`Close ${closes} as done`"
          :aria-expanded="asking"
          @click="asking = !asking"
        >
          <Loader2 v-if="writing === 'close'" class="animate-spin" />{{ writing === 'close' ? 'Closing…' : 'Close task' }}
        </Button>
        <Button
          v-if="offers.includes('merge')"
          variant="outline"
          size="xs"
          class="text-foreground"
          :disabled="writing !== undefined"
          :aria-label="`Merge ${task}'s pull request`"
          :aria-expanded="asking"
          @click="asking = !asking"
        >
          <Loader2 v-if="writing === 'merge'" class="animate-spin" />{{ writing === 'merge' ? 'Merging…' : 'Merge…' }}
        </Button>
        <Button
          v-if="offers.includes('land') && task"
          variant="outline"
          size="xs"
          class="text-foreground"
          :disabled="writing !== undefined"
          :aria-label="`Land ${task} on staging`"
          @click="$emit('land', task)"
        >
          <Loader2 v-if="writing === 'land'" class="animate-spin" />{{ writing === 'land' ? 'Landing…' : 'Land on staging' }}
        </Button>
        <Button
          v-if="offers.includes('pr-status') && task"
          variant="ghost"
          size="xs"
          class="text-foreground"
          :aria-label="`Where ${task}'s pull request stands`"
          :aria-expanded="prStatus !== undefined"
          @click="prStatus ? $emit('unstatus') : $emit('status', task)"
        >
          Status…
        </Button>
      </div>
    </div>
    <WriteConfirm
      v-if="(closes || (offers.includes('merge') && task)) && asking && writing === undefined"
      :write="closes ? 'close' : 'merge'"
      :task="closes ?? task!"
      @confirm="
        asking = false;
        closes ? $emit('close', closes) : $emit('merge', task!);
      "
      @cancel="asking = false"
    />
    <PrStatus v-if="prStatus && task" :task="task" :status="prStatus.read" @close="$emit('unstatus')" />
  </div>
</template>
