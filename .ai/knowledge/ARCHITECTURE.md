# Architecture

High-level map of the system. Describe engineering intent, not implementation:
what the domains are, where the boundaries lie, which direction dependencies may point,
and which constraints and invariants hold system-wide. Anything the code already says
does not belong here.

Jig UI is an optional local control center for Jig projects: one page in the browser shows every
task and epic of every connected project, and later lets a person order, prioritise and file
them. It is for people with a terminal: a developer starts it with their own Node.js, anyone else with
one line that brings its own (the install flow). Jig works exactly as before without it
(adr-20261014-jig-ui-is-an-optional-layer-over-jig).

## Built

- `server/cli.ts` — the `jig-ui` command. It imports nothing but the Node version check, so an
  old Node prints the requirement instead of a stack trace, then loads `server/main.ts`, which
  dispatches the commands parsed in `args.ts`: none (the start flow below), `serve`, and `start`,
  `stop`, `status`, `open`, `reset-token` — and `team-server`, handed to `server/team/` before the
  config directory is read.
- `server/service.ts` — the background instance: `start` runs the CLI itself as `serve` (the
  server with no browser and no folder) detached, output in `server.log`, and waits for it to
  answer, after which `main.ts` opens the browser on it unless `--no-open`; `stop` asks the instance over HTTP; `status` and `open` read and probe. A probe tells
  `up`, `gone` (refused, or another's answer: a stale file) and `silent` (maybe busy: touched by
  nothing). Its system calls are injected, so tests start and signal no process.
- `server/http/` — the Hono app on 127.0.0.1: security headers, then the access guard in
  `access.ts` (local-only `Host`/`Origin`, then the token swapped for a cookie;
  convention-access-guard) before every route, `GET /api/instance`, `POST /api/instance/stop` (the same shutdown as SIGTERM, after its 202), and the built page from
  `dist/web` — also at the router's paths (`/projects/<id>`, `/projects/<id>/tasks/<task>`, `/canvas`), after the guard
  as `/` is, and 503 while a build has emptied it, never a missing asset (adr-20261125-the-page-opens-tasks-and-questions-over-the-board). The API's routes are chained in `apiRoutes()`, whose type `AppType` the page takes
  (adr-20261018-page-takes-api-types-through-hono-rpc). A route's refusal is
  `{ error: { code, message } }`, and so is what `onError` answers: Hono's own (a body that is no
  JSON) as `usage` with its status, anything unforeseen as `internal` with 500 and its message only
  in the terminal, since it may name a path. The guard's 403 (text) and 401, and an unknown `/api/*`
  path's 404, keep forms of their own.
- `server/registry/` — the config directory and the single instance: `token`, the access token
  kept across starts (`token.ts`; adr-20261029-the-token-outlives-a-start); `instance.json` (port,
  token) written atomically, probed by a second start, removed with `open.html` on stop; and the
  registry, `projects.json`, of connected projects by id and main-checkout path
  (adr-20261017-registry-of-connected-projects). It knows neither git nor Jig.
- `server/jig/` — JigClient: the project's Jig version against `MIN_JIG_VERSION`, this machine's own Jig and the
  newest released by `jig version --json` of the `jig` on PATH, run outside any project (`readMachineJig`, Jig 0.46.0,
  adr-20261118-the-header-shows-the-machines-jig), the JSON
  reads `jig status` (what needs the person), `jig task list`, `jig queue list` and `jig spec list`
  (feature-specs), a task's documents `jig task artifacts` and `jig task artifact read` (from Jig 0.39.0,
  adr-20261030-a-task-document-is-shown-as-written), and the writes `jig queue move`, `jig queue set --priority`, `jig queue request`
  and `cancel` (a pause), `jig task pause` (a task nobody started, from Jig 0.45.0), `jig task new` and `jig task resume` (from Jig 0.35.0), `jig task set <id>
  status consolidated` (a close: from Jig 0.40.0 with `--revision --json`, Jig checking it; before
  that text, checked against a revision read first), a project's settings
  `jig config keys` and the person's own `jig config set|unset --local` (from Jig 0.40.0, feature-settings), a roadmap's
  edits `jig spec item add|move|file` (from Jig 0.40.0, adr-20261106-editing-a-roadmap-from-the-page; `file --new` from
  Jig 0.41.0, adr-20261110-filing-an-items-task-in-one-write-from-jig-0-41), the
  knowledge waiting for a decision `jig knowledge proposed`, `jig knowledge sources` and its `--diff`, and the decisions
  `jig knowledge accept|reject|reviewed` (from Jig 0.40.0, feature-knowledge) and several in one write `jig knowledge
  decide` (from Jig 0.44.0, adr-20261114-knowledge-decisions-are-queued-on-the-page), a proposed document's text
  `jig knowledge read` (from Jig 0.41.0, adr-20261109-knowledge-text-and-drop-from-jig-0-41), `jig refresh` (from Jig
  0.45.0, adr-20261113-refresh-brings-the-clone-up-from-the-card), `jig staging ack` (from Jig 0.46.0,
  adr-20261118-mark-as-known-carries-the-count-the-person-saw), a person's writes on a task `jig task gate
  approved|answered` (the answer from Jig 0.48.0, adr-20261125-a-person-answers-a-design-at-its-gate-from-the-page), `jig task abandon`, `jig task archive|unarchive`, `jig spec drop` and `jig queue depend|undepend` (from
  Jig 0.46.0, adr-20261118-a-person-writes-on-a-task-from-its-page), a person's steps on the staging flow `jig task
  land`, `jig task promote` and `jig task request-review`, with `jig pr reviewers` (from Jig 0.46.0,
  adr-20261119-a-person-lands-asks-review-and-prepares-for-prod-from-the-card), a person's merge `jig task merge-pr`
  and the forge read `jig task pr-status` (from Jig 0.46.0, adr-20261119-a-person-merges-a-tasks-pull-request-and-asks-where-it-stands-from-the-card), and
  `jig upgrade`, its dry run and its run (from Jig 0.34.0), and `jig self-update` (its text line), `housekeepingSummary` (in `client.ts`, a few words on what Housekeeping changed, read from Jig's report so the page never reads it; adr-20261125-the-page-opens-tasks-and-questions-over-the-board), each JSON answer checked by a zod schema (adr-20261018-jig-answers-checked-by-zod-schemas) and tested against
  fixtures in `server/jig/fixtures/` — Jig 0.29.0 for the reads it had, 0.31.0 for the queue,
  0.39.0 for a task's documents, 0.40.0 for the settings, a roadmap's edits and the knowledge, 0.41.0 for the
  knowledge's text, Drop and judged reads and for filing an item's new task in one write, 0.45.0 for a task
  list on the staging flow, `jig refresh` and the clone against origin, 0.46.0 for a staging task's review and
  promotion, for a person's writes on a task, for a person's steps on staging and for a merge from the card
  (convention-jig-client).
- `server/source/` — the ProjectSource port (`project-source.ts`: the workspace, the connected ids
  (`connected`), one project as the workspace shows it (`project`), the Jig projects under a folder (`scan`, walked
  by `scan.ts`), a project's live tasks, its finished tasks on demand (`finished`), one task in full, a live task's documents (`artifacts`, `artifact`), the settings (`settings`), the knowledge waiting for a decision (`knowledge`, `knowledgeDiff`, `knowledgeText`), connect, disconnect, subscribe to changes, and the writes `move`,
  `prioritise`, `moveEpic`, `prioritiseEpic`, `requestPause`, `cancelPause`, `pause`, `resume`, `close` and `fileTask`, a person's writes on a task `act`, `depend` and `undepend`, a person's steps on staging `landOnStaging`, `promote` and `requestReview`, with the forge's `reviewers`, a person's merge `merge`, with the forge's `prStatus`, `housekeeping`, `refresh` and `ackStaging`, `setSetting` and `unsetSetting`, `addItem`, `moveItem` and `fileItem`, `decideKnowledge`, `planUpgrade`, `upgrade` and
  `dismissUpgrade`, `land` and `landAll`, and the machine's runs `machine`, `selfUpdate`, `upgradeAll` and `dismissUpgradeAll`, and the machine's Jig
  `machineJig`, read from the `jig` on PATH outside any project, adr-20261118-the-header-shows-the-machines-jig) and its local adapter (`local.ts`), which holds the
  registry, runs Jig and, while someone subscribes, follows each project through a Watcher (feature-live-updates). A
  project is `ready` (task counts and attention items), `unsupported` (Jig below the minimum, not
  read), `incompatible` (a newer Jig's shape), `unreadable` (Jig refused, or `timeout`; its code only — **Read again** reads it at once, as **↻** on the project's
page and above the projects does any time) or
  `unavailable` (convention-project-source).
- `server/watch/` — Watcher: one recursive `fs.watch` per directory, debounced into "something
  changed", knowing nothing of Jig (convention-watcher).
- `server/board/` — a project's board: columns worked out from its tasks, and the project's flow its read gives, on
  every read (feature-board).
- `server/http/` also serves `GET /api/workspace`, `GET /api/projects` (the connected ids, no Jig run) and
  `GET /api/projects/:id` (one project as the workspace shows it) for the workspace's first load (feature-workspace),
  `POST /api/scan` (Find projects, adr-20261029-finding-projects-shows-their-paths),
  `GET /api/projects/:id/board`, `GET /api/projects/:id/finished` (feature-board),
  `GET /api/projects/:id/tasks/:task` (feature-task-details), `GET /api/projects/:id/tasks/:task/artifacts` and
  `/artifacts/:kind` (a task's documents, adr-20261030-a-task-document-is-shown-as-written), `GET /api/projects/:id/specs`
  (feature-specs), `POST /api/projects/:id/queue/move`, `/queue/priority`, `/queue/epic/move`, `/queue/epic/priority`, `/queue/pause`,
  `/queue/pause/cancel`, `/tasks/pause` (adr-20261113-a-task-nobody-started-is-paused-at-once), `/tasks/resume` (adr-20261022-writes-carry-the-revision-of-their-read) and
  `/tasks/close` (adr-20261029-close-a-ready-task-from-the-board), `/tasks/act`, `/queue/depend` and `/queue/undepend`
  (adr-20261118-a-person-writes-on-a-task-from-its-page), `/tasks/land`, `/tasks/promote` and `/tasks/request-review`,
  with `GET /api/projects/:id/reviewers` (adr-20261119-a-person-lands-asks-review-and-prepares-for-prod-from-the-card),
  `/tasks/merge`, with `GET /api/projects/:id/tasks/:task/pr-status` (adr-20261119-a-person-merges-a-tasks-pull-request-and-asks-where-it-stands-from-the-card),
  `POST /api/projects/:id/tasks` (adr-20261022-filing-a-task-carries-no-revision),
  `POST /api/projects/:id/housekeeping` (adr-20261110-housekeeping-runs-from-the-project-card),
  `POST /api/projects/:id/refresh` (adr-20261113-refresh-brings-the-clone-up-from-the-card),
  `POST /api/projects/:id/staging/ack` (adr-20261118-mark-as-known-carries-the-count-the-person-saw),
  `POST /api/projects/:id/specs/items/add`, `/move` and `/file` (adr-20261106-editing-a-roadmap-from-the-page),
  `GET` and `POST /api/projects/:id/settings` and `POST /api/projects/:id/settings/unset` (feature-settings),
  `GET /api/projects/:id/knowledge`, `/knowledge/:doc/diff`, `/knowledge/:doc/text` and
  `POST /api/projects/:id/knowledge/decide` (adr-20261106-knowledge-decisions-from-the-page, adr-20261109-knowledge-text-and-drop-from-jig-0-41),
  `POST /api/projects/:id/upgrade/plan`, `POST` and `DELETE /api/projects/:id/upgrade`
  (adr-20261027-upgrading-a-project-runs-in-the-background), `POST /api/self-update`, `POST` and
  `DELETE /api/upgrade-all` (adr-20261029-upgrade-all-and-self-update-from-the-page), `POST /api/projects/:id/upgrade/land` and `POST /api/upgrade/land-all` (adr-20261029-check-merge-lands-an-upgrade-through-jig), connect /
  disconnect under `/api/projects`, and `GET /api/events` — the SSE stream of "project X changed,
  revision R" — through the port only; responses name projects by id, and only Find projects' answer names
  folders, by path; a task's documents and the knowledge name the project's files relative to it
  (adr-20261030-a-task-document-is-shown-as-written, adr-20261106-knowledge-decisions-from-the-page,
  adr-20261109-knowledge-text-and-drop-from-jig-0-41).
  Directions: `http/` → `board/`, `source/`; `board/` → `source/` (types); `source/` → `jig/`,
  `registry/`, `watch/`.
- `server/release.ts` — whether a newer Jig UI is out on the build's channel, asked of npm's
  registry at most once a day by the running instance and answered on `GET /api/instance/newer`, with
  the stop command for how Jig UI was started; the page's header says it in one line
  (adr-20261031-jig-ui-asks-npm-for-a-newer-release). `main.ts` gives it to `createApp`; `http/`
  knows only its type. Beside it `GET /api/instance/jig` answers this machine's Jig and the newest Jig released, the
  port's `machineJig`, which the header shows with **Update…** (adr-20261118-the-header-shows-the-machines-jig).
- `server/open-browser.ts` — opens the browser through `open.html` in the config directory, so
  the token is never a process argument (adr-20261017-browser-opens-through-a-redirect-file).
- `web/` — the Vue 3 page, built from shadcn-vue components on Tailwind (adr-20261018-page-built-from-shadcn-vue-with-router-and-canvas,
  convention-vue). `router.ts` — vue-router in history mode (adr-20261125-the-page-opens-tasks-and-questions-over-the-board; a link from before, `#/projects/<id>`, becomes its path when the page loads): `/` the workspace, `/projects/<id>`
  a board — its query the board's sort and filters (`sort`, `class`, `priority`, `q`), `spec`, the spec the Specs view shows, and `view`, a view to open
  (`knowledge`, the workspace card's link, dropped from the address once shown), `/projects/<id>/tasks/<task>` a task's page, `/canvas` every component in every
  state (loaded lazily, linked from nowhere), anything else `/`. `App.vue` — the header's
  project dropdown and the theme switch over the current view. `views/` — one per address (and the canvas's
  helpers), the only callers of `call()`, `client` and `onChange()` besides `App.vue`; `components/` — Jig UI's own, props in and events out — among them `TaskNote` (a card's status line), `PullChip`
  (a pull request and its CI), `ReadingLine`, `AgentPrompts` (Ask your agent), `FinishedRows` and `PrStatusBody` (the
  bodies of the finished-tasks and pull-request-status dialogs);
  `components/ui/` — shadcn-vue's, knowing nothing of Jig, `sonner`'s `Toaster` (vue-sonner) among them; `lib/` — what a card says
  (`pull.ts`: a card's pull request chip; `agent-prompts.ts`: what to ask the agent by where a task stands; `timeline.ts`: a task page's timeline and what needs
  the person), the colours
  that mean something, the theme, `inline.ts` (`INLINE_DIALOGS`, which the canvas provides so a dialog draws in place) and `lastWins` (a read that lands only if no later one started).
  `api.ts` — the typed `client` (Hono's `hc` over `AppType`), the response types derived from it,
  `call()` with the failures every view shares, the change stream each view re-reads on, and the reads and runs more
  than one view makes (`readTask`, `readAgain`, `runRefresh`, `runHousekeeping`), the last two handing the answer to
  `refreshOf` and `housekeepingOf` in `lib/`, which turn it into the page's state. Vite builds it into `dist/web` and the package ships it built. One TypeScript
  checks both sides (adr-20261017-one-typescript-for-server-and-web).
  Directions: `views/` → `components/` → `components/ui/`; `lib/` from any of them and from `api.ts`, which `lib/`
  imports types from only; `api.ts` → `server/http/` for types only — lint refuses a value import from `server/`.
- `server/team/` — the team server, `jig-ui team-server`: one Jig UI for a team, on a server of
  theirs, where people sign in with GitHub and see the repositories they may write to
  (adr-20261117-a-team-server-keeps-a-reflection-of-its-own,
  adr-20261117-the-team-server-signs-people-in-through-its-own-public-github-app). `config.ts` reads
  `JIG_UI_PUBLIC_URL`, `JIG_UI_DATA` and `JIG_UI_HOST`; `db.ts` is `TeamStore`, `team.db` through
  `node:sqlite`; `github.ts` is the only code that talks to GitHub — the App's JWT, installation
  tokens, OAuth, the REST reads, each answer checked by a zod schema; `auth.ts` keeps what lives in
  memory only (the setup code, setups, OAuth rounds) and sessions by hash; `access.ts` is the guard
  (convention-access-guard); `poll.ts` reads approved installations again every five minutes;
  `app.ts` is `createTeamApp` and the routes, typed as `TeamAppType`; `main.ts` starts it. It
  imports nothing of `server/` outside it, and nothing outside it but `server/main.ts` imports it
  (lint). Its page is the second Vite entry, `web/team.html` with `web/team/` (`TeamApp.vue`, the
  admin's `AdminPanel.vue`, `api.ts` over `TeamAppType`), built from the same components and `lib/`.
  The `Dockerfile` builds the package from source and runs `team-server` as `node`, its data on the
  `/data` volume.
- **Start flow.** `npx @fapost/jig-ui` checks Node 24+, finds a running instance through the
  config directory and checks it answers with its token — then opens it and exits — or starts one
  on 127.0.0.1 with the kept token and opens the browser on a link carrying it
  (adr-20261014-local-server-access-guard, adr-20261029-the-token-outlives-a-start). Two starts at once: the one that loses the port opens
  the winner. Run in a git checkout, the command then asks the instance that serves — its own or
  the running one — to connect the folder (`POST /api/projects` with the token, so only that
  instance writes the registry), a worktree standing for its clone's main checkout, and opens the
  board at `/projects/<id>`; outside a Jig project it says nothing.
- **Read and follow.** The page opens its change stream and reads once it is open; while it is
  open a change under a project's `.ai/`, debounced, or the minute's rescan makes the local adapter
  re-read through Jig, and only a read that differs — or a project newly connected — sends
  "project X changed, revision R"; the page re-reads, served from that read (feature-live-updates) — all but a task's documents,
  which that read does not hold: they are read through Jig when the page asks
  (adr-20261030-a-task-document-is-shown-as-written).
- **Change.** The page sends a write with the revision of the board it showed; ProjectSource
  runs the matching Jig command for live task ids only — a finished task's write, for an id the last read of the
  finished list showed (adr-20261118-a-person-writes-on-a-task-from-its-page) — and answers after reading the project
  again; Jig's `stale-revision` comes back as 409, and the page reads the board again and shows
  the conflict: what changed between the board the write was made on and that read, its cards
  marked (adr-20261022-writes-carry-the-revision-of-their-read, feature-board). Built for the
  queue: order, priority and pause requests; for a pause of a task nobody started (adr-20261113-a-task-nobody-started-is-paused-at-once); and for a resume
  (adr-20261026-a-drop-out-of-paused-resumes-at-once), a parked task's taken back for a fix included
  (adr-20261113-a-task-parked-at-staging-is-not-done); and for closing a ready task as done, after the
  person confirms, its refusal shown in Jig's words (adr-20261029-close-a-ready-task-from-the-board) — from the
  board, and from a merged task's item on the project's card, with the revision the workspace read carries for it
  (feature-workspace), where a stale revision is said as the project having changed; and, from Jig 0.46.0, for a
  person's writes on a task's page — approving its design with the revision its documents were read at, abandoning,
  archiving, what it waits for — and on the finished list's rows, with that list's revision
  (adr-20261118-a-person-writes-on-a-task-from-its-page); and, on the staging flow, for landing a task on staging,
  asking for its review and preparing it for prod from its card's menu — landing also by a drop on On staging —, each
  asking the forge as Jig writes
  (adr-20261119-a-person-lands-asks-review-and-prepares-for-prod-from-the-card). Filing a task is a write with no revision: it
  names a new id, which Jig claims or refuses `already-exists`
  (adr-20261022-filing-a-task-carries-no-revision); housekeeping is another, a sweep of the clone as it is, under
  Jig's own lock (adr-20261110-housekeeping-runs-from-the-project-card), and a refresh the third, a fetch and a
  fast-forward of the base that touch nothing the person decided (adr-20261113-refresh-brings-the-clone-up-from-the-card). A roadmap's edits are writes like the queue's,
  with the specs' revision, committed by Jig on the spec's branch; from Jig 0.41.0 filing an item's
  new task is one of them too (adr-20261110-filing-an-items-task-in-one-write-from-jig-0-41), and on Jig 0.40.0 it is that filing and then naming it on the
  item, with a revision the adapter reads between the two
  (adr-20261106-editing-a-roadmap-from-the-page). A knowledge decision is a write like those, with the
knowledge's revision, committed by Jig on `knowledge/decisions` and checked against a knowledge read made
just before it (adr-20261106-knowledge-decisions-from-the-page). Upgrading a project's Jig is the one write that
  outlives its request: after a dry run, `jig upgrade` runs in the server's background, its state in
  the adapter's memory and on the workspace read, and no other Jig runs in the project meanwhile
  (adr-20261027-upgrading-a-project-runs-in-the-background). Upgrade all runs those upgrades one at
  a time, after `jig self-update` when a release is out; a self-update only after the person confirms
  it (adr-20261029-upgrade-all-and-self-update-from-the-page).
- **Install flow.** `install.sh`, fetched by one line from the latest GitHub Release, uses a
  Node.js 24 or later already on PATH; otherwise it puts the official Node.js 24 from nodejs.org,
  its SHA-256 sum checked and the binary run once, in Jig UI's own data folder. Then it writes a
  `jig-ui` command that runs `npx @fapost/jig-ui` with that Node.js, so the package updates as it
  does for npx and running the line again updates Node.js. It runs from a terminal, Git Bash on
  Windows; what it may write is a rule in `RULES.md`.
- **Release flow.** A merge to `main` runs the CI matrix and builds `dist/` in a job without
  credentials. A merge that changes `version` in `package.json` to a stable one releases
  it: publishes it under `latest`, runs `install.sh` on each OS against it, and then
  creates the GitHub Release that carries `install.sh`, which creates the tag on the merge commit.
  Any other merge publishes `<next patch>-next.<run>` under `next`, which sorts after the latest
  release. A `v*` tag pushed by hand on a commit of `main` still releases its version; a version
  already on npm is not published again, so a failed release run is re-run. Details in `RELEASING.md`.

## Intended — not built yet

Everything below is decided (spec `jig-ui`) and not built. The task that builds a part moves it
out of this heading.

### Domains

One npm package with a server and a page
(adr-20261014-project-source-port-keeps-hosting-open):

- `server/http/` — the Hono app, the access guard and the built page; the only server module that
  knows Hono, but for `main.ts` serving it (`@hono/node-server`) and the team server's own app in
  `server/team/` (adr-20261117-a-team-server-keeps-a-reflection-of-its-own); the page knows
  `hono/client`.

### Boundaries and dependency direction

- `board/` depends on `source/`; only `source/` depends on `jig/` and `watch/`.
- `http/` depends on the area modules; nothing depends on `http/` but the page's types.
- `web/` depends on the HTTP API only; shared types are the only code it shares with `server/`.

### Runtime flows

The start flow, read-and-follow and change, with its conflict display, are built (see Built above).

### System-wide constraints and invariants

- Jig's files are the source of truth; Jig UI keeps only its registry and interface settings. The
  team server keeps a reflection of its own, never the truth
  (adr-20261117-a-team-server-keeps-a-reflection-of-its-own).
- Board columns are derived, never stored; a drop on another column is a sticky request
  (adr-20261014-board-columns-are-derived-from-jig-state), except a drop out of Paused, which
  resumes the task at once (adr-20261026-a-drop-out-of-paused-resumes-at-once), and a drop of a task
  parked at a staging branch on the column it resumes to, which takes it back for a fix
  (adr-20261113-a-task-parked-at-staging-is-not-done), a drop on Paused of a task nobody started,
  which pauses it at once (adr-20261113-a-task-nobody-started-is-paused-at-once), and a drop of a
  Review card on On staging where Jig offers `land`, which lands it at once
  (adr-20261119-a-person-lands-asks-review-and-prepares-for-prod-from-the-card, task `drop-to-land`).
- A hosted or self-hosted Jig UI stays possible: projects by id, access behind a replaceable
  guard, writes carrying a revision (adr-20261014-project-source-port-keeps-hosting-open) — all but
  the upgrade (adr-20261027-upgrading-a-project-runs-in-the-background), filing a task
  (adr-20261022-filing-a-task-carries-no-revision), housekeeping
  (adr-20261110-housekeeping-runs-from-the-project-card) and, on Jig 0.40.0, the
  naming of an item's new task, which carries the revision read after its filing
  (adr-20261106-editing-a-roadmap-from-the-page; from Jig 0.41.0 one write with the person's
  revision, adr-20261110-filing-an-items-task-in-one-write-from-jig-0-41).
- Stack: adr-20261014-stack-vue-hono-sse-on-node.
