<script setup lang="ts">
  import { ref } from 'vue';
  import { Loader2 } from '@lucide/vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { toneRule } from '@/lib/tones';

  /** Giving a live task up with a reason, or archiving it, as Jig offers either: an abandon asks for its reason first. A refusal is a toast the view raises. */
  defineProps<{
    task: string;
    /** The writes Jig offers that the page runs: `abandon`, `archive`. */
    offers: Set<string>;
    busy: boolean;
  }>();

  const emit = defineEmits<{
    abandon: [reason: string];
    archive: [];
  }>();

  const asking = ref(false);
  const reason = ref('');

  function abandon(): void {
    if (reason.value.trim() !== '') emit('abandon', reason.value.trim());
  }
</script>

<template>
  <div class="flex flex-col gap-2">
    <form
      v-if="asking"
      :aria-label="`Abandon ${task}`"
      :class="toneRule.attention"
      class="flex flex-col gap-2 text-[13px]"
      @submit.prevent="abandon"
    >
      <Label :for="`abandon-${task}`">Why is {{ task }} given up? The next agent reads it.</Label>
      <Input :id="`abandon-${task}`" v-model="reason" required maxlength="500" placeholder="It lives in another repository now" />
      <div class="flex gap-2">
        <Button type="submit" size="xs" :disabled="busy || reason.trim() === ''"
          ><Loader2 v-if="busy" class="animate-spin" />{{ busy ? 'Abandoning…' : 'Abandon task' }}</Button
        >
        <Button type="button" variant="ghost" size="xs" :disabled="busy" @click="asking = false">Cancel</Button>
      </div>
    </form>
    <div v-else class="flex flex-wrap gap-2">
      <Button v-if="offers.has('abandon')" variant="outline" size="sm" :disabled="busy" @click="asking = true">Abandon…</Button>
      <Button v-if="offers.has('archive')" variant="outline" size="sm" :disabled="busy" @click="emit('archive')">
        <Loader2 v-if="busy" class="animate-spin" />{{ busy ? 'Archiving…' : 'Archive' }}
      </Button>
    </div>
  </div>
</template>
