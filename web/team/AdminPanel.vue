<script setup lang="ts">
  import { onMounted, ref } from 'vue';
  import GroupPanel from '@/components/GroupPanel.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { installationShown } from '@/lib/team';
  import { type Installations, refusal, team } from './api';

  /** `installed`: the installation GitHub returned the admin from installing, which the server reads before answering. */
  const props = defineProps<{
    installed?: number;
  }>();

  const installations = ref<Installations>();
  const refused = ref<string>();
  /** The installation being decided. */
  const deciding = ref<number>();

  onMounted(async () => {
    const response = await team.admin.installations.$get({ query: { installation: props.installed } }).catch(() => undefined);
    if (response?.ok) installations.value = await response.json();
    else refused.value = response ? await refusal(response) : 'The team server did not answer.';
  });

  async function decide(id: number, decision: 'approved' | 'refused'): Promise<void> {
    deciding.value = id;
    const response = await team.admin.installations[':id'].$post({ param: { id: String(id) }, json: { decision } }).catch(() => undefined);
    deciding.value = undefined;
    if (response?.ok) {
      installations.value = { ...installations.value!, installations: (await response.json()).installations };
      refused.value = undefined;
    } else {
      refused.value = response ? await refusal(response) : 'The team server did not answer.';
    }
  }
</script>

<template>
  <GroupPanel aria-labelledby="installations">
    <template #head
      ><h2 id="installations" class="px-4 pt-3 pb-2 text-[15px] font-semibold">Installations — you are this server's admin</h2></template
    >
    <div class="flex flex-col gap-2 px-4 pb-4">
      <p class="text-[13px] text-muted-foreground">
        Anyone may install the App. People sign in through an installation only once you approve it, and the server keeps nothing of one you
        have not approved.
      </p>
      <ul v-if="installations?.installations.length" class="flex flex-col gap-2">
        <li
          v-for="installation in installations.installations"
          :key="installation.id"
          class="flex flex-wrap items-center gap-2 rounded-lg bg-card px-3 py-2 ring-1 ring-border"
        >
          <span class="flex-1">{{ installation.accountLogin }}</span>
          <span class="text-[13px] text-muted-foreground">{{ installationShown(installation).kind }}</span>
          <Badge :variant="installationShown(installation).waits ? 'default' : 'outline'">{{
            installationShown(installation).state
          }}</Badge>
          <Button
            v-if="installation.state !== 'approved'"
            size="xs"
            :disabled="deciding === installation.id"
            @click="decide(installation.id, 'approved')"
            >Approve</Button
          >
          <Button
            v-if="installation.state !== 'refused'"
            size="xs"
            variant="outline"
            :disabled="deciding === installation.id"
            @click="decide(installation.id, 'refused')"
            >Refuse</Button
          >
        </li>
      </ul>
      <p v-else-if="installations" class="text-[13px] text-muted-foreground">The App is not installed anywhere yet.</p>
      <p v-if="refused" role="alert" class="text-[13px] text-destructive">{{ refused }}</p>
      <Button v-if="installations?.install" as="a" :href="installations.install" variant="outline" size="sm" class="self-start"
        >Install the App on an account</Button
      >
    </div>
  </GroupPanel>
</template>
