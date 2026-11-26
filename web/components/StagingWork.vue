<script setup lang="ts">
  import { Loader2 } from '@lucide/vue';
  import { onUnmounted, watch } from 'vue';
  import { Button } from '@/components/ui/button';
  import { ago } from '@/lib/ago';
  import { type AckState, countOf, type OwnStaging } from '@/lib/staging';
  import { reporter } from '@/lib/report';
  import { toneRule } from '@/lib/tones';

  /**
   * The person's own commits on staging that the base does not have and no live task's branch holds, opened from the
   * bell on the project's card: each by its subject, when it was made and its short sha, and **Mark as known** for all of
   * them, those shown — refused when the list has changed since. `ack`: that is under way, or was refused; a refusal is
   * a toast that stays until closed, and closing it is the refusal dismissed.
   */
  const props = defineProps<{
    project: string;
    staging: OwnStaging;
    ack?: AckState;
  }>();

  const emit = defineEmits<{
    /** Mark as known: the view asks Jig to mark the commits the person sees, by their count and shas. */
    ack: [expect: number, shas: string[]];
    dismiss: [];
  }>();

  const refusing = reporter(`ack:${props.project}`, () => emit('dismiss'));
  // The toast goes with the list: closing the list, or leaving the card, is not the person closing the refusal.
  onUnmounted(refusing.clear);

  watch(
    () => props.ack,
    (ack) => {
      if (ack?.state !== 'refused') return refusing.clear();
      refusing.show({
        kind: 'error',
        title: ack.message,
        description: ack.reasons.map((r) => `• ${r}`).join('\n') || undefined,
        descriptionClass: 'whitespace-pre-line',
      });
    },
    { immediate: true },
  );
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
      ><Loader2 v-if="ack?.state === 'running'" class="animate-spin" />{{ ack?.state === 'running' ? 'Marking…' : 'Mark as known' }}</Button
    >
  </section>
</template>
