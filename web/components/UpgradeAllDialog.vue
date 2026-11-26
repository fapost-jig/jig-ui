<script setup lang="ts">
  import { inject } from 'vue';
  import { Button } from '@/components/ui/button';
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
  import { INLINE_DIALOGS } from '@/lib/inline';
  import { toneRule } from '@/lib/tones';

  /**
   * The question before Upgrade all, in a dialog: what it would do and for which projects. Closing it is Cancel. The
   * canvas, which provides `INLINE_DIALOGS`, draws it in place.
   */
  defineProps<{
    /** A newer Jig is out: this machine's Jig is updated first. */
    selfUpdate: boolean;
    projects: string[];
  }>();

  const emit = defineEmits<{
    upgrade: [];
    close: [];
  }>();

  const inline = inject(INLINE_DIALOGS, false);
</script>

<template>
  <component
    :is="inline ? 'div' : Dialog"
    v-bind="inline ? {} : { open: true, 'onUpdate:open': (open: boolean) => !open && emit('close') }"
  >
    <component :is="inline ? 'div' : DialogContent" class="flex flex-col gap-3 text-[13px] sm:max-w-lg">
      <DialogHeader v-if="!inline">
        <DialogTitle>Upgrade all</DialogTitle>
        <DialogDescription class="sr-only">What Upgrade all would do, before it starts.</DialogDescription>
      </DialogHeader>
      <section aria-label="Upgrade all" :class="toneRule.attention" class="flex flex-col gap-2">
        <p v-if="selfUpdate">
          A newer Jig is out. Jig on this machine is updated first (<code>jig self-update</code>, for every project on this machine), then
          the projects are upgraded one at a time:
        </p>
        <p v-else>The projects are upgraded one at a time:</p>
        <ul class="list-disc pl-5 text-foreground">
          <li v-for="id in projects" :key="id">{{ id }}</li>
        </ul>
        <p>
          In each Jig works in the project's main checkout: it cuts a branch, commits, pushes, and opens a pull request or merges as far as
          the project's agent.git allows. A project Jig cannot read now is left alone.
        </p>
        <div class="flex gap-2">
          <Button size="xs" @click="emit('upgrade')">{{ selfUpdate ? 'Update Jig and upgrade all' : 'Upgrade all' }}</Button>
          <Button variant="ghost" size="xs" @click="emit('close')">Cancel</Button>
        </div>
      </section>
    </component>
  </component>
</template>
