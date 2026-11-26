---
id: adr-20261119-a-person-merges-a-tasks-pull-request-and-asks-where-it-stands-from-the-card
type: adr
status: accepted
date: 2026-11-19
domains: []
paths:
  - server/jig/client.ts
  - server/source/local.ts
  - server/source/project-source.ts
  - server/http/app.ts
  - web/components/QueueMenu.vue
  - web/components/PrStatus.vue
  - web/components/AttentionItem.vue
  - web/components/ProjectCard.vue
  - web/components/WriteConfirm.vue
  - web/lib/pr-status.ts
  - web/lib/refusal.ts
  - web/views/BoardView.vue
  - web/views/WorkspaceView.vue
summary: With Jig 0.46.0 a card's menu merges its pull request after a question, Jig closing the task with it, and Status… reads where it stands from the forge on a press; the project card's pull-request items speak in words, say who merges, and carry Merge, Land and Status where Jig offers them
---
# A person merges a task's pull request and asks where it stands from the card

## Context

Off the staging flow, a task's pull request into its base was the person's to merge on the forge, or the agent's when
its `jig task ship` waits for CI at `agent.git: merge`. The board offered only **Close as done (✕)**, which Jig refuses
while the pull request is open, and the project's card showed Jig's items `pull-request-waiting` and
`pull-request-was-open` as Jig's raw lines, a `jig task merge-pr` command among them. Why a merge was held back —
which check failed, for how long one has been running, whom the review waits for — was on the forge only.

Jig 0.46.0 (`schemas/json.md`) gives a person both: `jig task merge-pr <id> --by human --revision <n> --json`, which
reads the forge once — merged, closed, draft, conflict, mergeable, review, CI once without waiting, release notes —,
claims the revision, merges at the head it read without `--admin`, and closes the task in the same write once its
knowledge decision is recorded (`close_blocked` says why not); and `jig task pr-status <id> --json`, a live forge read
"when a person presses, never on a timer", which writes nothing. `jig task list --json` offers the actions `merge`
(held back while the forge cache says CI red or pending or a conflict, while an autopilot run or the agent's ship is
on) and `pr-status`, and a task's `shipping: {since}` while its ship waits for CI to merge it itself. `jig status
--json` gives the two pull-request items the forge cache's `pull_request {state, url, ci, mergeable, review,
fetched_at}` and the item's `actions`. Spec `jig-ui`, Phase 4, roadmap item "merge from the card"; task
`merge-from-card`, design approved at the gate on 2026-11-19.

## Decision

- **Merge… first in the card's ⋯ menu**, on Board and List alike, where the project's Jig is `WRITES_JIG_VERSION`
  (0.46.0) or later and Jig offers `merge` (the card's `mergeable`). **It asks first** (`WriteConfirm`, `write:
  'merge'`): a merge into the main branch is taken back only by a revert, the argument that made Prepare for prod ask
  (adr-20261119-a-person-lands-asks-review-and-prepares-for-prod-from-the-card).
- **A card that offers Merge has no ✕** (`closable` in `server/source/local.ts`): Jig's merge closes the task, and a
  second way to close it beside it would only be refused. This amends adr-20261029-close-a-ready-task-from-the-board:
  its ✕ for a recorded knowledge decision and a pull request not known to have closed is withdrawn where Jig offers
  `merge`.
- **Status… where the card can be neither merged nor landed** and Jig offers `pr-status` (the card's `statusable`, a
  condition the page adds to Jig's offer, as `pausable` is): a
  panel on the card (`web/components/PrStatus.vue`), as the review request is, that reads `jig task pr-status` only
  when opened — each check with what came of it and how long it ran or runs, a link to the one that failed, whom the
  review waits for, what the base branch's rules ask, and what holds the merge back in one line. The words are
  `web/lib/pr-status.ts`'s, tested, not the template's.
- **The line above the board after a merge** says whether the task closed with it, or what the close waits for (its
  knowledge decision; its work reaching the base), linking the pull request. A refusal is said by code
  (`mergeRefusal` in `web/lib/refusal.ts`), Jig's words for whom the review waits for and where only Jig knows why;
  beside one that leaves the pull request open, and where Status… can say more than the refusal, **Status…**.
- **Items about a task's pull request speak in words** on the project's card and the task's page (`AttentionItem.vue`):
  the cache's CI, whether it merges, the review and how long ago, and for `was-open` that it is the last housekeeping
  run's word; an item the cache has no entry for keeps Jig's own lines. Off the staging flow the project's card says
  **who merges** it: the agent, while the task is `shipping`; nobody, at the person's `agent.git: merge` without one
  (the ship stopped before the merge); else the person. That is Jig's rule copied into the page: if Jig changes who
  merges, the line is wrong until the page follows. `agent.git` is read (`config keys`) only in a project read off the
  staging flow that has such an item.
- **Merge…, Land on staging and Status… on those items** of the project's card, from the item's `actions` — the same
  writes as the card's, with the revision of the read the card shows; what Jig did, or its refusal in words, stays on
  the card until dismissed. A landing refused `not-approved` points to the Board, where **Land without review** is: no
  second landing without review away from the board. The task's page shows the words without the buttons.
- **The adapter runs only what its last read offered** (adr-20261022-writes-carry-the-revision-of-their-read):
  `merge(id, taskId, revision)` through `writing()` with `(t) => t.mergeable`, else `not-found` without Jig;
  `prStatus(id, taskId)` through `onDemand` only for a live task whose last read offered `pr-status`, its
  `forge-unavailable` and `no-pull-request` coming back as refusals with Jig's line. `POST /api/projects/:id/tasks/merge
  {task, revision}` (2 minutes, `STAGING_WRITE_TIMEOUT_MS`) and `GET /api/projects/:id/tasks/:task/pr-status` (60 s,
  `FORGE_READ_TIMEOUT_MS`). An item's withheld action never reaches the page with its reason: only the ids Jig offers.

## Alternatives

- **Merge in one press**, as the roadmap's "one click merges" — Land does so because staging is there to be tried on;
  a merge into main is not, as Prepare for prod is not.
- **A Merge button on the card** — noise on a quiet board (adr-20261110-the-page-speaks-a-quiet-design-language); the
  person's steps are in the menu already.
- **Status… always, beside Merge** — the menu stays short; after a refused merge Status… is beside the line.
- **Status in the board's read, or on a timer** — Jig forbids it: a forge round trip; read only on a press, as the
  reviewers are.
- **How long CI has run, and which checks, on the project's card from the cache** — the cache has only `ci` and when it
  was fetched; the item says the cache's word and "as of", and Status… the rest.
- **`agent.git` on every read** — a Jig run more per read; only when an item needs it.
- **Land without review on the project's card** — a second landing without review away from the board.

## Consequences

- Jig UI now merges pull requests into the main branch as the person. Undone only by a revert on the forge; Jig UI
  keeps nothing.
- Status… is a forge round trip per press, through the person's credentials; nothing is stored.
- A project read off the staging flow with an item about a task's pull request runs one Jig process more
  (`jig config keys --json`).
- Untested on a forge: the answers of `merge-pr` and `pr-status` were written into fixtures from Jig's contract; a
  scratch project with a local bare origin gave only `forge-unavailable`, `no-pull-request` and `wrong-flow`, kept as
  fixtures. The first real use is the forge test.
- Jig 0.46.0 may offer `merge` on a staging-flow task when no ship recorded where its pull request goes (a Review card,
  in a scratch project): the card shows Merge… there, and Jig refuses it (`wrong-flow`, naming the landing, or
  `forge-unavailable` first). Jig UI follows Jig's offer, not the flow.
- Undo: revert the merge; nothing is stored.

*(Amended by task `jig-min-0-48`, 2026-11-26: Jig UI needs Jig 0.48.0, so the 0.46.0 gate on the merge and on Status…
no longer applies: they are offered wherever Jig offers the action.)*
