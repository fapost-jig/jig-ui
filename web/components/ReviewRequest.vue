<script setup lang="ts">
  import { computed, ref } from 'vue';
  import type { Reviewers } from '@/api';
  import { Button } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
  import { reviewersLine } from '@/lib/staging';
  import { toneRule } from '@/lib/tones';

  /**
   * Whom to ask for a review of a task's pull request into staging, from the people the forge offers — read when the
   * person opened it, `undefined` while that runs: those who reviewed here most often first, or everyone the repository
   * may ask. Those the review waits for already are ticked and asked.
   */
  const props = defineProps<{
    task: string;
    reviewers?: Reviewers;
    /** The logins the review waits for already, as the forge cache last heard it. */
    asked: string[];
  }>();

  const emit = defineEmits<{
    ask: [logins: string[]];
    cancel: [];
  }>();

  const ticked = ref<string[]>([]);
  const line = computed(() => reviewersLine(props.reviewers));
  const candidates = computed(() => (props.reviewers?.state === 'ready' ? props.reviewers.candidates : []));

  function tick(login: string, on: boolean): void {
    ticked.value = on ? [...ticked.value, login] : ticked.value.filter((l) => l !== login);
  }
</script>

<template>
  <section :aria-label="`Request review of ${task}`" :class="toneRule.attention" class="flex flex-col gap-2 text-[13px]">
    <p v-if="line" :role="reviewers ? undefined : 'status'">{{ line }}</p>
    <template v-else>
      <p v-if="reviewers?.state === 'ready' && reviewers.source === 'assignable'" class="text-muted-foreground">
        Nobody reviewed here lately: everyone the repository may ask.
      </p>
      <ul class="flex flex-col gap-1.5 text-foreground">
        <li v-for="c in candidates" :key="c.login" class="flex items-center gap-2">
          <Checkbox
            :id="`review-${task}-${c.login}`"
            :model-value="asked.includes(c.login) || ticked.includes(c.login)"
            :disabled="asked.includes(c.login)"
            @update:model-value="(on) => tick(c.login, on === true)"
          />
          <label :for="`review-${task}-${c.login}`" class="flex min-w-0 flex-1 items-baseline gap-2">
            <span class="font-mono text-xs">{{ c.login }}</span>
            <span v-if="c.name" class="truncate text-muted-foreground">{{ c.name }}</span>
            <span class="ml-auto shrink-0 text-xs text-muted-foreground">
              {{ asked.includes(c.login) ? 'asked' : c.reviews !== null ? `${c.reviews} review${c.reviews === 1 ? '' : 's'}` : '' }}
            </span>
          </label>
        </li>
      </ul>
    </template>
    <div class="flex gap-2">
      <Button v-if="candidates.length" size="xs" :disabled="ticked.length === 0" @click="emit('ask', ticked)">Ask</Button>
      <Button variant="ghost" size="xs" @click="emit('cancel')">Cancel</Button>
    </div>
  </section>
</template>
