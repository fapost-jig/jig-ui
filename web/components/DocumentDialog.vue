<script setup lang="ts">
  import { computed, useSlots } from 'vue';
  import { Button } from '@/components/ui/button';
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
  import { type DocumentRead, shownDocument } from '@/lib/documents';
  import { LOSSY } from '@/lib/knowledge';
  import { prose, rendered } from '@/lib/markdown';
  import { toneText } from '@/lib/tones';

  /**
   * A document of Jig opened in a dialog, as written: being read, gone, unreadable, or its Markdown. `title` is its name,
   * `id` the spec, task or knowledge document it belongs to. Ready content that is not one Markdown document (a text in
   * parts, a diff) goes in the default slot, which stands in for the Markdown and the bytes-dropped line, its own to say.
   */
  const props = defineProps<{
    title: string;
    id?: string;
    read: DocumentRead;
    /** What to say beside its words: how this document differs from what its owner shows elsewhere. */
    note?: string | null;
    /** What to say once Jig no longer has the document. */
    gone?: string;
    /** What to say once Jig could not read the document. */
    failed?: string;
  }>();

  const slots = useSlots();
  const open = defineModel<boolean>('open', { required: true });

  const emit = defineEmits<{
    readAgain: [];
  }>();

  const shown = computed(() => shownDocument(props.read));
  /** The document read, as HTML cleaned of anything that could run. */
  const html = computed(() => (shown.value.state === 'ready' && !slots.default ? rendered(shown.value.content) : undefined));
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="flex max-h-[calc(100dvh-2rem)] flex-col gap-3 sm:max-w-3xl">
      <DialogHeader class="pr-8">
        <DialogTitle class="flex flex-wrap items-baseline gap-x-2">
          {{ title }}<code v-if="id" class="text-xs font-normal text-muted-foreground">{{ id }}</code>
        </DialogTitle>
        <DialogDescription class="sr-only">The document as Jig has it.</DialogDescription>
      </DialogHeader>
      <div class="min-h-0 flex-1 overflow-y-auto">
        <p v-if="shown.state === 'reading'" class="text-muted-foreground" role="status">Reading…</p>
        <p v-else-if="shown.state === 'not-found'" class="text-muted-foreground">{{ gone ?? 'Jig no longer has it.' }}</p>
        <p v-else-if="shown.state === 'epic-missing'" :class="toneText.attention">
          The branch of its epic is nowhere, so Jig cannot read it.
        </p>
        <p v-else-if="shown.state === 'failed'" class="flex flex-wrap items-center gap-x-3" :class="toneText.bad">
          {{ failed ?? 'Jig could not read it.' }}
          <Button variant="outline" size="xs" @click="emit('readAgain')">Read again</Button>
        </p>
        <template v-else-if="shown.state === 'ready'">
          <p v-if="note" class="mb-2 text-[13px]" :class="toneText.attention">{{ note }}</p>
          <slot v-if="$slots.default" />
          <template v-else>
            <p v-if="shown.lossy" class="mb-2 text-[13px]" :class="toneText.attention">{{ LOSSY }}</p>
            <!-- eslint-disable-next-line vue/no-v-html -- cleaned by DOMPurify in lib/markdown.ts -->
            <div :class="prose" v-html="html" />
          </template>
        </template>
      </div>
    </DialogContent>
  </Dialog>
</template>
