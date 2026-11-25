<script setup lang="ts">
  import { computed, ref } from 'vue';
  import type { Spec } from '@/api';
  import { Badge } from '@/components/ui/badge';
  import { Input } from '@/components/ui/input';
  import { complete, kind, listed, matchingSpecs, shownRoadmap } from '@/lib/specs';
  import { toneText } from '@/lib/tones';
  import GroupPanel from './GroupPanel.vue';
  import ProgressBar from './ProgressBar.vue';

  /**
   * The project's specs on a panel of their own, each a button that shows the spec beside the list; `chosen` is the one
   * shown, a white card on the panel's tint. A spec's title stands whole, wrapping; a complete spec goes last and says it
   * can be closed.
   */
  const props = defineProps<{
    specs: Spec[];
    chosen?: string;
  }>();

  const emit = defineEmits<{
    choose: [id: string];
  }>();

  const query = ref('');
  const shown = computed(() => matchingSpecs(listed(props.specs), query.value));
</script>

<template>
  <GroupPanel class="md:max-h-[calc(100vh-8rem)]">
    <nav aria-label="Specs" class="flex min-h-0 flex-col gap-2 p-2">
      <Input v-model="query" type="search" placeholder="Find a spec…" aria-label="Find a spec" />
      <p v-if="shown.length === 0" class="px-2 text-muted-foreground">No spec is called that.</p>
      <ul v-else class="flex min-h-0 flex-col overflow-y-auto">
        <li v-for="spec in shown" :key="spec.id" class="border-b border-border last:border-b-0">
          <button
            type="button"
            class="flex w-full flex-col gap-1.5 rounded-md px-2 py-2 text-left"
            :class="spec.id === chosen ? 'bg-card shadow-xs ring-1 ring-border' : 'hover:bg-card/60'"
            :aria-current="spec.id === chosen ? 'true' : undefined"
            @click="emit('choose', spec.id)"
          >
            <span class="text-xs leading-snug break-words" :class="spec.id === chosen && 'font-semibold'">{{ spec.title ?? spec.id }}</span>
            <span v-if="kind(spec) || shownRoadmap(spec).progress" class="flex items-center gap-1.5">
              <Badge v-if="kind(spec)" variant="secondary" class="shrink-0">{{ kind(spec) }}</Badge>
              <Badge v-if="complete(spec)" variant="outline" class="shrink-0" :class="toneText.attention">close it</Badge>
              <template v-if="shownRoadmap(spec).progress">
                <ProgressBar
                  compact
                  :hide-count="complete(spec)"
                  :done="shownRoadmap(spec).progress!.done"
                  :total="shownRoadmap(spec).progress!.total"
                />
                <span v-if="complete(spec)" class="text-xs" :class="toneText.good" aria-label="complete">✓</span>
              </template>
            </span>
          </button>
        </li>
      </ul>
    </nav>
  </GroupPanel>
</template>
