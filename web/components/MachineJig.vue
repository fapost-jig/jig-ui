<script setup lang="ts">
  import { Loader2 } from '@lucide/vue';
  import { computed } from 'vue';
  import type { MachineJig } from '@/api';
  import { Button } from '@/components/ui/button';
  import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
  import { jigNewer } from '@/lib/upgrade';
  import { toneText } from '@/lib/tones';

  /**
   * The header's Jig: the one installed on this machine beside the newest released, marked where it is newer, with
   * **Update…** where a connected project can run the update — it asks before `jig self-update` runs, the update the
   * upgrade panel runs. The installed one alone while the newest is unknown; nothing while the machine's Jig cannot be
   * told.
   */
  const props = defineProps<{
    jig: MachineJig;
    /** The update is on its way: its toast says so, and the question closes. Why it failed is a toast the page raises. */
    busy: boolean;
  }>();

  const open = defineModel<boolean>('open', { required: true });

  const emit = defineEmits<{
    update: [];
  }>();

  const newer = computed(() => jigNewer(props.jig));
</script>

<template>
  <span v-if="jig" class="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
    <span title="The Jig installed on this machine">jig {{ jig.installed }}</span>
    <template v-if="newer">
      <span :class="toneText.attention" :title="`Jig ${newer} is released`">{{ newer }} out</span>
      <Button v-if="jig.updatable" variant="ghost" size="xs" class="font-sans" :disabled="busy" @click="open = true"
        ><Loader2 v-if="busy" class="animate-spin" />{{ busy ? 'Updating…' : 'Update…' }}</Button
      >
    </template>
    <span v-else-if="jig.latest" title="The newest Jig released">· newest {{ jig.latest }}</span>
  </span>
  <Dialog v-if="jig?.updatable && newer" v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Update Jig on this machine</DialogTitle>
        <DialogDescription>
          Jig {{ newer }} is out; this machine has {{ jig.installed }}. <code>jig self-update</code> moves the Jig every project on this
          machine upgrades from. No project changes until its own upgrade, which its card then offers.
        </DialogDescription>
      </DialogHeader>
      <div class="flex justify-end gap-2">
        <Button variant="outline" @click="open = false">Cancel</Button>
        <Button @click="emit('update')">Update Jig on this machine</Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
