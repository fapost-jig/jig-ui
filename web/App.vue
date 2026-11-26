<script setup lang="ts">
  import { computed, onMounted, onUnmounted, ref } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import { call, client, failure, type MachineJig as Jig, type Newer, onChange, type Project } from './api';
  import MachineJig from './components/MachineJig.vue';
  import { jigReadKey } from './lib/upgrade';
  import ProjectSwitcher from './components/ProjectSwitcher.vue';
  import ThemeToggle from './components/ThemeToggle.vue';
  import { Toaster } from '@/components/ui/sonner';
  import { lastWins } from './lib/last-wins';
  import { byName } from './lib/projects';
  import { toneRule, toneText } from './lib/tones';

  const route = useRoute();
  const router = useRouter();
  const version = ref<string>();
  /** A newer Jig UI on npm, as the server last heard; asked once a day at most. */
  const newer = ref<Newer>(null);
  /** This machine's Jig and the newest released, read with the first workspace read and again when `jigReadKey` moves. */
  const jig = ref<Jig>(null);
  /** What the header last read Jig for: the last self-update's end, the release Jig said, the connected projects. */
  let jigFor: string | undefined;
  const updating = ref(false);
  const updateOpen = ref(false);
  const updateRefusal = ref<string[]>();
  const projects = ref<Project[]>([]);
  /** The project whose board or task is open; the workspace and the canvas have none. */
  const current = computed(() => (typeof route.params.id === 'string' ? route.params.id : undefined));

  // The header's Jig is read with the first workspace read, once the change stream is open, and again only when a
  // self-update — the header's or a card's — has ended, a project heard of a new release, or a project was connected or
  // disconnected: whether one can run the update.
  const loadProjects = lastWins(
    async () => await (await call(() => client.api.workspace.$get()))?.json(),
    ({ projects: read, machine }) => {
      projects.value = byName(read);
      const key = jigReadKey(read, machine);
      if (key === jigFor) return;
      jigFor = key;
      void loadJig();
    },
  );

  const loadJig = lastWins(
    async () => (await (await call(() => client.api.instance.jig.$get()))?.json())?.jig,
    (read) => {
      jig.value = read ?? null;
    },
  );

  /** `jig self-update`, as the upgrade panel runs it; once it is done every project is read again, and the header too. */
  async function updateJig(): Promise<void> {
    updating.value = true;
    updateRefusal.value = undefined;
    const res = await call(() => client.api['self-update'].$post());
    updating.value = false;
    if (!res) return;
    if (res.status === 200) {
      updateOpen.value = false;
      return void (await loadProjects());
    }
    const { error } = (await res.json()) as {
      error: {
        message: string;
        reasons?: string[];
      };
    };

    updateRefusal.value = error.reasons?.length ? error.reasons : [error.message];
  }

  onMounted(async () => {
    version.value = (await (await call(() => client.api.instance.$get()))?.json())?.version;
    // Asked after the version: the registry may take seconds, the version none.
    newer.value = (await (await call(() => client.api.instance.newer.$get()))?.json())?.newer ?? null;
  });

  onUnmounted(onChange(() => void loadProjects()));
</script>

<template>
  <div class="flex h-screen flex-col">
    <p v-if="failure?.kind === 'registry-unreadable'" role="alert" class="m-4 text-[13px]" :class="toneRule.bad">{{ failure.message }}</p>
    <p v-else-if="failure?.kind === 'session-ended'" role="alert" class="m-4 text-[13px]" :class="toneRule.attention">
      This page's session has ended. Run <code>jig-ui open</code>, or <code>npx @fapost/jig-ui</code>, to reopen it.
    </p>
    <p v-else-if="failure?.kind === 'internal'" role="alert" class="m-4 text-[13px]" :class="toneRule.bad">
      Jig UI hit an error it did not expect; its terminal says what. Reload the page to try again.
    </p>
    <p v-else-if="failure?.kind === 'not-running'" role="alert" class="m-4 text-[13px]" :class="toneRule.attention">
      Jig UI is not running. Start it with <code>npx @fapost/jig-ui</code>, or <code>jig-ui</code>.
    </p>
    <template v-else>
      <ProjectSwitcher
        :projects="projects"
        :current="current"
        :version="version"
        class="shrink-0"
        @pick="(id) => router.push(`/projects/${encodeURIComponent(id)}`)"
      >
        <MachineJig v-model:open="updateOpen" :jig="jig" :busy="updating" :refusal="updateRefusal" @update="updateJig" />
        <ThemeToggle />
      </ProjectSwitcher>
      <p v-if="newer" class="shrink-0 border-b px-4 py-2 text-[13px]" :class="toneText.attention">
        Jig UI {{ newer.version }} is out. To update, run <code>{{ newer.stop }}</code
        >, then start Jig UI again.
      </p>
      <main class="min-h-0 flex-1 overflow-auto">
        <!-- Keyed on the path: a view reads once when it mounts, so a new path mounts it again; the workspace's
             `?project=` only picks the card it shows from what it read. -->
        <RouterView :key="route.path" />
      </main>
    </template>
    <!-- What long actions say while they run and when they end, in the corner: an error stays until closed. -->
    <Toaster position="bottom-right" rich-colors close-button />
  </div>
</template>
