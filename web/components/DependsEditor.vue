<script setup lang="ts">
  import { X } from '@lucide/vue';
  import { ref } from 'vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
  import { refName } from '@/lib/writes';
  import { toneRule } from '@/lib/tones';

  /**
   * What a live task waits for in Jig's queue, changed from its page: its own dependencies each with a remove, one its
   * epic gives it shown but left to the epic, and Add… — another live task or an open epic, and the reason Jig asks for.
   */
  defineProps<{
    task: string;
    dependsOn: {
      on: string;
      reason: string;
      through: string | null;
    }[];
    /** What it may wait for, as queue references; `undefined` until read for Add…. */
    candidates?: string[];
    busy: boolean;
    refusal?: string;
  }>();

  const emit = defineEmits<{
    add: [on: string, reason: string];
    remove: [on: string];
    choose: [];
  }>();

  const adding = ref(false);
  const on = ref<string>();
  const reason = ref('');

  function start(): void {
    adding.value = true;
    emit('choose');
  }

  function add(): void {
    if (on.value && reason.value.trim() !== '') emit('add', on.value, reason.value.trim());
  }

  /** Closes Add… once its dependency is written. */
  function done(): void {
    adding.value = false;
    on.value = undefined;
    reason.value = '';
  }

  defineExpose({ done });
</script>

<template>
  <div class="flex flex-col gap-2 text-[13px]">
    <p v-if="dependsOn.length === 0" class="text-muted-foreground">{{ task }} waits for nothing in the queue.</p>
    <ul v-else class="flex flex-col gap-1">
      <li v-for="d in dependsOn" :key="`${d.through}>${d.on}`" class="flex items-center gap-2">
        <span class="font-mono text-xs">{{ refName(d.on) }}</span>
        <span class="min-w-0 flex-1 text-muted-foreground">{{ d.reason }}{{ d.through ? ` — through epic ${d.through}` : '' }}</span>
        <Button
          v-if="d.through === null"
          variant="ghost"
          size="icon-xs"
          :disabled="busy"
          :aria-label="`${task} no longer waits for ${refName(d.on)}`"
          @click="emit('remove', d.on)"
        >
          <X />
        </Button>
      </li>
    </ul>
    <form v-if="adding" :aria-label="`What ${task} waits for`" class="flex flex-col gap-2" @submit.prevent="add">
      <div class="flex flex-wrap items-end gap-2">
        <div class="flex flex-col gap-1">
          <Label :for="`depend-on-${task}`">Waits for</Label>
          <Select v-model="on" :disabled="candidates === undefined">
            <SelectTrigger :id="`depend-on-${task}`" size="sm" class="min-w-44">
              <SelectValue :placeholder="candidates === undefined ? 'Reading the queue…' : 'A task or an epic'" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="c in candidates" :key="c" :value="c">{{ refName(c) }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div class="flex min-w-48 flex-1 flex-col gap-1">
          <Label :for="`depend-reason-${task}`">Why</Label>
          <Input :id="`depend-reason-${task}`" v-model="reason" required maxlength="500" placeholder="Needs its API first" />
        </div>
      </div>
      <div class="flex gap-2">
        <Button type="submit" size="xs" :disabled="busy || !on || reason.trim() === ''">{{ busy ? 'Adding…' : 'Add' }}</Button>
        <Button type="button" variant="ghost" size="xs" :disabled="busy" @click="adding = false">Cancel</Button>
      </div>
    </form>
    <Button v-else variant="outline" size="xs" class="self-start" :disabled="busy" @click="start">Add…</Button>
    <p v-if="refusal" role="alert" :class="toneRule.attention">{{ refusal }}</p>
  </div>
</template>
