<script setup lang="ts">
  import { Loader2 } from '@lucide/vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';

  /** `finding` while Find projects looks; why a connect or a Find was refused is a toast the view raises. */
  defineProps<{
    busy: boolean;
    finding?: boolean;
  }>();

  defineEmits<{
    connect: [path: string];
    find: [folder: string];
  }>();

  const path = defineModel<string>({ default: '' });
</script>

<template>
  <form class="flex flex-col gap-2" @submit.prevent="$emit('connect', path)">
    <Label for="project-path">Project path</Label>
    <!-- On a narrow screen the buttons go under the field, which keeps room for a path. -->
    <div class="flex flex-wrap gap-2">
      <Input id="project-path" v-model="path" class="flex-[1_1_14rem]" required placeholder="/path/to/project" />
      <Button type="submit" :disabled="busy"><Loader2 v-if="busy" class="animate-spin" />{{ busy ? 'Connecting…' : 'Connect' }}</Button>
      <!-- The field's folder, or the home folder when it is empty. -->
      <Button type="button" variant="outline" :disabled="finding" @click="$emit('find', path)">
        <Loader2 v-if="finding" class="animate-spin" />{{ finding ? 'Finding…' : 'Find projects' }}
      </Button>
    </div>
  </form>
</template>
