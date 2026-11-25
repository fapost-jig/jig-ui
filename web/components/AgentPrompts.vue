<script setup lang="ts">
  import type { AgentPrompt } from '@/lib/agent-prompts';
  import CopyButton from './CopyButton.vue';
  import GroupPanel from './GroupPanel.vue';

  /** What to tell the person's agent about the task, each sentence to copy. */
  defineProps<{
    prompts: AgentPrompt[];
  }>();
</script>

<template>
  <GroupPanel aria-labelledby="ask-agent">
    <template #head><h2 id="ask-agent" class="px-4 pt-3 pb-2 text-[15px] font-semibold">Ask your agent</h2></template>
    <ul class="flex flex-col gap-2 px-2 pb-2">
      <li v-for="p in prompts" :key="p.text" class="flex flex-col gap-1 rounded-lg bg-card px-3 py-2.5 ring-1 ring-border">
        <p class="text-[13px]">{{ p.text }}</p>
        <div class="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{{ p.when }}</span>
          <CopyButton :text="p.text" class="ml-auto" />
        </div>
      </li>
    </ul>
  </GroupPanel>
</template>
