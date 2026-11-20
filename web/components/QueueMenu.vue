<script setup lang="ts">
  import {
    ArrowDown,
    ArrowDownToLine,
    ArrowUp,
    ArrowUpToLine,
    Ellipsis,
    GitMerge,
    ListChecks,
    Pause,
    Play,
    Rocket,
    Undo2,
    UserPlus,
    Wrench,
  } from '@lucide/vue';
  import { computed } from 'vue';
  import type { Place, Task } from '@/api';
  import { Button } from '@/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRadioGroup,
    DropdownMenuRadioItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { ends, step } from '@/lib/placement';

  /**
   * What a drag does, in one press: a task's place in Jig's queue within its column, its priority, a pause asked of it, a
   * resume, and taking a task parked at the staging branch back for a fix (Jig's resume too). First, where Jig offers
   * them, the person's own steps on its pull request: merging it, or on the staging flow landing on staging, asking for
   * reviews, preparing for prod; where none of them is offered, where its pull request stands.
   */
  const props = defineProps<{
    task: Task;
    /** The task's column, in the order the board shows it; without it — a board sorted other than by Jig's queue — no move. */
    cards?: Task[];
    /** `cards` are only those a filter shows. */
    filtered?: boolean;
    disabled?: boolean;
  }>();

  const emit = defineEmits<{
    move: [place: Place];
    prioritise: [priority: number | null];
    /** Asks a pause (`true`) — made at once for a task nobody started — or takes the request back (`false`). */
    pause: [ask: boolean];
    resume: [];
    land: [];
    review: [];
    promote: [];
    merge: [];
    status: [];
  }>();

  const cards = computed(() => props.cards ?? []);
  const up = computed(() => step(cards.value, props.task.id, -1));
  const down = computed(() => step(cards.value, props.task.id, 1));
  const offered = computed(() => ends(cards.value, props.task, props.filtered));

  const PRIORITIES = [0, 1, 2, 3, 4, 5] as const;
  const priority = computed(() => (props.task.priority === null ? 'none' : String(props.task.priority)));
  function choose(value: unknown): void {
    if (value === priority.value || typeof value !== 'string') return;
    emit('prioritise', value === 'none' ? null : Number(value));
  }
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button variant="ghost" size="icon-xs" :disabled="disabled" :aria-label="`Queue and priority of ${task.id}`">
        <Ellipsis />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="w-44">
      <template v-if="task.mergeable || task.landable || task.reviewRequestable || task.promotable || task.statusable">
        <DropdownMenuItem v-if="task.mergeable" @select="emit('merge')"><GitMerge />Merge…</DropdownMenuItem>
        <DropdownMenuItem v-if="task.landable" @select="emit('land')"><GitMerge />Land on staging</DropdownMenuItem>
        <DropdownMenuItem v-if="task.reviewRequestable" @select="emit('review')"><UserPlus />Request review…</DropdownMenuItem>
        <DropdownMenuItem v-if="task.promotable" @select="emit('promote')"><Rocket />Prepare for prod…</DropdownMenuItem>
        <DropdownMenuItem v-if="task.statusable" @select="emit('status')"><ListChecks />Status…</DropdownMenuItem>
        <DropdownMenuSeparator />
      </template>
      <template v-if="props.cards">
        <DropdownMenuItem :disabled="!offered.top" @select="emit('move', 'top')"><ArrowUpToLine />To top</DropdownMenuItem>
        <DropdownMenuItem :disabled="!up" @select="up && emit('move', up)"><ArrowUp />Up</DropdownMenuItem>
        <DropdownMenuItem :disabled="!down" @select="down && emit('move', down)"><ArrowDown />Down</DropdownMenuItem>
        <DropdownMenuItem :disabled="!offered.bottom" @select="emit('move', 'bottom')"><ArrowDownToLine />To bottom</DropdownMenuItem>
        <DropdownMenuSeparator />
      </template>
      <DropdownMenuLabel>Priority</DropdownMenuLabel>
      <DropdownMenuRadioGroup :model-value="priority" @update:model-value="choose">
        <DropdownMenuRadioItem v-for="p in PRIORITIES" :key="p" :value="String(p)">P{{ p }}</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="none">None</DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem v-if="task.parked && !task.paused" :disabled="!task.resumable" @select="emit('resume')">
        <Wrench />Take back for a fix
      </DropdownMenuItem>
      <!-- Beside a request nobody will take, as a drop on Paused does: Jig's pause takes the request out. -->
      <DropdownMenuItem v-if="task.pausable" @select="emit('pause', true)"><Pause />Pause</DropdownMenuItem>
      <DropdownMenuItem v-if="task.pauseRequest" @select="emit('pause', false)"><Undo2 />Cancel pause request</DropdownMenuItem>
      <DropdownMenuItem v-else-if="task.paused" :disabled="!task.resumable" @select="emit('resume')"><Play />Resume</DropdownMenuItem>
      <DropdownMenuItem v-else-if="!task.pausable" :disabled="!task.pauseRequestable" @select="emit('pause', true)">
        <Pause />Request pause
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
