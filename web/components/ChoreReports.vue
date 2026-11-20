<script setup lang="ts">
  import { Button } from '@/components/ui/button';
  import type { HousekeepingState, RefreshState } from '@/lib/projects';
  import { toneRule } from '@/lib/tones';

  /**
   * What came of Refresh and Housekeeping in a project, on its card and its page: under way, Jig's answer in the page's
   * words, or why it did not run, each until dismissed.
   */
  defineProps<{
    project: string;
    refresh?: RefreshState;
    housekeeping?: HousekeepingState;
  }>();

  defineEmits<{
    dismissRefresh: [];
    dismissHousekeeping: [];
  }>();
</script>

<template>
  <section v-if="refresh" :aria-label="`Refresh of ${project}`" class="text-[13px]">
    <p v-if="refresh.state === 'running'" :class="toneRule.quiet">
      Running <code>jig refresh</code>… It fetches origin; a dialog for your git credentials may wait for you.
    </p>
    <div v-else :class="toneRule[refresh.state === 'done' ? refresh.tone : 'bad']" class="flex flex-col gap-1">
      <p v-for="(line, i) in refresh.state === 'done' ? refresh.lines : [refresh.message]" :key="i">{{ line }}</p>
      <Button variant="ghost" size="xs" class="self-start" @click="$emit('dismissRefresh')">Dismiss</Button>
    </div>
  </section>
  <section v-if="housekeeping" :aria-label="`Housekeeping in ${project}`" class="text-[13px]">
    <p v-if="housekeeping.state === 'running'" :class="toneRule.quiet">
      Running <code>jig housekeeping</code>… It fetches and asks the forge; a dialog for your git credentials may wait for you.
    </p>
    <div v-else-if="housekeeping.state === 'done'" :class="toneRule.quiet" class="flex flex-col gap-1">
      <p class="whitespace-pre-wrap">{{ housekeeping.report.join('\n') || 'Housekeeping ran and said nothing.' }}</p>
      <Button variant="ghost" size="xs" class="self-start" @click="$emit('dismissHousekeeping')">Dismiss</Button>
    </div>
    <div v-else :class="toneRule.bad" class="flex flex-col gap-1">
      <p>{{ housekeeping.message }}</p>
      <ul v-if="housekeeping.reasons.length" class="list-disc pl-5 text-foreground">
        <li v-for="(reason, i) in housekeeping.reasons" :key="i">{{ reason }}</li>
      </ul>
      <Button variant="ghost" size="xs" class="self-start" @click="$emit('dismissHousekeeping')">Dismiss</Button>
    </div>
  </section>
</template>
