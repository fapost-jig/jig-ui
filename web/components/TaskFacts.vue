<script setup lang="ts">
  import { computed } from 'vue';
  import type { ReadyDetails } from '@/api';
  import { ago } from '@/lib/ago';
  import { minute } from '@/lib/clock';
  import { shownPull } from '@/lib/pull';
  import { placeLine, priorityLabel, waitLine } from '@/lib/queue';
  import { classAccent, columnAccent, priorityAccent, toneRule, toneText } from '@/lib/tones';
  import { pullRequests } from '@/lib/waits';
  import { Badge } from '@/components/ui/badge';
  import PullChip from './PullChip.vue';

  /** `stop`: the autopilot's question under the facts, where the page does not show it elsewhere. */
  const props = withDefaults(
    defineProps<{
      details: ReadyDetails;
      stop?: boolean;
    }>(),
    { stop: true },
  );

  const now = computed(() => minute.value.getTime());
  const pull = computed(() => shownPull(props.details));
  const when = (at: string | null): string => (at ? ago(at, now.value) || at : '—');
</script>

<template>
  <div class="@container flex flex-col gap-3">
    <!-- Narrow: each label above its value; wider: side by side, a hairline between the rows. -->
    <dl
      class="grid grid-cols-1 text-[13px] @2xs:grid-cols-[max-content_1fr] @2xs:gap-x-4 [&>dd]:pb-2 @2xs:[&>dd]:py-1.5 [&>dt]:text-muted-foreground @2xs:[&>dt]:py-1.5"
    >
      <dt>Priority</dt>
      <dd>
        <Badge v-if="details.priority !== null" class="border-transparent font-semibold" :class="priorityAccent(details.priority)"
          >P{{ details.priority }}</Badge
        >
        <template v-else>{{ priorityLabel(details.priority) }}</template>
      </dd>
      <dt>Class</dt>
      <dd>
        <Badge v-if="details.class" class="border-transparent font-semibold" :class="classAccent(details.class)">{{ details.class }}</Badge>
        <template v-else>not classified yet</template>
      </dd>
      <dt>Column</dt>
      <dd class="flex items-center gap-1.5">
        <span class="size-2 rounded-full" :class="columnAccent[details.column.id] ?? 'bg-muted-foreground'" aria-hidden="true" />
        {{ details.column.title }}{{ details.paused ? ', paused' : '' }}
      </dd>
      <dt>Queue</dt>
      <dd>{{ placeLine(details) }}</dd>
      <dt>Waits for</dt>
      <dd>
        <!-- The task's page changes it here. -->
        <slot name="waits">
          <template v-if="details.dependsOn.length === 0">nothing in the queue</template>
          <ul v-else>
            <li v-for="d in details.dependsOn" :key="`${d.through}>${d.on}`">{{ waitLine(d) }}</li>
          </ul>
        </slot>
      </dd>
      <template v-if="pull">
        <dt>Pull request</dt>
        <dd class="flex flex-col gap-1">
          <span class="flex flex-wrap items-center gap-2">
            <PullChip :pull="pull" />
            <span v-for="pr in pullRequests(details)" :key="pr.title" class="text-muted-foreground">{{ pr.text }}</span>
          </span>
          <span v-if="(details.promotion ?? details.pullRequest)?.fetchedAt" class="text-xs text-muted-foreground"
            >as housekeeping heard it {{ when((details.promotion ?? details.pullRequest)!.fetchedAt) }}</span
          >
        </dd>
      </template>
      <template v-if="details.autopilot && details.run">
        <dt>Autopilot</dt>
        <dd>
          {{ details.autopilot }}{{ details.run.mode ? `, ${details.run.mode}` : ''
          }}{{ details.run.phase ? `, phase ${details.run.phase}` : ''
          }}<template v-if="details.run.stage">
            · {{ details.run.stage }}<template v-if="details.run.stageAt"> since {{ when(details.run.stageAt) }}</template></template
          >
        </dd>
      </template>
      <template v-if="details.gate">
        <dt>Gate</dt>
        <dd>
          <template v-if="details.gate === 'waiting'">the design waits for a decision</template>
          <template v-else-if="details.gate === 'changed'">the design changed after it was approved</template>
          <template v-else-if="details.gate === 'answered'">answered; waits for the agent to rework the design</template>
          <template v-else>approved{{ details.gateBy ? ` by ${details.gateBy === 'human' ? 'a person' : 'an agent'}` : '' }}</template>
        </dd>
      </template>
      <dt>Branch</dt>
      <dd class="break-all">
        <template v-if="details.branch"
          ><code class="font-mono text-xs">{{ details.branch }}</code> →
          <code class="font-mono text-xs">{{ details.baseBranch }}</code></template
        >
        <template v-else
          >not started; will land on <code class="font-mono text-xs">{{ details.baseBranch }}</code></template
        >
      </dd>
      <template v-if="details.worktree">
        <dt>Worktree</dt>
        <dd>{{ details.worktree.uncommitted }} uncommitted {{ details.worktree.uncommitted === 1 ? 'file' : 'files' }}</dd>
      </template>
      <template v-if="details.issue">
        <dt>Issue</dt>
        <dd class="font-mono text-xs">{{ details.issue }}</dd>
      </template>
      <dt>Knowledge</dt>
      <dd :class="!details.knowledgeConsolidated && toneText.attention">
        {{ details.knowledgeConsolidated ? 'decision recorded' : 'decision not recorded yet' }}
      </dd>
      <dt>Filed</dt>
      <dd>{{ details.createdAt ?? '—' }} · changed {{ when(details.updatedAt) }}</dd>
    </dl>
    <div v-if="stop && details.autopilot === 'stopped' && details.run?.stopReason" :class="toneRule.attention" role="note">
      <p class="font-semibold">
        The autopilot asks<template v-if="details.run.stopAt"> ({{ when(details.run.stopAt) }})</template>
      </p>
      <p class="text-foreground">{{ details.run.stopReason }}</p>
    </div>
  </div>
</template>
