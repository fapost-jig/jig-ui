<script setup lang="ts">
  import { Bot, CircleHelp, ExternalLink, GitPullRequest, Link2, Pause, ShieldCheck, Waypoints } from '@lucide/vue';
  import { type Component, computed } from 'vue';
  import { toneText } from '@/lib/tones';
  import { type NoteIcon, parseRef, type waits } from '@/lib/waits';

  /**
   * What a task waits for, as `waits` words it, led by its icon in its tone: on a card and at the head of the task's
   * page. `link` shows the pull request's link the note names, where nothing beside it already does.
   */
  const props = defineProps<{
    project: string;
    note: NonNullable<ReturnType<typeof waits>>;
    link?: boolean;
  }>();

  /** Each kind of note's icon. */
  const icons: Record<NoteIcon, Component> = {
    gate: ShieldCheck,
    ask: CircleHelp,
    pause: Pause,
    wait: Link2,
    bot: Bot,
    pull: GitPullRequest,
    staging: Waypoints,
  };

  /** The queue item the note says it waits for: a task opens its page; an epic is only named. */
  const waitsOn = computed(() => {
    const ref = props.note.ref;
    return ref ? parseRef(ref) : undefined;
  });
</script>

<template>
  <p class="flex min-w-0 items-center gap-1.5 text-[13px]" :class="toneText[note.tone]">
    <component :is="icons[note.icon]" class="size-3.5 shrink-0" aria-hidden="true" />
    <span>{{ note.text }}</span>
    <template v-if="waitsOn">
      <RouterLink
        v-if="waitsOn.kind === 'task'"
        :to="`/projects/${encodeURIComponent(project)}/tasks/${encodeURIComponent(waitsOn.id)}`"
        class="min-w-0 truncate font-mono text-xs font-semibold hover:underline"
        >{{ waitsOn.id }}</RouterLink
      >
      <span v-else class="min-w-0 truncate font-mono text-xs font-semibold">epic {{ waitsOn.id }}</span>
      <span v-if="note.more" class="shrink-0">+{{ note.more }}</span>
    </template>
    <a
      v-if="link && note.url"
      :href="note.url"
      target="_blank"
      rel="noopener noreferrer"
      class="inline-flex items-center gap-1 underline underline-offset-2"
    >
      open<ExternalLink class="size-3" />
    </a>
  </p>
</template>
