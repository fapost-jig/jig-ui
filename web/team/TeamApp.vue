<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue';
  import GroupPanel from '@/components/GroupPanel.vue';
  import ThemeToggle from '@/components/ThemeToggle.vue';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { projectGroups } from '@/lib/team';
  import { toneRule } from '@/lib/tones';
  import AdminPanel from './AdminPanel.vue';
  import { type Me, problems, type Projects, refusal, team } from './api';

  /** What the page shows: the server being read, its setup, the sign-in, or the person's projects. */
  const view = ref<'reading' | 'setup' | 'sign-in' | 'projects' | 'down'>('reading');
  const me = ref<Me>();
  const projects = ref<Projects>();
  /** Why the last sign-in came back without a session, read once from `?problem=`. */
  const problem = ref<string>();
  /** The installation GitHub returned the admin from installing, read once from `?installation_id=`. */
  const installed = ref<number>();

  // The setup: the code from the log first, then the account the App is created on.
  const code = ref('');
  const codeTaken = ref(false);
  /** The App exists but its admin's sign-in did not finish: the code leads to that sign-in again. */
  const hasApp = ref(false);
  const organization = ref('');
  const busy = ref(false);
  const setupRefusal = ref<string>();

  async function read(): Promise<void> {
    const state = await team.state
      .$get()
      .then((response) => (response.ok ? response.json() : undefined))
      .catch(() => undefined);

    if (!state) return void (view.value = 'down');
    hasApp.value = state.hasApp;
    if (!state.setUp) return void (view.value = 'setup');
    if (!state.signedIn) return void (view.value = 'sign-in');
    const [mine, listed] = await Promise.all([team.me.$get(), team.projects.$get()]);
    if (!mine.ok || !listed.ok) return void (view.value = 'sign-in');
    me.value = await mine.json();
    projects.value = await listed.json();
    view.value = 'projects';
  }

  onMounted(() => {
    const url = new URL(location.href);
    const said = url.searchParams.get('problem');
    if (said) problem.value = problems[said] ?? 'The sign-in did not complete. Sign in again.';
    // GitHub returns the admin here from installing the App (its setup URL), naming the installation.
    const id = Number(url.searchParams.get('installation_id'));
    if (Number.isSafeInteger(id) && id > 0) installed.value = id;
    for (const name of ['problem', 'installation_id', 'setup_action']) url.searchParams.delete(name);
    history.replaceState(null, '', url);
    void read();
  });

  async function enterCode(): Promise<void> {
    busy.value = true;
    const response = await team.setup.$post({ json: { code: code.value } }).catch(() => undefined);
    busy.value = false;
    if (response?.ok) {
      codeTaken.value = true;
      setupRefusal.value = undefined;
    } else {
      setupRefusal.value = response ? await refusal(response) : 'The team server did not answer.';
    }
  }

  /** Sends the manifest to GitHub as a form, the only way GitHub takes one; GitHub sends the browser back to /setup/done. */
  async function createApp(): Promise<void> {
    busy.value = true;
    const response = await team.setup.manifest.$post({ json: { organization: organization.value.trim() || null } }).catch(() => undefined);
    if (!response?.ok) {
      busy.value = false;
      setupRefusal.value = response ? await refusal(response) : 'The team server did not answer.';
      return;
    }
    const { action, manifest } = await response.json();
    const form = document.createElement('form');
    form.method = 'post';
    form.action = action;
    const field = document.createElement('input');
    field.type = 'hidden';
    field.name = 'manifest';
    field.value = manifest;
    form.append(field);
    document.body.append(form);
    form.submit();
  }

  async function signOut(): Promise<void> {
    await team['sign-out'].$post().catch(() => undefined);
    await read();
  }

  const groups = computed(() => projectGroups(projects.value?.projects ?? []));
</script>

<template>
  <div class="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 px-4 py-6 text-sm">
    <header class="flex items-center justify-between gap-2">
      <h1 class="text-lg font-semibold">Jig UI for teams</h1>
      <div class="flex items-center gap-2">
        <template v-if="view === 'projects' && me">
          <span class="text-[13px] text-muted-foreground">{{ me.accounts.map((account) => account.login).join(', ') }}</span>
          <Button variant="ghost" size="sm" @click="signOut">Sign out</Button>
        </template>
        <ThemeToggle />
      </div>
    </header>

    <p v-if="problem" role="alert" :class="toneRule.attention">{{ problem }}</p>

    <p v-if="view === 'reading'" class="text-muted-foreground">Reading the team server…</p>

    <p v-else-if="view === 'down'" role="alert" :class="toneRule.bad">The team server did not answer. Reload the page to try again.</p>

    <section v-else-if="view === 'setup'" class="flex flex-col gap-4">
      <p>
        This server is not set up yet. Setting it up creates its GitHub App, which asks for nothing but Metadata (read), and makes you its
        admin.
      </p>
      <form v-if="!codeTaken" class="flex flex-col gap-2" @submit.prevent="enterCode">
        <Label for="setup-code">Setup code, from the server's log</Label>
        <div class="flex flex-wrap gap-2">
          <Input
            id="setup-code"
            v-model="code"
            class="flex-[1_1_14rem] font-mono"
            required
            autocomplete="off"
            :aria-invalid="setupRefusal !== undefined"
            aria-describedby="setup-refusal"
          />
          <Button type="submit" :disabled="busy">{{ busy ? 'Checking…' : 'Continue' }}</Button>
        </div>
      </form>
      <div v-else-if="hasApp" class="flex flex-col items-start gap-2">
        <p class="text-[13px] text-muted-foreground">The App exists. Sign in with GitHub to become this server's admin.</p>
        <Button as="a" href="/auth/sign-in?as=admin">Sign in as the admin</Button>
      </div>
      <form v-else class="flex flex-col gap-2" @submit.prevent="createApp">
        <Label for="setup-organization">Organization that owns the App — leave empty for your personal account</Label>
        <div class="flex flex-wrap gap-2">
          <Input
            id="setup-organization"
            v-model="organization"
            class="flex-[1_1_14rem]"
            autocomplete="off"
            placeholder="organization login"
            aria-describedby="setup-refusal"
          />
          <Button type="submit" :disabled="busy">{{ busy ? 'Opening GitHub…' : 'Create the App on GitHub' }}</Button>
        </div>
      </form>
      <p v-if="setupRefusal" id="setup-refusal" role="alert" class="text-[13px] text-destructive">{{ setupRefusal }}</p>
    </section>

    <section v-else-if="view === 'sign-in'" class="flex flex-col items-start gap-3">
      <p>Sign in with GitHub to see the projects you may write to.</p>
      <Button as="a" href="/auth/sign-in">Sign in with GitHub</Button>
    </section>

    <template v-else-if="view === 'projects' && me && projects">
      <GroupPanel aria-labelledby="projects">
        <template #head><h2 id="projects" class="px-4 pt-3 pb-2 text-[15px] font-semibold">Your projects</h2></template>
        <ul v-if="groups.length" class="flex flex-col gap-2 px-4">
          <li v-for="group in groups" :key="group.id" class="flex flex-col gap-1 rounded-lg bg-card px-3 py-2 ring-1 ring-border">
            <span :class="group.writable ? '' : 'text-muted-foreground'">{{ group.fullName }}</span>
            <span v-for="fork in group.forks" :key="fork.id" class="pl-4 text-[13px] text-muted-foreground">fork: {{ fork.fullName }}</span>
          </li>
        </ul>
        <p v-else class="px-4 text-[13px] text-muted-foreground">None of your accounts may write to a repository this server takes yet.</p>
        <p class="px-4 pt-2 pb-4 text-[13px] text-muted-foreground">
          No tasks here yet: Jig UI on each machine will start sending them in a later release.
        </p>
      </GroupPanel>

      <GroupPanel aria-labelledby="accounts">
        <template #head><h2 id="accounts" class="px-4 pt-3 pb-2 text-[15px] font-semibold">Another GitHub account</h2></template>
        <div class="flex flex-col items-start gap-2 px-4 pb-4">
          <p class="text-[13px] text-muted-foreground">
            GitHub signs in the account this browser is signed in to there. Switch to the other account on github.com first, then link it:
            you see the projects of all your accounts together.
          </p>
          <Button as="a" href="/auth/sign-in?as=link" variant="outline" size="sm">Link another account</Button>
        </div>
      </GroupPanel>

      <AdminPanel v-if="me.admin" :installed="installed" />
    </template>
  </div>
</template>
