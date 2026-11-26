<script setup lang="ts">
  import ReadingLine from './ReadingLine.vue';
  import { ChevronRight } from '@lucide/vue';
  import { computed } from 'vue';
  import type { ArtifactKind, TaskArtifact, TaskArtifacts } from '@/api';
  import { Button } from '@/components/ui/button';
  import { documentLine, noDocuments } from '@/lib/artifacts';
  import type { OpenDocument } from '@/lib/documents';
  import { toneText } from '@/lib/tones';
  import DocumentDialog from './DocumentDialog.vue';
  import GroupPanel from './GroupPanel.vue';

  /**
   * A task's documents: the list Jig gave (`undefined` while it is read), and the one open in a dialog — being read, read,
   * or gone. A document is open one at a time.
   */
  const props = defineProps<{
    task: string;
    documents?: TaskArtifacts;
    open?: OpenDocument<ArtifactKind, TaskArtifact>;
    reading?: boolean;
  }>();

  const emit = defineEmits<{
    /** A document is chosen, or asked again (Read again). */
    open: [kind: ArtifactKind];
    close: [];
    readAgain: [];
  }>();

  const none = computed(() => props.documents && noDocuments(props.documents));
  const listed = computed(() =>
    props.documents?.state === 'ready' ? props.documents.artifacts.map((artifact) => ({ artifact, line: documentLine(artifact) })) : [],
  );
</script>

<template>
  <GroupPanel aria-labelledby="documents">
    <template #head><h2 id="documents" class="px-4 pt-3 pb-2 text-[15px] font-semibold">Documents</h2></template>
    <ReadingLine v-if="documents === undefined" class="px-4 pb-4">Reading the documents…</ReadingLine>
    <p v-else-if="none" class="inline-flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pb-4 text-muted-foreground">
      {{ none }}
      <Button v-if="documents.state === 'unreadable'" variant="outline" size="xs" :disabled="reading" @click="$emit('readAgain')">
        {{ reading ? 'Reading…' : 'Read again' }}
      </Button>
    </p>
    <ul v-else class="mx-2 mb-2 rounded-lg border bg-card">
      <li v-for="{ artifact, line } in listed" :key="artifact.kind" class="border-b last:border-b-0">
        <h3>
          <Button
            variant="ghost"
            class="h-auto w-full justify-start gap-2 rounded-none px-4 py-2.5 text-left text-sm"
            :disabled="artifact.state !== 'present'"
            @click="emit('open', artifact.kind)"
          >
            <ChevronRight class="size-3 shrink-0" :class="{ invisible: artifact.state !== 'present' }" />
            <span class="font-medium">{{ artifact.kind }}</span>
            <span class="ml-auto text-right text-[13px] font-normal" :class="toneText[line.tone]">{{ line.text }}</span>
          </Button>
        </h3>
      </li>
    </ul>
    <DocumentDialog
      v-if="open"
      :id="task"
      :open="true"
      :title="open.kind"
      :read="open.read"
      @update:open="emit('close')"
      @read-again="emit('open', open.kind)"
    />
  </GroupPanel>
</template>
