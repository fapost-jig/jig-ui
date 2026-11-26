<script setup lang="ts">
  import ReadingLine from './ReadingLine.vue';
  import { computed } from 'vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { prose, rendered } from '@/lib/markdown';
  import { columnAccent } from '@/lib/tones';
  import { Loader2 } from '@lucide/vue';
  import GroupPanel from './GroupPanel.vue';

  /** A design waiting at its gate, shown as written, and the approval under it: pressing Approve is the decision. A refusal is a toast the view raises. */
  const props = defineProps<{
    /** The documents Jig approves, in order, each as read — `null` when the task does not have it; `undefined` while they are read. */
    documents?: {
      kind: string;
      content: string | null;
    }[];
    busy: boolean;
    /** Which of the two presses is on its way: the spinner shows on that one. */
    sending?: 'approve' | 'answer';
    /** Jig offers an answer to the design here (its `answer-gate`, from 0.48.0). */
    answerable?: boolean;
  }>();

  const emit = defineEmits<{
    approve: [];
    /** The person's answer instead of a yes: Jig records it, and the agent reworks the design when it resumes the task. */
    answer: [text: string];
    readAgain: [];
  }>();

  /** The answer being written; kept until Jig took it. */
  const answer = defineModel<string>('answer', { default: '' });
  const blank = computed(() => answer.value.trim() === '');

  const shown = computed(() => props.documents?.map((d) => ({ kind: d.kind, html: d.content === null ? null : rendered(d.content) })));
  const missing = computed(() => props.documents?.some((d) => d.content === null) ?? true);
</script>

<template>
  <GroupPanel :accent="columnAccent['needs-you']" aria-labelledby="gate">
    <template #head
      ><h2 id="gate" class="px-4 pt-3 pb-2 text-[15px] font-semibold">Needs you: the design waits for your decision</h2></template
    >
    <div class="flex flex-col gap-3 px-4 pb-4">
      <ReadingLine v-if="shown === undefined">Reading the design…</ReadingLine>
      <template v-else>
        <article v-for="d in shown" :key="d.kind" class="rounded-lg bg-card px-4 py-3 ring-1 ring-border">
          <p class="mb-2 font-mono text-xs text-muted-foreground">{{ d.kind }}.md</p>
          <p v-if="d.html === null" class="text-[13px] text-muted-foreground">Jig could not read it.</p>
          <!-- eslint-disable-next-line vue/no-v-html -- cleaned by DOMPurify in lib/markdown.ts -->
          <div v-else :class="prose" v-html="d.html" />
        </article>
      </template>
      <div v-if="answerable" class="flex flex-col gap-1.5">
        <label for="gate-answer" class="text-[13px] font-medium">Your answer, if not a yes</label>
        <!-- One line: Jig takes an answer without line breaks or tabs. -->
        <Input
          id="gate-answer"
          v-model="answer"
          maxlength="2000"
          class="bg-card text-[13px]"
          :disabled="busy"
          placeholder="What to change in the design, in one line"
        />
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <Button size="sm" :disabled="busy || missing" @click="emit('approve')"
          ><Loader2 v-if="busy && sending !== 'answer'" class="animate-spin" />{{
            busy && sending !== 'answer' ? 'Sending…' : 'Approve the design'
          }}</Button
        >
        <Button v-if="answerable" variant="outline" size="sm" :disabled="busy || missing || blank" @click="emit('answer', answer.trim())"
          ><Loader2 v-if="busy && sending === 'answer'" class="animate-spin" />{{
            busy && sending === 'answer' ? 'Sending…' : 'Send the answer'
          }}</Button
        >
        <Button variant="ghost" size="sm" :disabled="busy" @click="emit('readAgain')">Read it again</Button>
      </div>
      <p class="text-[13px] text-muted-foreground">
        Jig takes the decision on the design as shown here; one rewritten since is refused. Your agent reads it when it resumes the task —
        an agent waiting in a chat does not see it: tell it to continue, with a sentence from Ask your agent.
      </p>
    </div>
  </GroupPanel>
</template>
