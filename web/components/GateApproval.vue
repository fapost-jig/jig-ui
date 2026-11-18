<script setup lang="ts">
  import { computed } from 'vue';
  import { Button } from '@/components/ui/button';
  import { prose, rendered } from '@/lib/markdown';
  import { columnAccent, toneRule } from '@/lib/tones';
  import GroupPanel from './GroupPanel.vue';

  /** A design waiting at its gate, shown as written, and the approval under it: pressing Approve is the decision. */
  const props = defineProps<{
    /** The documents Jig approves, in order, each as read — `null` when the task does not have it; `undefined` while they are read. */
    documents?: {
      kind: string;
      content: string | null;
    }[];
    busy: boolean;
    /** Why the last approval was refused. */
    refusal?: string;
  }>();

  defineEmits<{
    approve: [];
    readAgain: [];
  }>();

  const shown = computed(() => props.documents?.map((d) => ({ kind: d.kind, html: d.content === null ? null : rendered(d.content) })));
  const missing = computed(() => props.documents?.some((d) => d.content === null) ?? true);
</script>

<template>
  <GroupPanel :accent="columnAccent['needs-you']" aria-labelledby="gate">
    <template #head><h2 id="gate" class="px-4 pt-3 pb-2 text-[15px] font-semibold">The design waits for your approval</h2></template>
    <div class="flex flex-col gap-3 px-4 pb-4">
      <p v-if="shown === undefined" class="text-[13px] text-muted-foreground">Reading the design…</p>
      <template v-else>
        <article v-for="d in shown" :key="d.kind" class="rounded-lg bg-card px-4 py-3 ring-1 ring-border">
          <p class="mb-2 font-mono text-xs text-muted-foreground">{{ d.kind }}.md</p>
          <p v-if="d.html === null" class="text-[13px] text-muted-foreground">Jig could not read it.</p>
          <!-- eslint-disable-next-line vue/no-v-html -- cleaned by DOMPurify in lib/markdown.ts -->
          <div v-else :class="prose" v-html="d.html" />
        </article>
      </template>
      <p v-if="refusal" role="alert" :class="toneRule.attention">{{ refusal }}</p>
      <div class="flex flex-wrap items-center gap-2">
        <Button size="sm" :disabled="busy || missing" @click="$emit('approve')">{{ busy ? 'Approving…' : 'Approve the design' }}</Button>
        <Button variant="ghost" size="sm" :disabled="busy" @click="$emit('readAgain')">Read it again</Button>
        <p class="text-[13px] text-muted-foreground">Jig approves the design as shown here; one rewritten since is not approved.</p>
      </div>
    </div>
  </GroupPanel>
</template>
