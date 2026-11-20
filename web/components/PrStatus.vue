<script setup lang="ts">
  import { ExternalLink } from '@lucide/vue';
  import { computed } from 'vue';
  import { link, type PrStatus } from '@/api';
  import { Button } from '@/components/ui/button';
  import { blockersLine, checkLine, reviewLine, rulesLine, statusLine } from '@/lib/pr-status';
  import { toneRule, toneText } from '@/lib/tones';

  /**
   * Where a task's pull request stands on the forge, read when the person opened it, `undefined` while that runs: what
   * holds its merge back, each check with how long it ran and a link to the one that failed, the review, and what the
   * base branch's rules ask.
   */
  const props = defineProps<{
    task: string;
    status?: PrStatus;
  }>();

  defineEmits<{
    close: [];
  }>();

  const line = computed(() => statusLine(props.status, props.task));
  const read = computed(() => (props.status?.state === 'ready' ? props.status : undefined));
  const held = computed(() => read.value && blockersLine(read.value));
  const rules = computed(() => read.value && rulesLine(read.value.protection, read.value.pullRequest.base));
</script>

<template>
  <section :aria-label="`Status of ${task}'s pull request`" :class="toneRule.quiet" class="flex flex-col gap-2 text-[13px]">
    <p v-if="line" :role="status ? undefined : 'status'">{{ line }}</p>
    <template v-else-if="read && held">
      <p :class="toneText[held.tone]">{{ held.text }}</p>
      <ul v-if="read.checks.list.length" class="flex flex-col gap-1 text-foreground">
        <li v-for="c in read.checks.list" :key="c.name" class="flex items-baseline gap-2">
          <span class="min-w-0 font-mono text-xs break-words">{{ c.name }}</span>
          <span class="ml-auto shrink-0" :class="toneText[checkLine(c).tone]">{{ checkLine(c).text }}</span>
          <a
            v-if="link(c.url) && checkLine(c).tone === 'bad'"
            :href="link(c.url)"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex shrink-0 items-center gap-1 underline underline-offset-2"
            :aria-label="`Open the check ${c.name}`"
          >
            open<ExternalLink class="size-3" />
          </a>
        </li>
      </ul>
      <p v-else class="text-foreground">No check has run on it.</p>
      <p class="text-foreground">{{ reviewLine(read.review) }}</p>
      <p v-if="rules">{{ rules }}</p>
    </template>
    <div class="flex items-center gap-2">
      <Button variant="ghost" size="xs" @click="$emit('close')">Close</Button>
      <a
        v-if="read && link(read.pullRequest.url)"
        :href="link(read.pullRequest.url)"
        target="_blank"
        rel="noopener noreferrer"
        class="inline-flex items-center gap-1 underline underline-offset-2"
      >
        open pull request<ExternalLink class="size-3" />
      </a>
    </div>
  </section>
</template>
