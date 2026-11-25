<script setup lang="ts">
  // The maintainer's page of every component in every variant and state, light and dark side by
  // side. A component added to components/ or components/ui/ gets a section here.
  import { Copy } from '@lucide/vue';
  import { ref } from 'vue';
  import ActionList from '@/components/ActionList.vue';
  import AttentionItem from '@/components/AttentionItem.vue';
  import BoardColumns from '@/components/BoardColumns.vue';
  import BoardFilter from '@/components/BoardFilter.vue';
  import BoardList from '@/components/BoardList.vue';
  import ChoreReports from '@/components/ChoreReports.vue';
  import ColumnHeader from '@/components/ColumnHeader.vue';
  import WriteConfirm from '@/components/WriteConfirm.vue';
  import ConnectForm from '@/components/ConnectForm.vue';
  import FoundProjects from '@/components/FoundProjects.vue';
  import DependsEditor from '@/components/DependsEditor.vue';
  import FinishedList from '@/components/FinishedList.vue';
  import GateApproval from '@/components/GateApproval.vue';
  import KnowledgeView from '@/components/KnowledgeView.vue';
  import NewTaskForm from '@/components/NewTaskForm.vue';
  import CopyButton from '@/components/CopyButton.vue';
  import StagingWork from '@/components/StagingWork.vue';
  import StateLine from '@/components/StateLine.vue';
  import CopyCommand from '@/components/CopyCommand.vue';
  import GroupPanel from '@/components/GroupPanel.vue';
  import ProjectCard from '@/components/ProjectCard.vue';
  import ProgressBar from '@/components/ProgressBar.vue';
  import ProjectList from '@/components/ProjectList.vue';
  import ProjectMark from '@/components/ProjectMark.vue';
  import PrStatus from '@/components/PrStatus.vue';
  import MachineJig from '@/components/MachineJig.vue';
  import ProjectSwitcher from '@/components/ProjectSwitcher.vue';
  import ReviewRequest from '@/components/ReviewRequest.vue';
  import SettingsDialog from '@/components/SettingsDialog.vue';
  import EpicMenu from '@/components/EpicMenu.vue';
  import QueueMenu from '@/components/QueueMenu.vue';
  import FileItemDialog from '@/components/FileItemDialog.vue';
  import SpecBoard from '@/components/SpecBoard.vue';
  import SpecMark from '@/components/SpecMark.vue';
  import SpecItemCard from '@/components/SpecItemCard.vue';
  import SpecItemMenu from '@/components/SpecItemMenu.vue';
  import SpecList from '@/components/SpecList.vue';
  import TaskBrief from '@/components/TaskBrief.vue';
  import TaskCard from '@/components/TaskCard.vue';
  import TaskDocuments from '@/components/TaskDocuments.vue';
  import TaskFacts from '@/components/TaskFacts.vue';
  import TaskRow from '@/components/TaskRow.vue';
  import TaskWrites from '@/components/TaskWrites.vue';
  import ThemeToggle from '@/components/ThemeToggle.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
  import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Progress } from '@/components/ui/progress';
  import { Separator } from '@/components/ui/separator';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
  import { Toggle } from '@/components/ui/toggle';
  import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
  import { specsOf } from '@/lib/sift';
  import { itemStanding } from '@/lib/specs';
  import { columnAccent, laneAccent, toneRule, toneText } from '@/lib/tones';
  import UpgradePanel from '@/components/UpgradePanel.vue';
  import CanvasSection from './CanvasSection.vue';
  import {
    actions,
    attention,
    board,
    columns,
    details,
    documents,
    emptyBoard,
    epics,
    finished,
    closingProject,
    closings,
    mergingProject,
    prStatusReads,
    pullRequestItems,
    housekeepingRuns,
    knowledge,
    knowledgeAttention,
    knowledgeDiffs,
    knowledgeLater,
    knowledgeTexts,
    noDecisions,
    queuedDrop,
    queuedKeep,
    sendingAccept,
    sendingDrop,
    behindAttention,
    behindProject,
    manyOnStaging,
    ownStaging,
    quietStagingProject,
    stagingProject,
    refreshRuns,
    reviewerReads,
    staleProject,
    manySpecIds,
    mergedAttention,
    openDocument,
    plans,
    projects,
    runs,
    settingStates,
    specItems,
    specs,
    tasks,
    trackerTasks,
    waitingSpecs,
  } from './canvas-samples';

  /** A sample task by its id. */
  const sample = (id: string) => tasks.find((t) => t.id === id)!;

  /** The board columns of the samples' live tasks, as the Specs view's cards say them. */
  const specColumns = new Map([
    ['design-system', { id: 'in-progress', title: 'In progress' }],
    ['specs-and-epics', { id: 'ready', title: 'Ready' }],
  ]);

  /** A complete spec, as the list puts it last, and the one chosen in it. */
  const completeSpec = {
    ...specs[1]!,
    id: 'closing',
    title: 'A spec whose roadmap is done',
    epic: null,
    queue: null,
    progress: { done: 4, total: 4, filed: 0, fog: 0 },
  };

  /** The same, its epic still open: its request is to finish the epic. */
  const finishableSpec = { ...completeSpec, id: 'finishing', title: 'A spec whose epic can be finished', epic: specs[1]!.epic };

  const chosenSpec = ref('jig-ui');

  const buttonVariants = ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const;
  const buttonSizes = ['xs', 'sm', 'default', 'lg'] as const;
  const iconSizes = ['icon-xs', 'icon-sm', 'icon', 'icon-lg'] as const;
  const badgeVariants = ['default', 'secondary', 'outline', 'ghost', 'destructive', 'link'] as const;
  const tones = ['attention', 'good', 'bad', 'quiet'] as const;
  /** The settings dialog's state open on the canvas: a dialog covers the page, so one at a time. */
  const settingsOpen = ref<(typeof settingStates)[number]>();
  /** The File task… dialog's state open on the canvas. */
  const filingStates = [
    { label: 'a new task', busy: false },
    { label: 'filing', busy: true },
    {
      label: 'the id taken',
      busy: false,
      taken: true,
      refusal: 'The project has a finished task called invoices. Choose another id.',
    },
    {
      label: 'the item filed already',
      busy: false,
      refusal: 'Jig did not file invoices: i-5d729342e61f already names task orders',
    },
    {
      label: 'filed, not named',
      busy: false,
      refusal:
        'Filed invoices, but Jig did not name it on the item (spec/jig-ui is checked out in another checkout). Once that is resolved, File task… again with invoices.',
    },
  ];

  const filingOpen = ref<(typeof filingStates)[number]>();

  /** The header's Jig with a newer release: its question, while the update runs, and after Jig refused it. */
  const jigStates = [
    { label: 'Update…', busy: false, refusal: undefined },
    { label: 'updating', busy: true, refusal: undefined },
    { label: 'refused', busy: false, refusal: ['self-update: cannot reach the remote at …'] },
  ];

  const jigOpen = ref<string>();
</script>

<template>
  <div>
    <div class="border-b px-4 py-3">
      <h1 class="text-xl font-semibold">Canvas</h1>
      <p class="text-muted-foreground">Every component of the page in every variant and state; the left panel light, the right dark.</p>
    </div>

    <CanvasSection title="Tones" note="lib/tones.ts — the only colours with a meaning">
      <p v-for="tone in tones" :key="tone" :class="toneRule[tone]">{{ tone }} as a rule</p>
      <p class="flex gap-4">
        <span v-for="tone in tones" :key="tone" :class="toneText[tone]">{{ tone }}</span>
      </p>
    </CanvasSection>

    <h2 class="border-b px-4 py-2 text-[15px] font-semibold">components/ui</h2>

    <CanvasSection title="Button" note="variant × size; icon sizes; disabled">
      <div v-for="variant in buttonVariants" :key="variant" class="flex flex-wrap items-center gap-2">
        <span class="w-24 text-muted-foreground">{{ variant }}</span>
        <Button v-for="size in buttonSizes" :key="size" :variant="variant" :size="size">{{ size }}</Button>
        <Button :variant="variant" disabled>disabled</Button>
      </div>
      <div class="flex items-center gap-2">
        <span class="w-24 text-muted-foreground">icon</span>
        <Button v-for="size in iconSizes" :key="size" variant="outline" :size="size" :aria-label="size"><Copy /></Button>
        <Button variant="outline" size="sm"><Copy data-icon="inline-start" />with icon</Button>
      </div>
    </CanvasSection>

    <CanvasSection title="Badge">
      <div class="flex flex-wrap gap-2">
        <Badge v-for="variant in badgeVariants" :key="variant" :variant="variant">{{ variant }}</Badge>
      </div>
    </CanvasSection>

    <CanvasSection title="Card">
      <Card class="max-w-sm">
        <CardHeader>
          <CardTitle>Card title</CardTitle>
          <CardDescription>Card description, muted.</CardDescription>
        </CardHeader>
        <CardContent>Card content.</CardContent>
      </Card>
    </CanvasSection>

    <CanvasSection title="Input and Label" note="empty, filled, invalid, disabled">
      <div class="flex max-w-sm flex-col gap-2">
        <Label>Project path</Label>
        <Input placeholder="/path/to/project" />
        <Input model-value="/Users/me/project" />
        <Input model-value="/not/a/project" aria-invalid="true" />
        <Input model-value="disabled" disabled />
      </div>
    </CanvasSection>

    <CanvasSection title="Separator">
      <Separator />
      <div class="flex h-5 items-center gap-2">left<Separator orientation="vertical" />right</div>
    </CanvasSection>

    <CanvasSection title="ToggleGroup" note="the Board / List switch">
      <ToggleGroup type="single" variant="outline" size="sm" model-value="board" aria-label="View">
        <ToggleGroupItem value="board">Board</ToggleGroupItem>
        <ToggleGroupItem value="list">List</ToggleGroupItem>
      </ToggleGroup>
    </CanvasSection>

    <CanvasSection title="Tabs" note="a row of tabs, one chosen, one with a badge; a press chooses another; twenty wrap onto more rows">
      <Tabs default-value="jig-ui">
        <TabsList aria-label="Specs">
          <TabsTrigger v-for="spec in specs" :key="spec.id" :value="spec.id">
            {{ spec.id }}
            <Badge v-if="spec.queue?.priority != null" variant="secondary">P{{ spec.queue.priority }}</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent v-for="spec in specs" :key="spec.id" :value="spec.id" class="text-muted-foreground">{{
          spec.title ?? spec.id
        }}</TabsContent>
      </Tabs>
      <Tabs default-value="first-contact-path">
        <TabsList aria-label="Many specs" class="max-w-full flex-wrap">
          <TabsTrigger v-for="spec in manySpecIds" :key="spec" :value="spec" class="shrink-0">{{ spec }}</TabsTrigger>
        </TabsList>
      </Tabs>
    </CanvasSection>

    <CanvasSection title="Toggle" note="the board's finished tasks: off, on">
      <div class="flex gap-2">
        <Toggle variant="outline" size="sm" :model-value="false">3 finished tasks</Toggle>
        <Toggle variant="outline" size="sm" :model-value="true">3 finished tasks</Toggle>
      </div>
    </CanvasSection>

    <CanvasSection title="Collapsible" note="open and folded">
      <Collapsible v-for="open in [true, false]" :key="String(open)" :default-open="open">
        <CollapsibleTrigger class="w-full border-b bg-muted/50 px-3 py-1.5 text-left"
          >Trigger ({{ open ? 'open' : 'folded' }})</CollapsibleTrigger
        >
        <CollapsibleContent class="px-3 py-2">Content</CollapsibleContent>
      </Collapsible>
    </CanvasSection>

    <h2 class="border-b px-4 py-2 text-[15px] font-semibold">components</h2>

    <CanvasSection title="ProjectSwitcher" note="on the workspace; on a project (open it to search); no projects">
      <ProjectSwitcher :projects="projects" version="0.1.0"><ThemeToggle /></ProjectSwitcher>
      <ProjectSwitcher :projects="projects" current="jig-ui" version="0.1.0" />
      <ProjectSwitcher :projects="[]" />
    </CanvasSection>

    <CanvasSection
      title="MachineJig"
      note="the header's Jig: a newer release out, open its question in each state; no project to update through; up to date; the newest not known yet (offline); a build of Jig's source; none to tell"
    >
      <div class="flex flex-col items-start gap-2">
        <MachineJig
          v-for="state in jigStates"
          :key="state.label"
          :open="jigOpen === state.label"
          :jig="{ installed: '0.46.0', latest: '0.47.0', updatable: true }"
          :busy="state.busy"
          :refusal="state.refusal"
          @update:open="(open) => (jigOpen = open ? state.label : undefined)"
        />
        <MachineJig :open="false" :jig="{ installed: '0.46.0', latest: '0.47.0', updatable: false }" :busy="false" />
        <MachineJig :open="false" :jig="{ installed: '0.47.0', latest: '0.47.0', updatable: true }" :busy="false" />
        <MachineJig :open="false" :jig="{ installed: '0.46.0', latest: null, updatable: true }" :busy="false" />
        <MachineJig :open="false" :jig="{ installed: '0.47.0+abc1234', latest: '0.47.0', updatable: true }" :busy="false" />
        <MachineJig :open="false" :jig="null" :busy="false" />
      </div>
    </CanvasSection>

    <CanvasSection title="ProjectList" note="one chosen, a project in each state; type to search; on the first load, two still being read">
      <div class="flex flex-wrap gap-6">
        <ProjectList :projects="projects" chosen="jig-ui" class="w-64" />
        <ProjectList
          :projects="[projects[0]!, { id: 'slow-monorepo', state: 'reading' }, { id: 'billing', state: 'reading' }]"
          class="w-64"
        />
      </div>
    </CanvasSection>

    <CanvasSection
      title="SpecList"
      note="the Specs view's list: one chosen, an epic with its priority, a roadmap without progress, a complete spec last; type to search"
    >
      <SpecList :specs="[...specs, completeSpec]" :chosen="chosenSpec" class="w-60" @choose="(id) => (chosenSpec = id)" />
    </CanvasSection>

    <CanvasSection title="Progress" note="the first read of the projects: 1 of 3 landed">
      <div class="flex max-w-md flex-col gap-1">
        <p class="text-muted-foreground">Reading projects: 1 of 3</p>
        <Progress :model-value="33" aria-label="Projects read" />
      </div>
    </CanvasSection>

    <CanvasSection title="ProjectMark" note="things that need you; not readable; nothing; being read">
      <div class="flex gap-4">
        <ProjectMark
          v-for="p in [
            projects[0]!,
            projects.find((q) => q.state !== 'ready')!,
            projects.find((q) => q.state === 'ready' && q.attention.length === 0)!,
            { id: 'slow-monorepo', state: 'reading' as const },
          ]"
          :key="p.id"
          :project="p"
        />
      </div>
    </CanvasSection>

    <CanvasSection title="ThemeToggle" note="switches the whole page; the icon is the theme it switches to">
      <div><ThemeToggle /></div>
    </CanvasSection>

    <CanvasSection
      title="ProjectCard"
      note="ready with attention and stale housekeeping; nothing needs you; its Jig older than the machine's, Upgrade… offered; each state it cannot be read in; Housekeeping under way, its report, its refusal; a merged task to close, its close under way, Jig's refusal, a merge done, a landing refused as not approved (to the Board); pull requests in words with who merges each — the person, the agent's ship, the last housekeeping run's —, Merge… and Status… on them, a status open; a clone behind origin, one last fetched days ago, Refresh under way, the base brought up, changes in the way, a refusal; on the staging flow, the bell lit with your work there (press it), and dark with none"
    >
      <ProjectCard v-for="project in projects" :key="project.id" :project="project" />
      <ProjectCard v-for="(run, i) in housekeepingRuns" :key="`housekeeping-${i}`" :project="projects[1]!" :housekeeping="run" />
      <ProjectCard :project="closingProject" />
      <ProjectCard v-for="(run, i) in closings" :key="`closing-${i}`" :project="closingProject" :closing="run" />
      <ProjectCard :project="mergingProject" />
      <ProjectCard :project="mergingProject" :pr-status="{ task: 'merge-ready', read: prStatusReads[2]!.read }" />
      <ProjectCard :project="behindProject" />
      <ProjectCard :project="staleProject" />
      <ProjectCard v-for="(run, i) in refreshRuns" :key="`refresh-${i}`" :project="behindProject" :refresh="run" />
      <ProjectCard :project="stagingProject" />
      <ProjectCard :project="quietStagingProject" />
    </CanvasSection>

    <CanvasSection
      title="StagingWork"
      note="opened from the bell beside a project's name: the person's own commits on staging, all of them; Jig's newest 20 of 34; Mark as known under way; refused, the list changed since the read; refused with Jig's reasons"
    >
      <StagingWork project="parcel-desk" :staging="ownStaging" />
      <StagingWork project="parcel-desk" :staging="manyOnStaging" />
      <StagingWork project="parcel-desk" :staging="ownStaging" :ack="{ state: 'running' }" />
      <StagingWork
        project="parcel-desk"
        :staging="ownStaging"
        :ack="{ state: 'refused', message: 'Your work on staging changed since the card was read: look at the list again.', reasons: [] }"
      />
      <StagingWork
        project="parcel-desk"
        :staging="ownStaging"
        :ack="{
          state: 'refused',
          message: 'Jig refused the change.',
          reasons: ['this project is not on a sound staging flow (git.flow; jig doctor names what is wrong)'],
        }"
      />
    </CanvasSection>

    <CanvasSection
      title="UpgradePanel"
      note="on a card: reading the dry run; the plan, with steps by hand; a stop; a refusal; under way; merged, with steps by hand, staged, nothing to do; not started; failed"
    >
      <UpgradePanel v-for="(plan, i) in plans" :key="`plan-${i}`" project="legacy-shop" :run="null" :plan="plan" />
      <UpgradePanel v-for="(run, i) in runs" :key="`run-${i}`" project="legacy-shop" :run="run" :plan="undefined" />
    </CanvasSection>

    <CanvasSection
      title="BoardFilter"
      note="Jig's order and no filter, no task of a spec; tasks of specs, one chosen; sorted by priority with filters and text on"
    >
      <BoardFilter :model-value="{ sort: 'queue', classes: [], priorities: [], specs: [], text: '' }" :shown="12" :total="12" :specs="[]" />
      <BoardFilter
        :model-value="{ sort: 'queue', classes: [], priorities: [], specs: ['jig-ui'], text: '' }"
        :shown="5"
        :total="12"
        :specs="specsOf(board)"
      />
      <BoardFilter
        :model-value="{ sort: 'priority', classes: ['T1', 'T2'], priorities: ['P0', 'none'], specs: [], text: 'login' }"
        :shown="3"
        :total="12"
        :specs="specsOf(board)"
      />
    </CanvasSection>
    <CanvasSection title="NewTaskForm" note="empty, on its way, the id taken">
      <NewTaskForm :busy="false" />
      <NewTaskForm :busy="true" task="fix-login" goal="Log in with the token after a restart." />
      <NewTaskForm
        :busy="false"
        task="queue-reorder"
        goal="Order the work."
        refusal="The project has a task called queue-reorder already, maybe a finished one. Choose another id."
        taken
      />
    </CanvasSection>

    <CanvasSection title="ConnectForm" note="idle, busy, finding, refused">
      <ConnectForm :busy="false" />
      <ConnectForm :busy="true" model-value="/Users/me/project" />
      <ConnectForm :busy="false" :finding="true" model-value="~/code" />
      <ConnectForm
        :busy="false"
        model-value="/Users/me/project/.claude/worktrees/x"
        refusal="That is a worktree. Connect the main checkout instead."
      />
    </CanvasSection>

    <CanvasSection
      title="FoundProjects"
      note="found, one connecting; one refused; nothing to connect, folders skipped, stopped at the limit"
    >
      <FoundProjects
        :result="{ folder: '~', found: [{ path: '~/code/api' }, { path: '~/work/api' }], connected: 1, skipped: [], stopped: false }"
        connecting="~/code/api"
      />
      <FoundProjects
        :result="{
          folder: '~/code',
          found: [{ path: '~/code/a-really-long-folder-name/with/a-project-deep-inside' }],
          connected: 0,
          skipped: [],
          stopped: false,
        }"
        :refusal="{
          path: '~/code/a-really-long-folder-name/with/a-project-deep-inside',
          message: 'There is no Jig in this repository. Run jig init in it first.',
        }"
      />
      <FoundProjects :result="{ folder: '~', found: [], connected: 2, skipped: ['Desktop', 'Documents', 'Downloads'], stopped: true }" />
    </CanvasSection>

    <CanvasSection
      title="AttentionItem"
      note="no link; a pull request; another link; knowledge, on a project's card; a merged task to close, asking, closing; a clone behind origin, Refresh, refreshing; Jig 0.46.0's pull requests in the forge cache's words — to merge, held, to land on staging, open on the last housekeeping run, none in the cache (Jig's lines) —, on a card with Merge…, Land on staging, Status… where offered, asking before the merge, merging, landing, the status open; on a task's page, words only"
    >
      <AttentionItem v-for="(item, i) in attention" :key="i" :item="item" />
      <AttentionItem :item="knowledgeAttention" project="acme" />
      <AttentionItem :item="mergedAttention" project="acme" closes="close-from-attention" />
      <AttentionItem :item="mergedAttention" project="acme" closes="close-from-attention" asking />
      <AttentionItem :item="mergedAttention" project="acme" closes="close-from-attention" closing />
      <AttentionItem :item="behindAttention" project="acme" refreshable />
      <AttentionItem :item="behindAttention" project="acme" refreshable refreshing />
      <AttentionItem
        v-for="item in pullRequestItems"
        :key="item.subject.id!"
        :item="item"
        project="acme"
        writes
        who="The merge is yours."
      />
      <AttentionItem :item="pullRequestItems[0]!" project="acme" writes who="The merge is yours." asking />
      <AttentionItem :item="pullRequestItems[0]!" project="acme" writes who="The merge is yours." writing="merge" />
      <AttentionItem :item="pullRequestItems[2]!" project="acme" writes writing="land" />
      <AttentionItem :item="pullRequestItems[1]!" project="acme" writes :pr-status="{ read: prStatusReads[1]!.read }" />
      <AttentionItem :item="pullRequestItems[1]!" />
    </CanvasSection>

    <CanvasSection title="ColumnHeader" note="each column's title and count">
      <ColumnHeader v-for="column in columns" :key="column.id" :title="column.title" :count="column.count" />
    </CanvasSection>

    <CanvasSection
      title="GroupPanel"
      note="each column's accent, one this page does not know, a lane's, and none — a card in one, an empty one"
    >
      <div class="grid grid-cols-4 gap-3">
        <GroupPanel v-for="column in columns" :key="column.id" :accent="columnAccent[column.id] ?? 'bg-border'">
          <template #head>
            <h3 class="px-3 pt-2.5 pb-1"><ColumnHeader :title="column.title" :count="column.count" /></h3>
          </template>
          <p class="mx-2 mb-2 rounded-lg border bg-card px-3 py-2 text-[13px]">A card</p>
        </GroupPanel>
        <GroupPanel :accent="laneAccent['to-file']">
          <template #head><h3 class="px-3 pt-2.5 pb-1 text-[13px] font-semibold">To file</h3></template>
          <p class="mx-2 mb-2 rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">nothing here</p>
        </GroupPanel>
        <GroupPanel>
          <template #head><h3 class="px-4 pt-3 pb-2 text-[15px] font-semibold">A section</h3></template>
          <p class="px-4 pb-4 text-[13px]">No accent: a section of a page.</p>
        </GroupPanel>
      </div>
    </CanvasSection>

    <CanvasSection
      title="QueueMenu"
      note="press to open: To top, Up, Down, To bottom, Priority, the pause — first queued, in the middle, not queued, last, paused under a Jig that cannot resume it (no pause to ask, Resume off), paused and resumable, a pause asked, nobody started (Pause), parked at the staging branch (Take back for a fix), while its change is on its way, on a sorted board (no move), on a filtered board (To top and To bottom at either end of the cards shown); on the staging flow (Jig 0.46.0) first Land on staging and Request review… on an approved Review card, Request review… alone, Prepare for prod… on an On staging card; off it Merge… where Jig offers the merge, Status… where it cannot"
    >
      <div class="flex flex-wrap items-center gap-6">
        <span
          v-for="t in [tasks[0]!, tasks[1]!, tasks[3]!, tasks[11]!, tasks[9]!, tasks[13]!, tasks[10]!, tasks[12]!, tasks[16]!]"
          :key="t.id"
          class="flex items-center gap-1"
        >
          {{ t.id }}<QueueMenu :task="t" :cards="tasks" />
        </span>
        <span class="flex items-center gap-1">{{ tasks[1]!.id }}<QueueMenu :task="tasks[1]!" :cards="tasks" disabled /></span>
        <span class="flex items-center gap-1">{{ tasks[1]!.id }}<QueueMenu :task="tasks[1]!" /></span>
        <span class="flex items-center gap-1">{{ tasks[0]!.id }}<QueueMenu :task="tasks[0]!" :cards="tasks" filtered /></span>
        <span
          v-for="id in ['staging-landing', 'staging-review', 'staging-signal', 'merge-ready', 'merge-held']"
          :key="id"
          class="flex items-center gap-1"
        >
          {{ id }}<QueueMenu :task="sample(id)" :cards="tasks" />
        </span>
      </div>
    </CanvasSection>

    <CanvasSection
      title="EpicMenu"
      note="press to open: To top, Up, Down, To bottom, Priority — first queued (no Up), in the middle (Up and Down), last queued (no Down: the next one is not queued), not queued (Up joins the queued ones), while its change is on its way"
    >
      <div class="flex flex-wrap items-center gap-6">
        <span v-for="spec in epics" :key="spec.id" class="flex items-center gap-1"
          >{{ spec.id }}<EpicMenu :spec="spec" :specs="epics"
        /></span>
        <span class="flex items-center gap-1">{{ epics[1]!.id }}<EpicMenu :spec="epics[1]!" :specs="epics" disabled /></span>
      </div>
    </CanvasSection>

    <CanvasSection
      title="TaskCard"
      note="every note a card carries, a priority among them, the spec it was filed from (design-system), one going into its spec's epic (specs-and-epics); with its queue menu; while its change is on its way; changed since a refused change; open with details, while reading, unreadable; ready and closable (✕) with its queue menu, asking before it closes, while its close is on its way; at the board's narrowest column, ids a tracker names — by their key with a goal, whole without one and when open; on the staging flow asking before it prepares for prod, and its review request while the forge is asked and with whom it offers; off it asking before the merge, where its pull request stands while the forge is asked and once it answered"
    >
      <div class="grid grid-cols-2 gap-2 xl:grid-cols-3">
        <TaskCard v-for="task in tasks" :key="task.id" project="jig-ui" :task="task" :open="false" />
        <TaskCard project="jig-ui" :task="tasks[1]!" :open="false" :cards="tasks" />
        <TaskCard project="jig-ui" :task="tasks[0]!" :open="false" :cards="tasks" busy />
        <TaskCard project="jig-ui" :task="tasks[3]!" :open="false" :cards="tasks" changed />
        <TaskCard project="jig-ui" :task="tasks[2]!" :open="true" :details="details[0]" />
        <TaskCard project="jig-ui" :task="tasks[0]!" :open="true" />
        <TaskCard project="jig-ui" :task="tasks[1]!" :open="true" details="unavailable" />
        <TaskCard project="jig-ui" :task="tasks[4]!" :open="false" :cards="tasks" />
        <TaskCard project="jig-ui" :task="tasks[7]!" :open="false" :cards="tasks" confirming />
        <TaskCard project="jig-ui" :task="tasks[6]!" :open="false" :cards="tasks" busy />
        <TaskCard project="jig-ui" :task="sample('staging-signal')" :open="false" :cards="tasks" promoting />
        <TaskCard project="jig-ui" :task="sample('staging-review')" :open="false" :cards="tasks" :reviewing="{}" />
        <TaskCard
          project="jig-ui"
          :task="sample('staging-review')"
          :open="false"
          :cards="tasks"
          :reviewing="{ reviewers: reviewerReads[1]!.read }"
        />
        <TaskCard project="jig-ui" :task="sample('merge-ready')" :open="false" :cards="tasks" merging />
        <TaskCard project="jig-ui" :task="sample('merge-held')" :open="false" :cards="tasks" :pr-status="{}" />
        <TaskCard
          project="jig-ui"
          :task="sample('merge-held')"
          :open="false"
          :cards="tasks"
          :pr-status="{ read: prStatusReads[1]!.read }"
        />
      </div>
      <div class="mt-2 grid w-[23rem] grid-cols-2 gap-2">
        <TaskCard v-for="task in trackerTasks" :key="task.id" project="jig-ui" :task="task" :open="false" :cards="trackerTasks" />
        <TaskCard project="jig-ui" :task="trackerTasks[0]!" :open="true" />
      </div>
    </CanvasSection>

    <CanvasSection
      title="ChoreReports"
      note="Refresh and Housekeeping on a project's page and card: under way, what came of each, and why one did not run, each with Dismiss"
    >
      <div class="flex w-[28rem] flex-col gap-3">
        <ChoreReports v-for="(run, i) in refreshRuns" :key="`refresh-${i}`" project="jig-ui" :refresh="run" />
        <ChoreReports v-for="(run, i) in housekeepingRuns" :key="`housekeeping-${i}`" project="jig-ui" :housekeeping="run" />
      </div>
    </CanvasSection>

    <CanvasSection
      title="SpecMark"
      note="a spec's title and phase, to open; going into the spec's epic; a spec not in the checkout — its id, nothing to open — and a link with no phase"
    >
      <div class="flex w-64 flex-col gap-2">
        <SpecMark :spec="{ id: 'jig-ui', title: 'Jig UI — a local control center for Jig projects', phase: 4, epic: false }" openable />
        <SpecMark :spec="{ id: 'release-2026-11-18', title: 'Release 0.8.0', phase: 1, epic: true }" openable />
        <SpecMark :spec="{ id: 'team-board', title: null, phase: null, epic: false }" />
      </div>
    </CanvasSection>

    <CanvasSection
      title="TaskRow"
      note="each note and priority, the spec it was filed from; selected; with its queue menu; while its change is on its way; changed since a refused change; ready and closable, asking before it closes; asking before it prepares for prod, its review request; asking before the merge, where its pull request stands"
    >
      <div>
        <TaskRow v-for="(task, i) in tasks" :key="task.id" :task="task" :selected="i === 2" />
        <TaskRow :task="tasks[1]!" :selected="false" :cards="tasks" />
        <TaskRow :task="tasks[0]!" :selected="false" :cards="tasks" busy />
        <TaskRow :task="tasks[3]!" :selected="false" :cards="tasks" changed />
        <TaskRow :task="tasks[7]!" :selected="false" :cards="tasks" confirming />
        <TaskRow :task="sample('staging-signal')" :selected="false" :cards="tasks" promoting />
        <TaskRow :task="sample('staging-review')" :selected="false" :cards="tasks" :reviewing="{ reviewers: reviewerReads[1]!.read }" />
        <TaskRow :task="sample('merge-ready')" :selected="false" :cards="tasks" merging />
        <TaskRow :task="sample('merge-held')" :selected="false" :cards="tasks" :pr-status="{ read: prStatusReads[1]!.read }" />
      </div>
    </CanvasSection>

    <CanvasSection
      title="WriteConfirm"
      note="before a write the page cannot take back: closing a ready task as done, preparing one for prod, merging a pull request"
    >
      <div class="flex w-72 flex-col gap-2">
        <WriteConfirm write="close" task="close-ready-task" />
        <WriteConfirm write="promote" task="staging-signal" />
        <WriteConfirm write="merge" task="merge-ready" />
      </div>
    </CanvasSection>

    <CanvasSection title="PrStatus" :note="prStatusReads.map((r) => r.note).join('; ')">
      <div class="grid grid-cols-2 gap-2 xl:grid-cols-3">
        <PrStatus v-for="r in prStatusReads" :key="r.note" task="merge-held" :status="r.read" />
      </div>
    </CanvasSection>

    <CanvasSection title="ReviewRequest" :note="reviewerReads.map((r) => r.note).join('; ')">
      <div class="grid grid-cols-2 gap-2 xl:grid-cols-3">
        <ReviewRequest v-for="r in reviewerReads" :key="r.note" task="staging-review" :reviewers="r.read" :asked="['alice']" />
      </div>
    </CanvasSection>

    <CanvasSection
      title="BoardColumns"
      note="cards in every column, one open with its details, two changed since a refused change; no live task"
    >
      <div class="flex h-[28rem] flex-col">
        <BoardColumns
          project="jig-ui"
          :columns="board"
          :selected="tasks[2]!.id"
          :details="details[0]"
          :pending="tasks[0]!.id"
          :changed="[tasks[1]!.id, tasks[3]!.id]"
        />
      </div>
      <div class="flex h-40 flex-col">
        <BoardColumns project="jig-ui" :columns="emptyBoard" />
      </div>
    </CanvasSection>

    <CanvasSection
      title="BoardList"
      note="a row picked with its details; nothing picked; In progress empty among full groups; no live task"
    >
      <div class="flex h-[28rem] flex-col">
        <BoardList project="jig-ui" :columns="board" :selected="tasks[2]!.id" :details="details[0]" />
      </div>
      <div class="flex h-64 flex-col">
        <BoardList project="jig-ui" :columns="board" />
      </div>
      <div class="flex h-80 flex-col">
        <BoardList project="jig-ui" :columns="board.map((c) => (c.id === 'in-progress' ? { ...c, cards: [] } : c))" />
      </div>
      <div class="flex h-64 flex-col">
        <BoardList project="jig-ui" :columns="emptyBoard" />
      </div>
    </CanvasSection>

    <CanvasSection
      title="FinishedList"
      note="closed with its pull request merged; abandoned; archived without a goal — each with Jig's offers in its menu; a write under way; the read under way; none left; a read that failed, with Read again"
    >
      <div class="flex flex-col gap-3">
        <FinishedList :read="{ state: 'ready', tasks: finished, revision: 1 }" class="border" />
        <FinishedList :read="{ state: 'ready', tasks: finished, revision: 1 }" pending="pr-template" class="border" />
        <FinishedList class="border" />
        <FinishedList :read="{ state: 'ready', tasks: [], revision: 1 }" class="border" />
        <FinishedList :read="{ id: 'jig-ui', state: 'unreadable', code: 'timeout' }" class="border" />
      </div>
    </CanvasSection>

    <CanvasSection
      title="TaskFacts"
      note="everything a task can carry, in an epic and waiting for two; queued at the top; a task not started; on the staging flow, its pull request into staging apart from the promotion"
    >
      <TaskFacts v-for="d in details" :key="d.id" :details="d" class="border-b pb-3" />
    </CanvasSection>

    <CanvasSection title="TaskBrief" note="the facts, the link to the full page and the id to copy; no actions">
      <TaskBrief project="jig-ui" :task="details[1]!.id" :details="details[1]" />
    </CanvasSection>

    <CanvasSection
      title="TaskDocuments"
      note="written, empty, not readable — design open, plan being read; none yet; Jig too old; Jig did not answer; being listed; a document Jig could not read"
    >
      <TaskDocuments :documents="documents" :open="{ design: openDocument, plan: 'reading' }" />
      <TaskDocuments :documents="{ state: 'ready', artifacts: [] }" :open="{}" />
      <TaskDocuments :documents="{ id: 'x', state: 'unsupported', jigVersion: '0.38.1', minimum: '0.39.0' }" :open="{}" />
      <TaskDocuments :documents="{ id: 'x', state: 'unreadable', code: 'timeout' }" :open="{}" />
      <TaskDocuments :open="{}" />
      <TaskDocuments :documents="documents" :open="{ task: { id: 'x', state: 'unreadable', code: 'failed' } }" />
    </CanvasSection>

    <CanvasSection
      title="KnowledgeView"
      note="proposals — a document, a stub, a stub whose file is gone, one accepted and waiting in a pull request; changed sources — a diff read with bytes dropped, one being read, no approved text, a file gone, one kept whose diff Jig could not read; then an Accept being sent and a Keep queued behind it, and decisions waiting pushed with no pull request"
    >
      <KnowledgeView :knowledge="knowledge" :diffs="knowledgeDiffs" :texts="{}" :queued="noDecisions" :sending="noDecisions" />
      <KnowledgeView
        :knowledge="{
          ...knowledge,
          proposals: knowledge.proposals.slice(0, 1),
          sources: knowledge.sources.slice(0, 1),
          waiting: { ...knowledge.waiting!, pr: null },
        }"
        :diffs="{}"
        :texts="{}"
        :queued="queuedKeep"
        :sending="sendingAccept"
      />
    </CanvasSection>

    <CanvasSection
      title="KnowledgeView, Jig 0.41.0"
      note="proposals — a feature's text, a stub's with its Markdown file (bytes dropped) and with a file that is not Markdown, one not pushed being read, one after the decisions were cut whose name lost bytes and whose text Jig could not read, one no longer proposed when its text was read; changed sources — Keep and Drop, Drop on a file gone, one dropped and waiting, one changed only here; then a Drop queued and a Drop being sent"
    >
      <KnowledgeView :knowledge="knowledgeLater" :diffs="{}" :texts="knowledgeTexts" :queued="noDecisions" :sending="noDecisions" />
      <KnowledgeView
        :knowledge="{ ...knowledgeLater, proposals: [], sources: knowledgeLater.sources.slice(1, 3) }"
        :diffs="{}"
        :texts="{}"
        :queued="queuedDrop"
        :sending="sendingDrop"
      />
    </CanvasSection>

    <CanvasSection
      title="ActionList"
      note="Jig's offers, one unknown id; the page's own writes left out; start as the agent's request, and on a Jig before 0.46.0 as its command; none"
    >
      <ActionList :actions="actions" project="jig-ui" task="design-system" />
      <ActionList :actions="actions" project="jig-ui" task="design-system" :runs="new Set(['approve-gate'])" writes />
      <ActionList
        :actions="[{ id: 'start', command: 'jig task start file-backlog-task' }]"
        project="jig-ui"
        task="file-backlog-task"
        writes
      />
      <ActionList :actions="[{ id: 'start', command: 'jig task start file-backlog-task' }]" project="jig-ui" task="file-backlog-task" />
      <ActionList :actions="[]" project="jig-ui" task="x" />
    </CanvasSection>

    <CanvasSection
      title="GateApproval"
      note="the design as written, with Approve; a T4's spec and alternatives first; being read; one Jig could not read; approving; refused"
    >
      <GateApproval :documents="[{ kind: 'design', content: openDocument.state === 'ready' ? openDocument.content : '' }]" :busy="false" />
      <GateApproval
        :documents="[
          { kind: 'spec', content: '# Spec\n\nWhat it must do.' },
          { kind: 'alternatives', content: '# Alternatives\n\nTwo lost.' },
          { kind: 'design', content: '# Design\n\nThe shape.' },
        ]"
        :busy="false"
      />
      <GateApproval :busy="false" />
      <GateApproval :documents="[{ kind: 'design', content: null }]" :busy="false" />
      <GateApproval :documents="[{ kind: 'design', content: '# Design' }]" busy />
      <GateApproval
        :documents="[{ kind: 'design', content: '# Design' }]"
        :busy="false"
        refusal="The project changed while you were approving the design of design-system. Look at it again as it is now."
      />
    </CanvasSection>

    <CanvasSection title="TaskWrites" note="abandon and archive offered; abandon only; archiving; refused">
      <TaskWrites task="design-system" :offers="new Set(['abandon', 'archive'])" :busy="false" />
      <TaskWrites task="design-system" :offers="new Set(['abandon'])" :busy="false" />
      <TaskWrites task="design-system" :offers="new Set(['archive'])" busy />
      <TaskWrites task="design-system" :offers="new Set(['abandon'])" :busy="false" refusal="Somebody archived design-system first." />
    </CanvasSection>

    <CanvasSection title="DependsEditor" note="its own dependency with a remove, one through its epic without; none; busy; refused">
      <DependsEditor
        task="pause-request"
        :depends-on="details[0]!.dependsOn"
        :candidates="['task:registry-schema', 'epic:refunds']"
        :busy="false"
      />
      <DependsEditor task="registry-schema" :depends-on="[]" :busy="false" />
      <DependsEditor task="pause-request" :depends-on="details[0]!.dependsOn" busy />
      <DependsEditor
        task="pause-request"
        :depends-on="[]"
        :busy="false"
        refusal="Jig refused adding a dependency to pause-request: the dependency would close a cycle."
      />
    </CanvasSection>

    <CanvasSection title="CopyButton" note="copy; copy id">
      <div class="flex gap-2">
        <CopyButton text="jig task pause design-system" />
        <CopyButton text="design-system" label="copy id" />
      </div>
    </CanvasSection>

    <CanvasSection title="StateLine" note="read; past the read limit, with Read again; while it reads again; refused; not supported">
      <div class="flex flex-col gap-2">
        <StateLine
          :project="{
            id: 'shop',
            state: 'ready',
            jigVersion: '0.38.1',
            counts: { active: 0, paused: 0, ready: 0 },
            attention: [],
            housekeepingStale: false,
            origin: null,
            stagingFlow: false,
            closable: [],
            shipping: [],
            agentGit: null,
            revision: 0,
          }"
        />
        <StateLine :project="{ id: 'shop', state: 'unreadable', code: 'timeout' }" />
        <StateLine :project="{ id: 'shop', state: 'unreadable', code: 'timeout' }" reading />
        <StateLine :project="{ id: 'shop', state: 'unreadable', code: 'not-initialised' }" />
        <StateLine :project="{ id: 'shop', state: 'unsupported', jigVersion: '0.26.0', minimum: '0.31.0' }" />
      </div>
    </CanvasSection>

    <CanvasSection title="CopyCommand" note="short; long enough to be cut">
      <CopyCommand command="jig task pause design-system" />
      <CopyCommand
        command="jig task autopilot a-task-with-a-rather-long-identifier-that-wraps resume --answer 'a long answer to the question'"
        class="max-w-xs"
      />
    </CanvasSection>

    <CanvasSection title="ProgressBar" note="none, part, all, an empty roadmap">
      <ProgressBar
        v-for="[done, total] in [
          [0, 4],
          [3, 9],
          [5, 5],
          [0, 0],
        ]"
        :key="`${done}/${total}`"
        :done="done!"
        :total="total!"
      />
    </CanvasSection>

    <CanvasSection
      title="SettingsDialog"
      note="open one: the person's keys of each kind and the project's; saving; a refusal; reading; an old Jig; unreadable"
    >
      <div class="flex flex-wrap gap-2">
        <Button v-for="state in settingStates" :key="state.label" variant="outline" size="xs" @click="settingsOpen = state">{{
          state.label
        }}</Button>
      </div>
    </CanvasSection>
    <SettingsDialog
      v-if="settingsOpen"
      :open="true"
      project="jig-ui"
      :settings="settingsOpen.settings"
      :pending="settingsOpen.pending"
      :notice="settingsOpen.notice"
      @update:open="settingsOpen = undefined"
    />

    <CanvasSection
      title="SpecItemCard"
      note="done with a live task; in work with dependencies; a task no longer live; to file; fog; opened, its rest under the title; changed by a waiting edit; with its roadmap menu"
    >
      <ul class="grid max-w-sm gap-2">
        <SpecItemCard
          v-for="(item, i) in specItems"
          :key="i"
          :item="item"
          project="jig-ui"
          :standing="itemStanding(item, specColumns)"
          :live="item.task !== null && specColumns.has(item.task)"
          :open="false"
        />
        <SpecItemCard :item="specItems[1]!" project="jig-ui" :standing="itemStanding(specItems[1]!, specColumns)" live open />
        <SpecItemCard
          :item="specItems[3]!"
          project="jig-ui"
          :standing="itemStanding(specItems[3]!, specColumns)"
          :live="false"
          :open="false"
          waiting
        />
        <SpecItemCard
          :item="specItems[3]!"
          project="jig-ui"
          :standing="itemStanding(specItems[3]!, specColumns)"
          :live="false"
          :open="false"
        >
          <template #menu><SpecItemMenu :items="specItems" :index="3" :phase="1" :phases="[0, 1, 2]" /></template>
        </SpecItemCard>
      </ul>
    </CanvasSection>

    <CanvasSection
      title="SpecItemMenu"
      note="press to open: Up, Down, To Phase N, File task… — the first item (no Up), the second (Up to the top), one with no task (File task…), the last (no Down), alone in the only phase (nothing to move it by), while an edit is on its way"
    >
      <div class="flex flex-wrap items-center gap-6">
        <span v-for="i in [0, 1, 3, 4]" :key="i" class="flex items-center gap-1"
          >item {{ i + 1 }}<SpecItemMenu :items="specItems" :index="i" :phase="1" :phases="[0, 1, 2]"
        /></span>
        <span class="flex items-center gap-1">alone<SpecItemMenu :items="[specItems[3]!]" :index="0" :phase="1" :phases="[1]" /></span>
        <span class="flex items-center gap-1"
          >item 2<SpecItemMenu :items="specItems" :index="1" :phase="1" :phases="[0, 1, 2]" disabled
        /></span>
      </div>
    </CanvasSection>

    <CanvasSection title="FileItemDialog" note="open one; type the id of a live task (design-system) to see the goal go">
      <div class="flex flex-wrap gap-2">
        <Button v-for="state in filingStates" :key="state.label" variant="outline" size="xs" @click="filingOpen = state">{{
          state.label
        }}</Button>
      </div>
    </CanvasSection>
    <FileItemDialog
      v-if="filingOpen"
      :open="true"
      spec="jig-ui"
      :item="specItems[3]!"
      :live="['design-system', 'specs-and-epics']"
      :busy="filingOpen.busy"
      :refusal="filingOpen.refusal"
      :taken="filingOpen.taken"
      @update:open="filingOpen = undefined"
    />

    <CanvasSection
      title="SpecBoard"
      note="no epic, opened on the first phase with work left; an open epic in the queue at P1, with its queue menu; a lost epic branch, not queued, with its change on its way; missing files; a complete roadmap, with no epic (ask to close it) and with an open one (ask to finish it), its request under the collapsed Ask your agent"
    >
      <div class="flex flex-col gap-10">
        <SpecBoard
          v-for="spec in [...specs, completeSpec, finishableSpec]"
          :key="spec.id"
          :spec="spec"
          project="jig-ui"
          :columns="specColumns"
          :busy="spec.id === 'lost-epic'"
        >
          <template v-if="spec.epic?.state === 'open'" #menu>
            <EpicMenu :spec="spec" :specs="specs" :disabled="spec.id === 'lost-epic'" />
          </template>
        </SpecBoard>
      </div>
    </CanvasSection>

    <CanvasSection
      title="SpecBoard, editable"
      note="its roadmap edited from the page (Jig 0.40.0): each item's menu, Up and Down among its lane, and Add item under the lanes of a numbered phase — none before the first; edits waiting on the spec's branch committed only, pushed, in a pull request, the roadmap there with the items they changed marked; while an edit is on its way"
    >
      <div class="flex flex-col gap-10">
        <SpecBoard :spec="specs[1]!" project="jig-ui" :columns="new Map()" editable />
        <SpecBoard v-for="spec in waitingSpecs" :key="spec.id" :spec="spec" project="jig-ui" :columns="specColumns" editable />
        <SpecBoard :spec="specs[0]!" project="jig-ui" :columns="specColumns" editable busy disabled />
      </div>
    </CanvasSection>
  </div>
</template>
