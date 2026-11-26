// Sample data for the canvas: every state a component shows, in the shapes of api.ts.
import type {
  Attention,
  Column,
  Decision,
  DocumentText,
  PrStatus,
  Project,
  ReadyDetails,
  ReadyKnowledge,
  Reviewers,
  SourceDiff,
  Setting,
  Settings,
  Spec,
  SpecItem,
  Task,
  TaskArtifact,
  TaskArtifacts,
  UpgradePlan,
} from '@/api';
import type { FinishedTask } from '@/lib/finished';
import type { ClosingState, HousekeepingState, RefreshState } from '@/lib/projects';
import { refreshReport } from '@/lib/refresh';
import type { SpecDocumentRead } from '@/lib/specs';
import type { OwnStaging } from '@/lib/staging';
import type { PlanState, UpgradeRun } from '@/lib/upgrade';

const task = (id: string, more: Partial<Task>): Task => ({
  id,
  class: 'T2',
  status: 'active',
  goal: null,
  paused: false,
  pauseRequest: null,
  pauseRequestable: true,
  pausable: false,
  resumable: false,
  closable: false,
  landable: false,
  reviewRequestable: false,
  promotable: false,
  mergeable: false,
  statusable: false,
  staging: null,
  parked: null,
  stagingFlow: false,
  spec: null,
  promotion: null,
  resumesTo: null,
  started: true,
  gate: null,
  autopilot: null,
  stage: null,
  updatedAt: null,
  waitsFor: [],
  pullRequest: null,
  priority: null,
  queue: null,
  ...more,
});

const pr = (state: string | null, ci: string | null) => ({
  url: 'https://github.com/fapost-lab/jig-ui/pull/18',
  state,
  ci,
  fetchedAt: '2026-10-18T09:40:00Z',
});

/** One task for each note a card can carry, and one with none. */
/** Ids a tracker names, as a colleague's board has them: long, with a key at their head. */
export const trackerTasks: Task[] = [
  task('SRD-2598-long-term-storage-threshold', {
    class: 'T4',
    priority: 1,
    goal: 'Let the warehouse decide, per client, how long goods may stay in long-term storage.',
  }),
  task('SRD-2627-split-oversized-item-volume', {
    class: 'T1',
    priority: 2,
    status: 'ready',
    closable: true,
    goal: 'Split by box must not answer 500 when an item is larger than the box.',
  }),
  task('SRD-2606-transfer-packing-refusal-not-reported', { class: 'T1', priority: 2 }),
];

export const tasks: Task[] = [
  task('design-system', {
    class: 'T3',
    gate: 'waiting',
    priority: 0,
    queue: { level: null, position: 100 },
    spec: { id: 'jig-ui', title: 'Jig UI — a local control center for Jig projects', phase: 2, epic: false },
    goal: 'shadcn-vue on Tailwind v4 with light and dark themes; #/canvas with every component in every variant; the three screens rebuilt on it.',
  }),
  task('registry-schema', {
    gate: 'changed',
    priority: 3,
    queue: { level: null, position: 200 },
    goal: 'Version the registry file so a newer Jig UI can read an older one.',
  }),
  task('pause-request', {
    class: 'T3',
    autopilot: 'stopped',
    goal: 'A drop on the paused column writes a sticky request through Jig; the card shows it with its age and a cancel.',
  }),
  task('specs-and-epics', {
    autopilot: 'on',
    queue: { level: null, position: 300 },
    spec: { id: 'team-board', title: null, phase: 1, epic: true },
    goal: "Show each spec with its phases, progress and epic branch beside the board, from Jig's spec list.",
  }),
  task('task-details', { status: 'ready', closable: true, pullRequest: pr('open', 'green'), goal: "Open a task's details from its card." }),
  task('refusal-fixture', {
    class: 'T0',
    status: 'ready',
    pullRequest: pr('open', 'red'),
    goal: 'Replace the refusal text in task-list-states.json with one Jig prints.',
  }),
  task('docs-board', {
    class: 'T1',
    status: 'ready',
    closable: true,
    pullRequest: pr('open', 'pending'),
    goal: 'Describe the five columns on the projects page of the docs.',
  }),
  task('live-updates', {
    status: 'ready',
    closable: true,
    pullRequest: pr('merged', 'none'),
    goal: 'Follow connected projects without a reload.',
  }),
  task('no-pr-yet', { class: 'T1', status: 'ready', goal: 'Ready, nothing pushed.' }),
  task('jig-init-hook', {
    class: 'T3',
    paused: true,
    pauseRequestable: false,
    goal: 'Register a project in an installed Jig UI from jig init.',
  }),
  // Nobody started it: Jig 0.45.0 takes no pause request for it, and pauses it at once.
  task('file-backlog-task', {
    class: null,
    started: false,
    pauseRequestable: false,
    pausable: true,
    goal: 'File a minimal backlog task from the page through jig task new.',
  }),
  task('a-task-with-a-rather-long-identifier-that-wraps', { goal: null }),
  task('conflict-display', {
    pauseRequest: { requestedAt: '2026-10-22T09:00:00Z' },
    pauseRequestable: false,
    goal: 'Show what changed when a write was based on a stale read.',
  }),
  task('resume-from-page', {
    class: 'T3',
    paused: true,
    pauseRequestable: false,
    resumable: true,
    resumesTo: 'in-progress',
    goal: 'A drop out of Paused, or the card menu, resumes the task through jig task resume.',
  }),
  // Jig's staging flow (0.45.0): parked at the staging branch for each of its reasons, and a fix taken back.
  task('staging-review', {
    status: 'ready',
    stagingFlow: true,
    parked: { reason: 'review', hint: null, review: { state: 'waiting', waitingFor: ['alice', 'bob'] } },
    reviewRequestable: true,
    pullRequest: pr('open', 'green'),
    goal: 'Its pull request into staging waits for a review.',
  }),
  task('staging-landing', {
    status: 'ready',
    stagingFlow: true,
    parked: { reason: 'review', hint: 'landing', review: { state: 'approved', waitingFor: [] } },
    // Jig 0.46.0: landed from the card's menu, and reviews asked there.
    landable: true,
    reviewRequestable: true,
    pullRequest: pr('open', 'green'),
    goal: 'Its pull request into staging waits for the person to land it.',
  }),
  task('staging-signal', {
    status: 'ready',
    staging: 'on',
    stagingFlow: true,
    parked: { reason: 'signal', hint: null, review: null },
    resumable: true,
    resumesTo: 'in-progress',
    promotable: true,
    pullRequest: pr('merged', 'none'),
    goal: 'On staging, tested there, waiting for prepare for prod.',
  }),
  task('staging-fix', { staging: 'behind', pullRequest: pr('merged', 'none'), goal: 'Taken back from staging; the fix is not there yet.' }),
  // Jig 0.46.0: changes asked on the pull request into staging, and a promotion into the base with its link.
  task('staging-changes', {
    status: 'ready',
    stagingFlow: true,
    parked: { reason: 'review', hint: null, review: { state: 'changes', waitingFor: [] } },
    pullRequest: pr('open', 'red'),
    goal: 'A reviewer asked for changes to its pull request into staging.',
  }),
  task('staging-promotion', {
    status: 'ready',
    stagingFlow: true,
    staging: 'on',
    pullRequest: pr('merged', 'green'),
    promotion: { url: 'https://github.com/fapost-lab/jig-ui/pull/61', state: 'open', ci: 'pending', fetchedAt: null },
    goal: 'Prepared for prod: its promotion into the base is open.',
  }),
  // Jig 0.46.0 off the staging flow: its pull request merged from the card's menu, and where one stands that cannot be.
  task('merge-ready', {
    status: 'ready',
    mergeable: true,
    pullRequest: pr('open', 'green'),
    goal: "Its pull request is green and approved: the person's to merge.",
  }),
  task('merge-held', { status: 'ready', statusable: true, pullRequest: pr('open', 'red'), goal: 'A check of its pull request failed.' }),
];

/** The samples placed as the board places them: every column with cards. */
export const board: Column[] = [
  { id: 'needs-you', title: 'Needs you', cards: tasks.slice(0, 3) },
  { id: 'in-progress', title: 'In progress', cards: [tasks[3]!, tasks[12]!, tasks[11]!, tasks[17]!] },
  { id: 'review', title: 'Review', cards: [tasks[14]!, tasks[15]!, tasks[18]!] },
  { id: 'on-staging', title: 'On staging', cards: [tasks[16]!] },
  { id: 'ready', title: 'Ready', cards: [...tasks.slice(4, 9), tasks[19]!, tasks[20]!, tasks[21]!] },
  { id: 'backlog', title: 'Backlog', cards: [tasks[10]!] },
  { id: 'paused', title: 'Paused', cards: [tasks[9]!, tasks[13]!] },
];

/** A board with no live task. */
export const emptyBoard: Column[] = board.map((c) => ({ ...c, cards: [] }));

/** Closed with its pull request merged, abandoned with none, and one archived without a goal; each with what Jig offers on it. */
export const finished: FinishedTask[] = [
  {
    id: 'file-backlog-task',
    status: 'consolidated',
    goal: 'File a minimal backlog task from the page.',
    updatedAt: '2026-10-25',
    pullRequest: { url: 'https://github.com/fapost-lab/jig-ui/pull/40', state: 'merged' },
    offers: ['archive'],
  },
  {
    id: 'pr-template',
    status: 'abandoned',
    goal: 'A pull request template.',
    updatedAt: '2026-10-17',
    pullRequest: null,
    offers: ['archive', 'drop-item'],
  },
  { id: 'old-spike', status: 'archived', goal: null, updatedAt: '2026-10-12', pullRequest: null, offers: ['unarchive'] },
];

export const columns = [
  { id: 'needs-you', title: 'Needs you', count: 3 },
  { id: 'in-progress', title: 'In progress', count: 1 },
  { id: 'review', title: 'Review', count: 3 },
  { id: 'on-staging', title: 'On staging', count: 1 },
  { id: 'ready', title: 'Ready', count: 5 },
  { id: 'backlog', title: 'Backlog', count: 1 },
  { id: 'paused', title: 'Paused', count: 1 },
  { id: 'unknown', title: 'A column this page does not know', count: 0 },
];

export const attention: Attention[] = [
  {
    kind: 'gate',
    subject: { type: 'task', id: 'design-system' },
    tasks: ['design-system'],
    title: 'Design waits at its gate',
    detail: null,
    todo: 'Review the design and approve it: jig task gate design-system approved',
    url: null,
    versions: null,
  },
  {
    kind: 'pull-request-ci-failed',
    subject: { type: 'task', id: 'refusal-fixture' },
    tasks: ['refusal-fixture'],
    title: 'CI failed',
    detail: 'pull request #19',
    todo: 'Look at the failing check.',
    url: 'https://github.com/fapost-lab/jig-ui/pull/19',
    versions: null,
  },
  {
    kind: 'housekeeping',
    subject: { type: 'project', id: null },
    tasks: [],
    title: 'Housekeeping never ran',
    detail: null,
    todo: 'Run jig housekeeping.',
    url: 'https://example.com/docs',
    versions: null,
  },
];

export const actions = [
  { id: 'approve-gate', command: 'jig task gate design-system approved' },
  { id: 'answer-stop', command: 'jig task autopilot pause-request resume --answer <text>' },
  { id: 'pause', command: 'jig task pause design-system' },
  { id: 'request-pause', command: 'jig queue request task:design-system pause' },
  { id: 'something-new', command: 'jig task something-new design-system' },
];

const base = {
  state: 'ready' as const,
  revision: 1794994851,
  writes: true,
  issue: null,
  baseBranch: 'main',
  createdAt: '2026-10-17',
  updatedAt: '2026-10-18',
  knowledgeConsolidated: false,
  worktree: null,
  gateBy: null,
  run: null,
  housekeepingFlags: [],
  attention: [],
  place: null,
  dependsOn: [],
};

/** Details with everything a task can carry, one queued at the top, and one with as little as a task not started. */
export const details: ReadyDetails[] = [
  {
    ...base,
    ...tasks[2]!,
    priority: 1,
    queue: { level: 'epic:booking', position: 200 },
    place: { rank: 2, of: 3 },
    dependsOn: [
      { on: 'task:design-system', reason: 'Its card takes the new tokens', through: null },
      { on: 'epic:refunds', reason: 'A refund pauses the booking', through: 'epic:booking' },
    ],
    gate: 'approved',
    gateBy: 'human',
    branch: 'task/pause-request',
    worktree: { uncommitted: 4 },
    issue: '#42',
    pullRequest: pr('open', 'red'),
    run: {
      mode: 'attended',
      stage: 'implement',
      stageAt: '2026-10-18T09:00:00Z',
      stopReason: 'Which column takes a paused task that already has an open pull request?',
      stopAt: '2026-10-18T09:12:00Z',
      phase: null,
    },
    housekeepingFlags: ['needs-consolidation'],
    attention: [attention[0]!],
    actions,
    column: { id: 'needs-you', title: 'Needs you' },
  },
  {
    ...base,
    ...tasks[1]!,
    place: { rank: 2, of: 4 },
    branch: 'task/registry-schema',
    actions: [{ id: 'pause', command: 'jig task pause registry-schema' }],
    column: { id: 'needs-you', title: 'Needs you' },
  },
  {
    ...base,
    ...tasks[10]!,
    branch: null,
    actions: [{ id: 'start', command: 'jig task start file-backlog-task' }],
    column: { id: 'backlog', title: 'Backlog' },
  },
  // Jig's staging flow: the work on staging, its promotion into the base open — the link is the pull request into staging.
  {
    ...base,
    ...tasks.find((t) => t.id === 'staging-signal')!,
    parked: null,
    pullRequest: pr('open', 'green'),
    branch: 'task/staging-signal',
    actions: [],
    column: { id: 'ready', title: 'Ready' },
  },
];

const ready = (id: string, more: Partial<Extract<Project, { state: 'ready' }>> = {}): Project => ({
  id,
  state: 'ready',
  jigVersion: '0.29.0',
  counts: { active: 11, paused: 1, ready: 3 },
  attention: [],
  housekeepingStale: false,
  origin: null,
  stagingFlow: false,
  closable: [],
  shipping: [],
  agentGit: null,
  revision: 0,
  upgrade: null,
  ...more,
});

/** A project in each state the workspace shows. */
export const projects: Project[] = [
  ready('jig-ui', { attention, housekeepingStale: true }),
  ready('nextjs-store', { counts: { active: 0, paused: 0, ready: 0 } }),
  ready('legacy-shop', {
    jigVersion: '0.34.0',
    counts: { active: 2, paused: 0, ready: 0 },
    attention: [
      {
        kind: 'upgrade-available',
        subject: { type: 'project', id: null },
        tasks: [],
        title: 'Jig in this project is older than on this machine',
        detail: 'this project runs 0.34.0; this machine has 0.35.0',
        todo: 'jig upgrade',
        url: null,
        versions: { from: '0.34.0', to: '0.35.0' },
      },
    ],
  }),
  { id: 'old-jig', state: 'unsupported', jigVersion: '0.26.0', minimum: '0.29.0', upgrade: null },
  { id: 'new-jig', state: 'incompatible', jigVersion: '1.0.0', upgrade: null },
  { id: 'busy', state: 'unreadable', code: 'locked', upgrade: null },
  { id: 'moved', state: 'unavailable', reason: 'missing', upgrade: null },
];

const plan: UpgradePlan = { mode: 'copy', from: '0.34.0', to: '0.35.0', outcome: 'planned', git: null, manualSteps: [], wouldStop: [] };

/** Housekeeping from a card: under way, Jig's report as it printed it, Jig's refusal with its reasons. */
export const housekeepingRuns: HousekeepingState[] = [
  { state: 'running' },
  {
    state: 'done',
    report: [
      'needs you (1):',
      '  merged but not consolidated, run jig-consolidate: release-0-6-0',
      'removed (2): moved to …, recoverable for 7 days',
      '  quiet-design-nits, quiet-design',
      'housekeeping: deleted branch task/quiet-design',
    ],
    summary: 'removed 2 · 1 branch deleted',
  },
  { state: 'refused', message: "Jig's housekeeping failed.", reasons: ['housekeeping.trash_ttl: not a duration'] },
];

/** The upgrade panel before a run: reading the dry run, its plan with and without steps by hand, a stop, a refusal. */
export const plans: PlanState[] = [
  { state: 'reading' },
  { state: 'planned', plan },
  { state: 'planned', plan: { ...plan, manualSteps: ['Restart your agent sessions: the skills changed.'] } },
  {
    state: 'planned',
    plan: {
      ...plan,
      wouldStop: [
        'the working tree has uncommitted changes; commit them, stash them (`git stash`), or finish the task they belong to, then run `jig upgrade` again',
      ],
    },
  },
  { state: 'refused', message: 'Jig refused the upgrade.' },
  {
    state: 'refused',
    message: 'Jig refused the upgrade.',
    reasons: ['cannot determine the framework source root; pass --from <dir>'],
  },
];

const git = {
  level: 'pr',
  branch: 'jig/upgrade-0.35.0',
  commit: '279390b',
  pushed: true,
  pullRequest: 'https://github.com/fapost-lab/jig-ui/pull/49',
  merged: false,
};
const done = (more: Partial<UpgradePlan>): UpgradeRun => ({
  state: 'done',
  at: '2026-10-27T08:00:00Z',
  upgrade: { ...plan, outcome: 'upgraded', git, ...more },
});

/** An upgrade under way, and what one can come to. */
export const runs: UpgradeRun[] = [
  { state: 'running', since: new Date(Date.now() - 120_000).toISOString(), to: '0.35.0' },
  done({ git: { ...git, merged: true } }),
  done({ manualSteps: ['Restart your agent sessions: the skills changed.'] }),
  done({ outcome: 'staged', git: { ...git, level: 'none', commit: null, pushed: false, pullRequest: null } }),
  done({ outcome: 'nothing-to-do', git: null }),
  {
    state: 'refused',
    at: '2026-10-27T08:00:00Z',
    code: 'upgrade-blocked',
    reasons: [
      'task up-x is started and its branch task/up-x is checked out here (record .ai/runtime/working/up-x); the upgrade would take this checkout off it',
    ],
  },
  { state: 'refused', at: '2026-10-27T08:00:00Z', code: 'failed', reasons: [] },
  {
    state: 'refused',
    at: '2026-10-27T08:00:00Z',
    code: 'failed',
    reasons: ['cannot determine the framework source root; pass --from <dir>'],
  },
];

export const specItems: SpecItem[] = [
  { id: 'i-0a1b2c3d4e5f', text: '`design-system` — design system and canvas', checked: true, task: 'design-system', fog: false },
  {
    id: 'i-1b2c3d4e5f60',
    text: '`specs-and-epics` — specs and epics (after: project board — `jig spec list`)',
    checked: false,
    task: 'specs-and-epics',
    fog: false,
  },
  { id: 'i-2c3d4e5f6071', text: '`old-task` — a task no longer live', checked: false, task: 'old-task', fog: false },
  { id: 'i-3d4e5f607182', text: 'invoices from orders, no task filed yet', checked: false, task: null, fog: false },
  { id: 'i-4e5f60718293', text: 'fog: registration by `jig init`', checked: false, task: null, fog: true },
];

export const specs: Spec[] = [
  {
    id: 'jig-ui',
    title: 'Jig UI — a local control center for Jig projects',
    summary: 'A local web page over Jig: the board, the specs and the knowledge of a project, read through Jig and never from its files.',
    missingFiles: [],
    release: null,
    epic: null,
    progress: { done: 2, total: 6, filed: 2, fog: 1 },
    phases: [
      {
        phase: 0,
        title: 'Package and release',
        done: 1,
        total: 1,
        filed: 0,
        fog: 0,
        items: [{ ...specItems[0]!, id: 'i-5f6071829304', text: 'package and release', task: null }],
      },
      { phase: 1, title: 'Read-only UI', done: 1, total: 5, filed: 2, fog: 1, items: specItems },
    ],
    waiting: null,
    queue: null,
  },
  {
    id: 'billing',
    title: 'Billing in one place',
    summary: null,
    missingFiles: [],
    release: 'minor',
    epic: { branch: 'epic/billing', state: 'open', checkedOut: false, missing: false, fetched: true },
    progress: { done: 0, total: 1, filed: 0, fog: 0 },
    phases: [{ phase: null, title: null, done: 0, total: 1, filed: 0, fog: 0, items: [specItems[3]!] }],
    waiting: null,
    queue: { position: 100, priority: 1 },
  },
  {
    id: 'lost-epic',
    title: 'An epic whose branch is gone',
    summary: null,
    missingFiles: [],
    release: 'major',
    epic: { branch: 'epic/lost', state: 'open', checkedOut: true, missing: true, fetched: false },
    progress: null,
    phases: [],
    waiting: null,
    queue: null,
  },
  {
    id: 'half-written',
    title: null,
    summary: null,
    missingFiles: ['spec.md', 'roadmap.md'],
    release: null,
    epic: null,
    progress: null,
    phases: [],
    waiting: null,
    queue: null,
  },
];

/**
 * A spec with edits waiting on its branch, in each state they reach: committed only, pushed, in a pull request. On the
 * branch the fog item moved to Phase 2, an item was added and one was filed.
 */
const shop = specs[0]!;
const onBranch: Spec['phases'] = [
  { ...shop.phases[0]!, items: [...shop.phases[0]!.items, { ...specItems[3]!, id: 'i-60718293a4b5', text: 'refunds by card' }] },
  {
    ...shop.phases[1]!,
    items: [specItems[0]!, specItems[1]!, specItems[2]!, { ...specItems[3]!, text: '`invoices` — invoices from orders', task: 'invoices' }],
  },
  { phase: 2, title: 'Writes', done: 0, total: 0, filed: 0, fog: 1, items: [specItems[4]!] },
];
const waiting = { branch: 'spec/jig-ui', base: 'main', commits: 3, progress: shop.progress, phases: onBranch };
/** A project with many specs, as the maintainer's screenshot showed: the Specs view's tabs wrap instead of scrolling. */
export const manySpecIds = [
  'audit-log',
  'data-lifecycle',
  'ecosystem-distribution',
  'extension-docs',
  'first-contact-path',
  'forge-gitlab',
  'knowledge-graph',
  'multi-repo',
  'notifications',
  'offline-mode',
  'onboarding',
  'phase-runs',
  'plugin-api',
  'release-train',
  'review-models',
  'secrets-scan',
  'staging-flow',
  'telemetry-opt-in',
  'windows-support',
  'workspace-sync',
];

export const waitingSpecs: Spec[] = [
  { ...shop, id: 'committed', waiting: { ...waiting, pushed: false, pr: null } },
  { ...shop, id: 'pushed', waiting: { ...waiting, pushed: true, pr: null } },
  { ...shop, id: 'in-review', waiting: { ...waiting, pushed: true, pr: 'https://github.com/fapost-lab/jig-ui/pull/116' } },
];

/** Open epics in the order the Specs view shows them: three queued, one not yet. */
export const epics: Spec[] = [
  specs[1]!,
  { ...specs[1]!, id: 'refunds', title: 'Refunds', queue: { position: 200, priority: null } },
  { ...specs[1]!, id: 'exports', title: 'Exports', queue: { position: 300, priority: 4 } },
  { ...specs[1]!, id: 'payouts', title: 'Payouts', queue: null },
];

const hourAgo = new Date(Date.now() - 3_600_000).toISOString();

/** A task's documents: written ones, an empty one, one Jig cannot read. */
export const documents: TaskArtifacts = {
  state: 'ready',
  artifacts: [
    { kind: 'task', state: 'present', reason: null, updatedAt: hourAgo, bytes: 1749 },
    { kind: 'design', state: 'present', reason: null, updatedAt: hourAgo, bytes: 5288 },
    { kind: 'plan', state: 'present', reason: null, updatedAt: hourAgo, bytes: 2140 },
    { kind: 'verification', state: 'empty', reason: null, updatedAt: hourAgo, bytes: 0 },
    { kind: 'handoff', state: 'unavailable', reason: 'outside workspace', updatedAt: null, bytes: null },
  ],
};

/** The design open, as Markdown with what a document carries: headings, a list, code, a table, a quote. */
export const openDocument: TaskArtifact = {
  state: 'ready',
  kind: 'design',
  updatedAt: hourAgo,
  bytes: 5288,
  revision: 1794994851,
  content: [
    '# Design — task-artifacts',
    '',
    '## What changes',
    '',
    "A task's full details page gets a **Documents** section, each one opened on a click.",
    '',
    '- `readArtifacts(root, task)` runs `jig task artifacts <task> --json`',
    '- `readArtifact(root, task, kind)` runs `jig task artifact read <task> <kind> --json`',
    '',
    '```ts',
    "export const ARTIFACTS_JIG_VERSION = '0.39.0';",
    '```',
    '',
    '| state | listed |',
    '| --- | --- |',
    '| present | yes |',
    '| missing | no |',
    '',
    '> A document shows the paths its authors wrote.',
  ].join('\n'),
};

const setting = (key: string, more: Partial<Setting>): Setting => ({
  key,
  value: null,
  set: false,
  source: 'default',
  scope: 'local only',
  kind: 'text',
  allowed: null,
  default: null,
  description: `What ${key} sets.`,
  secret: false,
  ...more,
});

/** One key of each kind and source, the token set, and the project's keys, as Jig 0.40.0 lists them. */
const settingKeys: Setting[] = [
  setting('profiles', { scope: 'project', source: 'project', kind: 'list', value: '[node]', set: true, default: '[generic]' }),
  setting('forge', {
    scope: 'project',
    source: 'project',
    kind: 'choice',
    value: 'github',
    set: true,
    allowed: ['auto', 'github', 'gitlab', 'none'],
    default: 'auto',
  }),
  setting('housekeeping.cadence', { scope: 'local', source: 'project', kind: 'duration', value: '1d', set: true, default: '1d' }),
  setting('agent.git', {
    source: 'local',
    kind: 'choice',
    value: 'pr',
    set: true,
    allowed: ['none', 'commit', 'push', 'pr', 'merge'],
    default: 'none',
  }),
  setting('autopilot.unattended', { kind: 'boolean', value: 'false', allowed: ['true', 'false'], default: 'false' }),
  setting('agent.ci_timeout', { kind: 'number', value: '30', default: '30' }),
  setting('claude.review_model', {}),
  setting('notify.telegram.token', { source: 'local', set: true, secret: true }),
];
const readSettings: Settings = { state: 'ready', keys: settingKeys, revision: 1 };

/** The settings dialog in each of its states. */
export const settingStates: {
  label: string;
  settings?: Settings;
  pending?: string;
  /** What came of the last change: a toast, which the canvas raises when the state is opened. */
  notice?: string;
}[] = [
  { label: 'ready', settings: readSettings },
  { label: 'saving', settings: readSettings, pending: 'agent.git' },
  {
    label: 'refused',
    settings: readSettings,
    notice: "Jig did not change housekeeping.cadence: invalid value 'soon': not a whole number of days (e.g. 1d, 3d)",
  },
  { label: 'reading' },
  { label: 'old Jig', settings: { id: 'jig-ui', state: 'unsupported', jigVersion: '0.39.0', minimum: '0.40.0' } },
  { label: 'unreadable', settings: { id: 'jig-ui', state: 'unreadable', code: 'timeout' } },
];

/** What a record of Jig 0.40.0 reads for the fields Jig 0.41.0 added. */
const older = { decidable: null, reason: null, lossy: null };

/** Knowledge Jig 0.40.0 lists as waiting for a decision: a proposal, stubs whose file is there and gone, decisions waiting, each state of a linked file. */
export const knowledge: ReadyKnowledge = {
  state: 'ready',
  revision: 1,
  canRead: false,
  canDrop: false,
  canDecideMany: false,
  proposals: [
    {
      id: 'feature-checkout',
      type: 'feature',
      domains: ['shop'],
      path: '.ai/knowledge/features/checkout.md',
      paths: ['src/checkout/**', 'src/cart/**'],
      summary: 'How checkout takes a card payment',
      source: null,
      bytes: null,
      waiting: null,
      ...older,
    },
    {
      id: 'convention-coding-style',
      type: 'convention',
      domains: [],
      path: '.ai/knowledge/sources/coding-style.md',
      paths: [],
      summary: null,
      source: 'docs/style.md',
      bytes: 2310,
      waiting: null,
      ...older,
    },
    {
      id: 'convention-ops',
      type: 'convention',
      domains: [],
      path: '.ai/knowledge/sources/ops.md',
      paths: [],
      summary: null,
      source: 'docs/ops.md',
      bytes: null,
      waiting: null,
      ...older,
    },
    {
      id: 'adr-20261106-payments-provider',
      type: 'adr',
      domains: [],
      path: '.ai/knowledge/adr/20261106-payments-provider.md',
      paths: ['src/payments/**'],
      summary: 'Card payments go through one provider',
      source: null,
      bytes: null,
      waiting: { decision: 'accepted', pr: 'https://github.com/fapost-lab/acme/pull/12' },
      ...older,
    },
  ],
  sources: [
    { id: 'convention-team-rules', state: 'changed', source: 'docs/rules.md', bytes: 106, waiting: null, ...older },
    { id: 'convention-release', state: 'changed', source: 'docs/release.md', bytes: 3400, waiting: null, ...older },
    { id: 'convention-legacy', state: 'unrecorded', source: 'docs/legacy.md', bytes: 800, waiting: null, ...older },
    { id: 'convention-deploy', state: 'missing', source: 'docs/deploy.md', bytes: null, waiting: null, ...older },
    {
      id: 'convention-review',
      state: 'changed',
      source: 'docs/review.md',
      bytes: 512,
      waiting: { decision: 'reviewed', pr: null },
      ...older,
    },
  ],
  waiting: { branch: 'knowledge/decisions', base: 'main', pushed: true, pr: 'https://github.com/fapost-lab/acme/pull/12' },
};

/** Open diffs of the linked files: one read (a line not UTF-8 dropped), one being read, one Jig could not read. */
export const knowledgeDiffs: Record<string, SourceDiff | 'reading'> = {
  'convention-team-rules': {
    state: 'ready',
    diff: '--- docs/rules.md (approved)\n+++ docs/rules.md\n@@ -1,4 +1,5 @@\n # Team rules\n \n - Review every change.\n-- Ship on green.\n+- Ship on green, after CI on Windows too.\n+- Never on a Friday.\n',
    lossy: true,
  },
  'convention-release': 'reading',
  'convention-review': { id: 'acme', state: 'unreadable', code: 'failed' },
};

/** The diffs of Jig 0.41.0's changed files: one with no approved text to compare with, one gone by the time it is read. */
export const knowledgeDiffsLater: Record<string, SourceDiff | 'not-found'> = {
  'convention-team-rules': { state: 'ready', diff: null, lossy: false },
  'convention-release': 'not-found',
};

/** What Jig 0.41.0 reads of each record a decision can be sent on now. */
const judged = { decidable: true, reason: null, lossy: false };

/**
 * Knowledge Jig 0.41.0 lists: proposals whose text can be read — one not pushed, one that reached the base after the
 * decisions were cut, one whose file name lost bytes, one Jig no longer lists by the time its text is read —, and linked files that can be dropped, one dropped and waiting, one
 * changed only here.
 */
export const knowledgeLater: ReadyKnowledge = {
  state: 'ready',
  revision: 1,
  canRead: true,
  canDrop: true,
  canDecideMany: false,
  proposals: [
    {
      id: 'feature-checkout',
      type: 'feature',
      domains: ['shop'],
      path: '.ai/knowledge/features/checkout.md',
      paths: ['src/checkout/**'],
      summary: 'How checkout takes a card payment',
      source: null,
      bytes: null,
      waiting: null,
      ...judged,
    },
    {
      id: 'convention-coding-style',
      type: 'convention',
      domains: [],
      path: '.ai/knowledge/sources/coding-style.md',
      paths: [],
      summary: null,
      source: 'docs/style.md',
      bytes: 26,
      waiting: null,
      ...judged,
    },
    {
      id: 'convention-build',
      type: 'convention',
      domains: [],
      path: '.ai/knowledge/sources/build.md',
      paths: [],
      summary: null,
      source: 'Makefile',
      bytes: 31,
      waiting: null,
      ...judged,
    },
    {
      id: 'feature-search',
      type: 'feature',
      domains: [],
      path: '.ai/knowledge/features/search.md',
      paths: ['src/search/**'],
      summary: null,
      source: null,
      bytes: null,
      waiting: null,
      decidable: false,
      reason: 'not-on-base',
      lossy: false,
    },
    {
      id: 'feature-search-index',
      type: 'feature',
      domains: [],
      path: '.ai/knowledge/features/search-index.md',
      paths: ['src/search/index/**'],
      summary: 'How the search index is rebuilt',
      source: null,
      bytes: null,
      waiting: null,
      decidable: false,
      reason: 'landed',
      lossy: false,
    },
    {
      id: 'feature-billing',
      type: 'feature',
      domains: [],
      path: '.ai/knowledge/features/billing.md',
      paths: ['src/billing/**'],
      summary: 'How invoices are issued',
      source: null,
      bytes: null,
      waiting: null,
      decidable: false,
      reason: 'not-on-branch',
      lossy: true,
    },
    {
      id: 'feature-legacy-auth',
      type: 'feature',
      domains: [],
      path: '.ai/knowledge/features/legacy-auth.md',
      paths: ['src/auth/**'],
      summary: 'How the old login works',
      source: null,
      bytes: null,
      waiting: null,
      ...judged,
    },
  ],
  sources: [
    { id: 'convention-team-rules', state: 'changed', source: 'docs/rules.md', bytes: 85, waiting: null, ...judged },
    { id: 'convention-legacy', state: 'unrecorded', source: 'docs/legacy.md', bytes: 20, waiting: null, ...judged },
    { id: 'convention-deploy', state: 'missing', source: 'docs/deploy.md', bytes: null, waiting: null, ...judged },
    {
      id: 'convention-release',
      state: 'changed',
      source: 'docs/release.md',
      bytes: 3400,
      waiting: { decision: 'rejected', pr: null },
      ...judged,
    },
    {
      id: 'convention-review',
      state: 'changed',
      source: 'docs/review.md',
      bytes: 512,
      waiting: null,
      decidable: false,
      reason: 'not-on-base',
      lossy: false,
    },
  ],
  waiting: { branch: 'knowledge/decisions', base: 'main', pushed: true, pr: null },
};

/** Open document texts: a feature's, a stub's with its Markdown file (bytes dropped), a stub's with a file that is not Markdown, one being read, one Jig could not read, one no longer proposed. */
export const knowledgeTexts: Record<string, DocumentText | 'reading' | 'not-found'> = {
  'feature-checkout': {
    state: 'ready',
    content:
      '---\nid: feature-checkout\ntype: feature\nstatus: proposed\n---\n# Checkout\n\n## What\n\nHow checkout takes a card payment: the cart calls `pay()` once, and a declined card leaves the order open.\n\n## Constraints\n\n- One provider (see the payments ADR).\n- No card number is stored.\n',
    lossy: false,
    source: null,
  },
  'convention-coding-style': {
    state: 'ready',
    content:
      '---\nid: convention-coding-style\ntype: convention\nstatus: proposed\nsource: docs/style.md\n---\n# Coding style\n\nLinked source: [docs/style.md](../../../docs/style.md). The source owns its rules.\n',
    lossy: false,
    source: { content: '# Style\n\nUse tabs  here.\n', lossy: true },
  },
  'convention-build': {
    state: 'ready',
    content: '---\nid: convention-build\nsource: Makefile\n---\n# Build\n\nLinked source: [Makefile](../../../Makefile).\n',
    lossy: false,
    source: { content: 'build:\n\tnpm run build\n\ttsc -p .\n', lossy: false },
  },
  'feature-search': 'reading',
  'feature-billing': { id: 'acme', state: 'unreadable', code: 'failed' },
  'feature-legacy-auth': 'not-found',
};

/** The project item that sends the person to the Knowledge view. */
export const knowledgeAttention: Attention = {
  kind: 'knowledge-proposed',
  subject: { type: 'project', id: null },
  tasks: [],
  title: 'Knowledge is waiting for your decision',
  detail: '4 document(s) proposed',
  todo: "Ask the agent: what's proposed? (jig-accept)",
  url: null,
  versions: null,
};

/** Jig's item for a merged task, which a project's card offers to close. */
export const mergedAttention: Attention = {
  kind: 'needs-consolidation',
  subject: { type: 'task', id: 'close-from-attention' },
  tasks: ['close-from-attention'],
  title: 'Merged: the task can be closed',
  detail: 'housekeeping at 2026-11-11 10:27 EET',
  todo: 'Tell the agent to close this task (jig-consolidate).',
  url: null,
  versions: null,
};

/** Jig 0.46.0's items about a task's pull request, with the forge cache's word and what Jig offers on it. */
const cachedPr = (ci: string, review: NonNullable<Attention['taskPullRequest']>['review']) => ({
  state: 'open',
  url: 'https://github.com/fapost-lab/jig-ui/pull/64',
  ci,
  mergeable: 'mergeable',
  review,
  fetchedAt: '2026-10-18T09:40:00Z',
});
const pullRequestItem = (id: string, more: Partial<Attention>): Attention => ({
  kind: 'pull-request-waiting',
  subject: { type: 'task', id },
  tasks: [id],
  title: 'A pull request is waiting for review',
  detail: 'open, CI green',
  todo: `Merge it: jig task merge-pr ${id} --by human`,
  url: 'https://github.com/fapost-lab/jig-ui/pull/64',
  versions: null,
  ...more,
});
export const pullRequestItems: Attention[] = [
  pullRequestItem('merge-ready', {
    taskPullRequest: cachedPr('green', { state: 'approved', waitingFor: [] }),
    offers: ['merge', 'pr-status'],
  }),
  pullRequestItem('merge-held', {
    taskPullRequest: cachedPr('pending', { state: 'waiting', waitingFor: ['alice'] }),
    offers: ['pr-status'],
  }),
  pullRequestItem('staging-landing', {
    taskPullRequest: { ...cachedPr('green', { state: 'approved', waitingFor: [] }), mergeable: null },
    offers: ['land', 'pr-status'],
  }),
  pullRequestItem('was-open', {
    kind: 'pull-request-was-open',
    title: 'A pull request was open at the last housekeeping run',
    taskPullRequest: cachedPr('red', null),
    offers: ['pr-status'],
  }),
  // No entry in the forge cache: Jig's own lines.
  pullRequestItem('not-cached', { taskPullRequest: null, offers: ['pr-status'] }),
];

/** A project off the staging flow with a pull request the person merges, one the agent's ship merges itself, and one held. */
export const mergingProject: Project = ready('jig-ui', {
  jigVersion: '0.46.0',
  attention: [pullRequestItems[0]!, { ...pullRequestItems[1]!, subject: { type: 'task', id: 'shipping' } }, pullRequestItems[3]!],
  shipping: ['shipping'],
  agentGit: 'pr',
});

/** Where a pull request stands, each way its status shows it. */
export const prStatusReads: {
  note: string;
  read?: PrStatus;
}[] = [
  { note: 'asking the forge' },
  {
    note: 'held back: a check failed after 7 min with its link, one running for 20 min, the review waits for alice, what main asks',
    read: {
      state: 'ready',
      pullRequest: { url: 'https://github.com/o/r/pull/12', state: 'open', draft: false, base: 'main', mergeable: 'clean' },
      checks: {
        state: 'red',
        list: [
          {
            name: 'test (ubuntu)',
            state: 'fail',
            url: 'https://github.com/o/r/actions/runs/1/job/2',
            startedAt: '2026-11-19T16:40:00Z',
            completedAt: '2026-11-19T16:47:00Z',
            durationS: 420,
          },
          { name: 'test (macos)', state: 'pending', url: null, startedAt: '2026-11-19T16:40:00Z', completedAt: null, durationS: 1200 },
          { name: 'lint', state: 'pass', url: null, startedAt: null, completedAt: null, durationS: 35 },
        ],
      },
      review: { state: 'waiting', waitingFor: ['alice'] },
      protection: { mergeState: 'blocked', requiredApprovals: 1, requiredChecks: ['test (ubuntu)', 'test (macos)'] },
      blockers: ['ci-red', 'not-approved'],
    },
  },
  {
    note: 'nothing holds it back',
    read: {
      state: 'ready',
      pullRequest: { url: 'https://github.com/o/r/pull/12', state: 'open', draft: false, base: 'main', mergeable: 'clean' },
      checks: { state: 'green', list: [{ name: 'test', state: 'pass', url: null, startedAt: null, completedAt: null, durationS: 240 }] },
      review: { state: 'approved', waitingFor: [] },
      protection: { mergeState: 'clean', requiredApprovals: 0, requiredChecks: [] },
      blockers: [],
    },
  },
  {
    note: 'a draft that conflicts, no check run, changes asked, the rules not said',
    read: {
      state: 'ready',
      pullRequest: { url: 'https://github.com/o/r/pull/12', state: 'open', draft: true, base: 'main', mergeable: 'conflict' },
      checks: { state: 'none', list: [] },
      review: { state: 'changes', waitingFor: [] },
      protection: { mergeState: null, requiredApprovals: null, requiredChecks: null },
      blockers: ['draft', 'conflict', 'ci-none'],
    },
  },
  {
    note: 'the forge not asked',
    read: {
      state: 'refused',
      code: 'forge-unavailable',
      reasons: ['the forge cannot be asked: no forge configured: origin is on no forge Jig knows; set forge to github or gitlab'],
    },
  },
  { note: 'no longer offered', read: { state: 'refused', code: 'not-found', reasons: [] } },
];

/** A project with a merged task to close from its card. */
export const closingProject: Project = ready('jig-ui', { attention: [mergedAttention], closable: ['close-from-attention'] });

/** Jig 0.45.0's item for a clone behind origin, which a project's card offers to refresh. */
export const behindAttention: Attention = {
  kind: 'base-behind-origin',
  subject: { type: 'project', id: null },
  tasks: [],
  title: 'This checkout is behind origin',
  detail: 'main is 2 commit(s) behind origin/main, as of the fetch at 2026-11-13T08:40:55Z',
  todo: 'jig refresh',
  url: null,
  versions: null,
};

/** A clone behind origin, its Refresh on Jig's item; one that last fetched days ago, its Refresh on that line. */
export const behindProject: Project = ready('jig-ui', {
  attention: [behindAttention],
  origin: { fetchedAt: '2026-11-13T08:40:55Z', behind: 2 },
});
export const staleProject: Project = ready('nextjs-store', {
  counts: { active: 0, paused: 0, ready: 1 },
  origin: { fetchedAt: '2026-11-01T09:00:00Z', behind: 0 },
});

/** The person's own commits on staging, as Jig 0.46.0 lists them: all of them, and Jig's newest 20 of 34. */
export const ownStaging: OwnStaging = {
  commits: 2,
  list: [
    { sha: '29b3236343dfd37b43a1e545ee51ce65b01b9f6b', subject: 'Retry the courier call once', date: '2026-11-18T17:04:55+02:00' },
    { sha: '4f9b92d84eeb864055506696c351837083a75dfa', subject: 'Fix the label on the parcel form', date: '2026-11-17T11:20:00+02:00' },
  ],
};
export const manyOnStaging: OwnStaging = {
  commits: 34,
  list: Array.from({ length: 20 }, (_, i) => ({
    sha: `${(0xa1b2c3d + i).toString(16)}${'0'.repeat(33)}`,
    subject: `Try the checkout step ${20 - i} on staging`,
    date: '2026-11-10T09:00:00+02:00',
  })),
};

/** On the staging flow: the bell lit with the person's own work there, and dark with none. */
export const stagingProject: Project = ready('parcel-desk', {
  stagingFlow: true,
  attention: [
    {
      kind: 'staging-unowned',
      subject: { type: 'project', id: null },
      tasks: [],
      title: 'Your work on staging that no live task branch holds',
      detail: '2 commit(s) of yours on staging that the base does not have',
      todo: 'Bring what the base still needs to it through a task; once you know the rest, run jig staging ack to stop being told.',
      url: null,
      versions: null,
      staging: ownStaging,
    },
  ],
});
export const quietStagingProject: Project = ready('parcel-api', { counts: { active: 1, paused: 0, ready: 0 }, stagingFlow: true });

const refreshed = (outcome: 'fast-forwarded' | 'blocked-by-changes') =>
  refreshReport({
    fetch: 'done',
    fetchedAt: '2026-11-13T08:40:56Z',
    base: { name: 'main', outcome, from: '79ed4f712093', to: outcome === 'fast-forwarded' ? 'dbe9c989c721' : '79ed4f712093' },
    writes: outcome === 'fast-forwarded' ? [{ target: 'knowledge', branch: 'knowledge/decisions', reason: 'merged' }] : [],
  });

/** Refresh from a card: under way, the base brought up with a write closed, changes in the way, and a refusal. */
export const refreshRuns: RefreshState[] = [
  { state: 'running' },
  { state: 'done', ...refreshed('fast-forwarded') },
  { state: 'done', ...refreshed('blocked-by-changes') },
  { state: 'refused', message: 'Jig did not finish within two minutes.' },
];

/** A write from a card: a close under way and refused, a merge done, a landing refused as not approved. */
export const closings: ClosingState[] = [
  { task: 'close-from-attention', write: 'close', state: 'running' },
  {
    task: 'close-from-attention',
    write: 'close',
    state: 'refused',
    message: 'Jig did not close close-from-attention: its pull request has not merged (https://github.com/o/r/pull/12 is open).',
  },
  {
    task: 'close-from-attention',
    write: 'merge',
    state: 'done',
    message: "Merged close-from-attention's pull request and closed the task.",
  },
  {
    task: 'close-from-attention',
    write: 'land',
    state: 'refused',
    message: 'Jig did not land close-from-attention: not landed: it waits for review from alice',
    board: true,
  },
];

/** Decisions the page holds: none; a proposal's Accept being sent and a stub's Keep queued; two Drops, one queued and one being sent. */
export const noDecisions = new Map<string, Decision>();
export const sendingAccept = new Map<string, Decision>([['feature-checkout', 'accept']]);
export const queuedKeep = new Map<string, Decision>([['convention-team-rules', 'reviewed']]);
export const queuedDrop = new Map<string, Decision>([['convention-legacy', 'reject']]);
export const sendingDrop = new Map<string, Decision>([['convention-deploy', 'reject']]);

/** Whom the forge offers to review, each way the review request shows it. */
export const reviewerReads: {
  note: string;
  read?: Reviewers;
}[] = [
  { note: 'asking the forge' },
  {
    note: 'who reviewed here most often, one asked already',
    read: {
      state: 'ready',
      source: 'history',
      candidates: [
        { login: 'alice', name: 'Alice Smith', reviews: 12 },
        { login: 'bob', name: null, reviews: 3 },
        { login: 'carol', name: 'Carol Jones', reviews: 1 },
      ],
    },
  },
  {
    note: 'nobody reviewed lately: everyone the repository may ask',
    read: { state: 'ready', source: 'assignable', candidates: [{ login: 'dave', name: 'Dave Lee', reviews: null }] },
  },
  { note: 'nobody to ask', read: { state: 'ready', source: 'assignable', candidates: [] } },
  {
    note: 'the forge not asked',
    read: { state: 'refused', code: 'forge-unavailable', reasons: ['the forge could not be asked: gh is not signed in'] },
  },
  { note: 'Jig did not answer', read: { id: 'jig-ui', state: 'unreadable', code: 'timeout' } },
];

/** A spec's open documents as its head shows them: read, being read, gone, one Jig could not read, one with bytes dropped. */
export const specDocuments: Record<string, SpecDocumentRead> = {
  read: {
    state: 'ready',
    kind: 'spec',
    bytes: 120,
    content:
      '# Jig UI\n\nSummary: a local web page over Jig.\n\n## What it must do\n\n- Show the board of a project.\n- Show each spec as `jig spec list` reads it.\n',
    lossy: false,
  },
  reading: 'reading',
  gone: 'not-found',
  failed: 'failed',
  'epic nowhere': { state: 'unreadable', code: 'epic-missing', id: 'jig-ui' },
  lossy: { state: 'ready', kind: 'roadmap', bytes: 20, content: '# Roadmap\n\nUse tabs  here.\n', lossy: true },
};
