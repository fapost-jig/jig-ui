---
id: adr-20261120-a-projects-page-has-refresh-housekeeping-and-read-again-beside-its-name
type: adr
status: accepted
date: 2026-11-20
domains: []
paths:
  - web/views/BoardView.vue
  - web/views/WorkspaceView.vue
  - web/components/ChoreReports.vue
  - web/api.ts
summary: Refresh, Housekeeping and Read again sit beside a project's name on its page in every view, guarded by the server's refusals rather than hidden; the workspace's ↻ reads every project again
reviewed_at: 2026-11-20
---
# A project's page has Refresh, Housekeeping and Read again beside its name, and the workspace reads every project again

## Context

Refresh and Housekeeping ran only from a project's card on the workspace page: Housekeeping beside **Board**
(adr-20261110-housekeeping-runs-from-the-project-card), Refresh on Jig's `base-behind-origin` item and beside a fetch
more than a day old (adr-20261113-refresh-brings-the-clone-up-from-the-card), which rejected "a third button in every
card's header". **Read again** showed only where a read had failed. The maintainer, from a screenshot of the project
page's bar (2026-11-20, task `board-bar-actions`): "неплохо сюда продублировать рефреш и хаускипнг. и может маленьку
кнопочку перечитать статус на борде и на главной". Asked where, they chose the header row beside the project's name,
in all four views, and one button on the workspace page for every project.

## Decision

This amends the two ADRs above for the project's page; the card is unchanged.

- **The project page's header**, after the project's name and the finished count, in Board, List, Specs and Knowledge:
  **Refresh** and **Housekeeping** while the board is `ready`, and **↻** (`Read <id> again`) whenever the board was read
  in any state. They are the card's writes — `POST /api/projects/:id/refresh|housekeeping`, no revision, *Refreshing…*
  / *Housekeeping…* while running, the answer under the header until **Dismiss** (`web/components/ChoreReports.vue`, the
  card's own panels moved there) — and the page reads what it shows again afterwards, the knowledge too in its view.
  Refresh still runs only when pressed.
- **Shown regardless of Jig's version and of an upgrade.** The board's read carries neither, so the server is the guard:
  below Jig 0.45.0 Refresh is refused `unsupported` ("needs Jig 0.45.0 or later"), and while the project's upgrade runs
  both are refused `409 upgrading`; the refusal is the line under the header. The card keeps hiding them.
- **↻ above the projects** on the workspace page reads every connected project again at once (`readAgain` each), then
  the workspace; disabled while it reads.
- The state of a run is the view's: `BoardView` holds one of each, `WorkspaceView` one per project. A run is started by
  `runRefresh` / `runHousekeeping` in `web/api.ts`, beside `readAgain`, which turn the answer into the page's state.

## Alternatives

- **The filter row the maintainer pointed at** — it is on Board and List only; Specs and Knowledge would have none.
- **↻ on each project's card** — the maintainer chose one button for every project.
- **Hiding Refresh below Jig 0.45.0 and both during an upgrade, as the card does** — needs the Jig version and the
  upgrade on the board's read, a server change for a refusal the page already says in words.
- **Refresh and Housekeeping for every project at once** — not asked.
- **A composable in `web/lib/` that runs the writes** — convention-vue keeps `call()` and `client` to views and
  `api.ts`.

## Consequences

- A Refresh or Housekeeping run started on the project page is not known to the workspace's card, and the reverse: a
  second Refresh can start beside one under way; a second Housekeeping is answered by Jig's own lock. Leaving the page
  while one runs drops its answer; the run goes on.
- `web/api.ts` now imports from `web/lib/` (the state types, `refreshReport`, `reasonsOf`); `lib/` imports only types
  from `api.ts`, so no module cycle runs.
- Undo: revert the merge; nothing is stored.
- *(Amended by task findings-sweep, 2026-11-20: what `api.ts` imports from `lib/` is now the state types,
  `housekeepingOf` and `refreshOf`, pure functions with tests that turn the answer into the page's state.)*

*(Amended by task `jig-min-0-48`, 2026-11-26: Jig UI needs Jig 0.48.0, so the `unsupported` refusal of Refresh below
Jig 0.45.0 and the alternative of hiding it there no longer apply.)*
