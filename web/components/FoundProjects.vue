<script setup lang="ts">
  import type { FoundProjects } from '@/api';
  import { Loader2 } from '@lucide/vue';
  import { Button } from '@/components/ui/button';
  import { foundLine, skippedLine } from '@/lib/scan';
  import { toneText } from '@/lib/tones';

  /** What Find projects found; `connecting` is the path being connected; why one was refused is a toast the view raises. */
  defineProps<{
    result: FoundProjects;
    connecting?: string;
  }>();

  defineEmits<{
    connect: [path: string];
  }>();
</script>

<template>
  <section aria-label="Projects found" class="flex flex-col gap-2">
    <p role="status" class="text-[13px]">{{ foundLine(result) }}</p>
    <ul v-if="result.found.length" class="flex flex-col gap-1">
      <li v-for="{ path } in result.found" :key="path" class="flex flex-col gap-1">
        <div class="flex items-center gap-3">
          <code class="min-w-0 flex-1 truncate text-xs" :title="path">{{ path }}</code>
          <Button variant="outline" size="xs" :disabled="connecting !== undefined" @click="$emit('connect', path)">
            <Loader2 v-if="connecting === path" class="animate-spin" />{{ connecting === path ? 'Connecting…' : 'Connect' }}
          </Button>
        </div>
      </li>
    </ul>
    <p v-if="skippedLine(result)" class="text-[13px]" :class="toneText.quiet">{{ skippedLine(result) }}</p>
    <p v-if="result.stopped" class="text-[13px]" :class="toneText.quiet">
      Stopped before the end: there were too many folders. Type a smaller folder and choose Find projects.
    </p>
  </section>
</template>
