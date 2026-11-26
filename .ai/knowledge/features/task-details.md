---
id: feature-task-details
type: feature
status: active
domains: []
paths:
  - server/board/columns.ts
  - server/source/local.ts
  - server/http/app.ts
  - server/jig/client.ts
  - web/views/TaskView.vue
  - web/components/TaskFacts.vue
  - web/lib/queue.ts
  - web/components/TaskDocuments.vue
  - web/lib/artifacts.ts
  - web/lib/markdown.ts
  - web/components/GateApproval.vue
  - web/components/TaskWrites.vue
  - web/components/DependsEditor.vue
  - web/lib/writes.ts
summary: What a task's page shows from Jig's task row and queue, its documents, and the writes it runs (approve or answer at the gate); why only offered actions reach the page and a document is shown as written
reviewed_at: 2026-11-25
---
# Task details

## What

A board card's goal and a List row link to the task's page, `/projects/<id>/tasks/<task>` (`web/views/TaskView.vue`),
which is where the facts are: a card no longer expands and the List has no side pane
(adr-20261125-the-page-opens-tasks-and-questions-over-the-board). The page is two thirds the task — id with a copy
button, spec, goal, status line, gate, what needs the person, documents — and one third what is known of it: the writes
Jig offers (running some of them itself, below), the facts (`web/components/TaskFacts.vue`),
**Ask your agent** (`web/lib/agent-prompts.ts`, `web/components/AgentPrompts.vue`) and a timeline from the times Jig keeps (`web/lib/timeline.ts`, with what needs the person).
It is served by
`GET /api/projects/:id/tasks/:task` from `ProjectSource.task`: the task's row from Jig's task list
in full — column (the board's rule), status, class, branch and base, worktree's uncommitted count,
knowledge decision, dates, gate, autopilot run with its stage and stop question, pull request with
CI — on the staging flow the pull request into staging apart from the promotion, each with its state, CI, link and
when Jig's housekeeping heard it (`pullRequests` in `web/lib/waits.ts`, tasks `staging-task-details-pr`,
`review-staging-columns`, `staging-nits`) —, housekeeping flags — the attention items that name it, an item about its pull request in the forge cache's words
(adr-20261119-a-person-merges-a-tasks-pull-request-and-asks-where-it-stands-from-the-card), the actions Jig offers, and from `jig queue list` its priority, its place and what it waits for. Its place is
counted among the live tasks and open epics of its level (`server/source/local.ts`): Jig keeps a
finished task or epic in its queue until `jig queue remove`, and counting it would put a task
behind work that is done. What it waits for is its own `depends_on`, then its epic's, each as
declared — met or not, since Jig's queue does not say. It re-fetches on a change of its project,
like the board.

The full page also lists the task's **documents** (`web/components/TaskDocuments.vue`): the ones
Jig reports there — written, empty, or not readable with Jig's word for why — in Jig's order,
from `GET /api/projects/:id/tasks/:task/artifacts`; a click opens one in the page's document dialog
(`web/components/DocumentDialog.vue`), one at a time, read from `…/artifacts/:kind` and rendered from
its Markdown (`web/lib/markdown.ts`). Both are read through Jig at each call, not held with the
board's read; on a change of the project the list and the open document are read again, a failed
reread keeping the document shown.
The full page **runs a person's writes** where Jig offers them
(adr-20261118-a-person-writes-on-a-task-from-its-page): a design at its gate is shown as written with a field for an answer, **Approve the design** and **Send the
answer** under it (`web/components/GateApproval.vue`, `answer-gate` — `jig task gate <id> answered
--answer <line>`: one line without a tab, at most 2000 characters, refused `stale-revision` after a rewrite;
adr-20261125-a-person-answers-a-design-at-its-gate-from-the-page), **Abandon…** with its reason and **Archive** sit in the page's writes (`web/components/TaskWrites.vue`), and "Waits for" takes a dependency away or adds one
(`web/components/DependsEditor.vue`). No other offered action is listed as a command: what has no button is asked of the agent in words (**Ask your
agent**), `start` included, and an answer or approval waits in the task's state until an agent resumes it — the gate's
panel says so. A refusal of any of these writes is a toast (adr-20261126-every-press-reports-in-a-toast). Each write carries the revision of the read it was made on — the approval, the oldest
of the design documents' reads — and the page reads the task again after it, or goes back to the board once the task
is no longer live.

## Why

A card answers "where does it stand"; the page answers "what is it waiting for, and what do I
do". The fields a person orders work by — priority, place, dependencies — sit first (a
maintainer's colleague, task `card-fields-and-artifacts`); the actions left the card, where a command to copy was noise, for the page. The actions come from Jig's own table (Jig's adr-20261015-one-table-of-what-a-person-may-do),
so the page never decides what is allowed.

## Constraints

- **Only offered actions reach the page, without a reason.** An action's `reason` is Jig's refusal
  text word for word and can name a checkout or worktree path; no path reaches `web/` (RULES.md).
  For the same reason the worktree is only its `uncommitted` count — JigClient drops the path.
- **Jig UI runs only the writes of its ADR**, and only where Jig offers them: an
  approval, an answer at the gate, an abandon, an archive and the task's dependencies. Every other action is asked of the
  agent in words, and starting a task is the agent's work, never the page's.
- **A document is shown as written**, a path in it included — the one other place a path reaches
  the page besides Find projects (adr-20261030-a-task-document-is-shown-as-written). What Jig UI
  adds about it names none: its kind, time, size, and Jig's fixed word for one it cannot read.
- **Rendered, then cleaned:** `marked` turns the Markdown into HTML and DOMPurify takes out what
  could run or post (scripts, handlers, frames, forms) before `v-html`; never `v-html` anything else.
  Raw HTML in a document shows as written, so a template's `<id>` stays visible, and a relative link
  shows as its text, since it would lead to the page's own address (adr-20261109-knowledge-text-and-drop-from-jig-0-41). `prose`
  in `web/lib/markdown.ts` styles what `rendered()` gives, for every view that shows a document.
- Documents come from Jig, never from the workspace's files: Jig knows where a worktree task's
  workspace is (adr-20261014-jig-ui-is-an-optional-layer-over-jig; fapost-lab/jig#347 added the
  JSON). They are read for a live task only, and not while the project upgrades.
- Details cost no extra Jig run: the local adapter keeps one detail per live task in the same read
  as the board's rows (feature-live-updates). A finished task has none; its link says so.
- **No strip of the route's stages** on the page: Jig names a route only in words (`jig task route`), and a copy of its
  table would contradict a lean route (adr-20261014-board-columns-are-derived-from-jig-state).
- An action id this Jig UI does not know is ignored in `server/jig/client.ts` (`ACTIONS`), as Jig's contract
  asks of a consumer; the page names the ones it knows.
- Strict validation: the whole task row is checked (convention-jig-client), so a Jig that changes
  an action's or the autopilot's shape makes the project `incompatible`, not half-read.

## Decisions and rejected alternatives

- A detail read beside the board's light rows — rejected: one fat card type, which would put ten
  actions per task into every board response ("light rows for lists, the detail on demand",
  `.ai/specs/jig-ui/architecture.md`).
- A `server/task/` module — rejected: it would hold nothing; the route adds the column from
  `board/placeOf` and reads the port (proposed adr-20261017-live-stream-is-a-route-over-the-port).
- Showing refused actions with Jig's reason — rejected for the path rule above.
- Documents as plain text — proposed, and set aside by the maintainer at task `task-artifacts`'s
  gate: a document read raw. Native `<details>` for each document — the Reka `Collapsible` instead,
  as convention-vue asks of a disclosure; the Collapsible in turn gave way to the dialog at task
  `documents-in-a-dialog` (2026-11-25), the maintainer asking that every document on the page open in
  one (adr-20261125-a-specs-documents-are-shown-as-written).
