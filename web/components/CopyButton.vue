<script setup lang="ts">
  import { Check, Copy } from '@lucide/vue';
  import { ref } from 'vue';
  import { Button } from '@/components/ui/button';

  /** `label` is the button's word (`copy` by default); `icon` shows the icon alone. The button is named by what it copies. */
  const props = defineProps<{
    text: string;
    label?: string;
    icon?: boolean;
  }>();

  const copied = ref(false);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(props.text);
      copied.value = true;
      setTimeout(() => (copied.value = false), 1500);
    } catch {
      // No clipboard (a browser that refuses it): the text stays on screen to select by hand.
    }
  }
</script>

<template>
  <Button
    variant="ghost"
    :size="icon ? 'icon-xs' : 'xs'"
    :aria-label="copied ? 'Copied' : `Copy ${text}`"
    :title="icon ? (copied ? 'Copied' : 'Copy the id') : undefined"
    @click.stop="copy"
  >
    <Check v-if="copied" />
    <Copy v-else />
    <template v-if="!icon">{{ copied ? 'copied' : (label ?? 'copy') }}</template>
  </Button>
</template>
