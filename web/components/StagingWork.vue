<script setup lang="ts">
  import { Button } from '@/components/ui/button';
  import { ago } from '@/lib/ago';
  import { type AckState, countOf, type OwnStaging } from '@/lib/staging';
  import { toneRule } from '@/lib/tones';

  /**
   * The person's own commits on staging that the base does not have and no live task's branch holds, opened from the
   * bell on the project's card: each by its subject, when it was made and its short sha, and **Mark as known** for all of
   * them, those shown — refused when the list has changed since. `ack`: that is under way, or was refused.
   */
  defineProps<{
    project: string;
    staging: OwnStaging;
    ack?: AckState;
  }>();

  defineEmits<{
    /** Mark as known: the view asks Jig to mark the commits the person sees, by their count and shas. */
    ack: [expect: number, shas: string[]];
    dismiss: [];
  }>();
</script>

<template>
  <section :aria-label="`Your work on staging in ${project}`" :class="toneRule.attention" class="flex flex-col gap-2 text-[13px]">
    <p class="font-medium">{{ countOf(staging) }} on staging that the base does not have and no live task holds</p>
    <ul class="flex flex-col gap-1 text-foreground">
      <li v-for="commit in staging.list" :key="commit.sha" class="flex min-w-0 items-baseline gap-2">
        <span class="min-w-0 flex-1 truncate" :title="commit.subject">{{ commit.subject }}</span>
        <span class="shrink-0 text-muted-foreground" :title="commit.date">{{ ago(commit.date) }}</span>
        <code class="shrink-0 text-xs text-muted-foreground" :title="commit.sha">{{ commit.sha.slice(0, 7) }}</code>
      </li>
    </ul>
    <p class="text-muted-foreground">
      Bring what the base still needs to it through a task. Mark as known keeps the bell dark until a new commit of yours lands; nothing is
      taken off staging.
    </p>
    <Button
      variant="outline"
      size="xs"
      class="self-start text-foreground"
      :disabled="ack?.state === 'running'"
      @click="
        $emit(
          'ack',
          staging.commits,
          staging.list.map((c) => c.sha),
        )
      "
      >{{ ack?.state === 'running' ? 'Marking…' : 'Mark as known' }}</Button
    >
    <div v-if="ack?.state === 'refused'" :class="toneRule.bad" class="flex flex-col gap-1">
      <p>{{ ack.message }}</p>
      <ul v-if="ack.reasons.length" class="list-disc pl-5 text-foreground">
        <li v-for="(reason, i) in ack.reasons" :key="i">{{ reason }}</li>
      </ul>
      <Button variant="ghost" size="xs" class="self-start" @click="$emit('dismiss')">Dismiss</Button>
    </div>
  </section>
</template>
