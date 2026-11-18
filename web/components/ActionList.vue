<script setup lang="ts">
  import { computed } from 'vue';
  import { listedActions } from '@/lib/writes';
  import CopyCommand from './CopyCommand.vue';

  /**
   * The actions Jig offers that the page does not run, each with its command to copy; on a Jig that takes a person's
   * writes, starting a task is the request for the person's agent instead, which does that work.
   */
  const props = defineProps<{
    actions: {
      id: string;
      command: string;
    }[];
    project: string;
    task: string;
    /** The ones the page runs as buttons, left out here. */
    runs?: Set<string>;
    /** The project's Jig takes a person's writes (0.46.0): the page asks the agent to start the task. */
    writes?: boolean;
  }>();

  const shown = computed(() =>
    listedActions(props.actions, props.runs ?? new Set(), props.writes, props.task, props.project).map((a) => ({
      ...a,
      label: a.asks ? 'Ask your agent to start it' : (ACTIONS[a.id] ?? a.id),
    })),
  );

  /** What each of Jig's actions is called on the page; an id this page does not know shows as it is. */
  const ACTIONS: Record<string, string> = {
    start: 'Start it',
    pause: 'Pause it',
    resume: 'Resume it',
    'request-pause': 'Ask it to pause',
    'cancel-pause-request': 'Take back the pause request',
    'approve-gate': 'Approve the design',
    'answer-stop': "Answer the autopilot's question",
    'set-class': 'Change its class',
    ship: 'Ship it',
    close: 'Close it',
    abandon: 'Abandon it',
    archive: 'Archive it',
    reopen: 'Reopen it',
  };
</script>

<template>
  <p v-if="shown.length === 0" class="text-muted-foreground">Nothing for now.</p>
  <ul v-else class="flex flex-col gap-2">
    <li v-for="action in shown" :key="action.id">
      <p class="text-[13px] text-muted-foreground">{{ action.label }}</p>
      <CopyCommand :command="action.command" class="mt-1" />
    </li>
  </ul>
</template>
