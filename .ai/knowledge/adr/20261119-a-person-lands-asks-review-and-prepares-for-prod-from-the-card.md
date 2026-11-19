---
id: adr-20261119-a-person-lands-asks-review-and-prepares-for-prod-from-the-card
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
  - web/components/ReviewRequest.vue
  - web/components/WriteConfirm.vue
  - web/lib/staging.ts
  - web/lib/refusal.ts
  - web/views/BoardView.vue
summary: On Jig 0.46.0's staging flow a card's menu lands its pull request on staging, Land without review following Jig's not-approved, asks reviewers the forge offers, and prepares it for prod after a question; each where Jig offers it, with the board's revision
reviewed_at: 2026-11-19
---
# A person lands a task on staging, asks for its review and prepares it for prod from its card's menu

## Context

On Jig's staging flow a task's pull request goes into a staging branch, where the task waits parked: for a review, then,
once landed, for "prepare for prod" (adr-20261113-a-task-parked-at-staging-is-not-done,
adr-20261117-on-the-staging-flow-review-and-on-staging-are-columns). The card said whose step was next ("Approved —
yours to land", "On staging, waits for prepare for prod") and offered nothing to take it: adr-20261113 rejected "Land and
Prepare for prod buttons", since Jig 0.45.0 offered `land` only at `agent.git: merge`, and neither `task land` nor `task
promote` answered JSON or took a revision.

Jig 0.46.0 (`schemas/json.md`) gives a person all three steps as writes: `jig task land <id> --by human
[--without-review] --revision <n> --json`, `jig task promote <id> --by human --revision <n> --json` and `jig task
request-review <id> --reviewer <login>… --by human --revision <n> --json`, with `jig pr reviewers --json` naming whom
the forge offers to review a pull request into staging. `jig task list --json` offers `land`, `promote` and
`request-review` as a person's actions (`--by human`, so no git level is read). Jig claims the revision before its first
write to the forge, so `stale-revision` means nothing was sent. Spec `jig-ui`, Phase 4, roadmap item "staging from the
card"; task `staging-from-card`, design approved at the gate on 2026-11-19.

## Decision

- **First in the card's ⋯ menu**, above the moves, on Board and List alike (`web/components/QueueMenu.vue`): **Land on
  staging**, **Request review…** and **Prepare for prod…**, each where the project's Jig is `WRITES_JIG_VERSION`
  (0.46.0) or later and Jig offers the action — the card's `landable`, `reviewRequestable` (only for a task parked for
  `review`, whose pull request into staging is open) and `promotable` (`card()` in `server/source/local.ts`). The card's
  note already says the step is the person's; the menu is where **Take back for a fix** is.
- **Land is one press**, no question. When Jig refuses `not-approved`, the line above the board gives Jig's words —
  whom the review waits for, changes requested, no review — and **Land without review** beside it: the same write with
  `--without-review`, which Jig notes on the pull request. That press, after reading the refusal, is the confirmation.
  Under `git.staging_review: require` Jig says so and the second press is refused `review-required`. A `conflict` is the
  agent's to land: the line says to ask it.
- **Prepare for prod asks first**, on the card, as the close does: the close's question became `WriteConfirm`, one
  component for a write the page cannot take back. Where the project merges promotions itself it reaches the main
  branch with nobody else looking, and undoing it there is a revert on prod. The line above the board links the
  promotion and says who merges it, from Jig's `merge.outcome`, or that the work is in the main branch already.
- **Request review… opens a panel on the card** (`web/components/ReviewRequest.vue`) and only then asks `jig pr
  reviewers --json` — a forge read, never on a timer and never in the board's read: who reviewed here most often first,
  with their count, or everyone the repository may ask, said so. Those the review already waits for are ticked,
  disabled and marked *asked*. **Ask** sends the ones ticked; the line says the card shows their review after the next
  housekeeping run, which the press does not start.
- **The adapter runs only what its last reads offered** (adr-20261022-writes-carry-the-revision-of-their-read): each
  write goes through `writing()` with the card's flag as its predicate, else `not-found` without Jig; a review request
  also only for logins the last reviewers read named, kept in memory on the project's entry (`Entry.reviewers`, nothing
  on disk). The HTTP boundary checks the logins' shape — 1 to 20, `^[A-Za-z0-9][A-Za-z0-9._-]*$`, each once — so no
  flag reaches Jig. The port's method is `landOnStaging`: `land` is the upgrade's (`jig upgrade --land`).
- **Each carries the board's revision** and answers as every write does: `POST /api/projects/:id/tasks/land
  {task, withoutReview, revision}`, `…/tasks/promote {task, revision}`, `…/tasks/request-review {task, reviewers,
  revision}`, and `GET /api/projects/:id/reviewers`; 200 after the re-read, 409 stale, 404, 422 with Jig's reasons.
  Each write has 2 minutes (`STAGING_WRITE_TIMEOUT_MS`): round trips to the forge, and a push for a promotion. An answer
  this Jig UI does not read is `incompatible`, said as "Jig answered in a way Jig UI does not read, and may have done
  it: look at the board again" — the board is read again either way.
- **Refusals by code** (`stagingRefusal` in `web/lib/refusal.ts`): Jig UI's words where the person has a next step
  (`review-required`, `conflict`, `base-conflict` with the paths Jig named, `ci-pending` and `mergeable-unknown` to try
  again, `autopilot-running`, `timeout`, `incompatible`), Jig's own words for `not-approved` and for every other code.
- This takes the alternative adr-20261113-a-task-parked-at-staging-is-not-done rejected ("Land and Prepare for prod
  buttons"), as menu entries rather than buttons.

## Alternatives

- **Buttons on the card** — the step in plain view, but a button on every Review and On staging card is noise on a
  quiet board (adr-20261110-the-page-speaks-a-quiet-design-language); the menu holds **Take back for a fix** already,
  and dragging to land is a task of its own. *(Built by task `drop-to-land`, 2026-11-19: a drop of a Review card on On
  staging is the same landing, at once.)*
- **A question before Land**, as before the close — staging exists to be tried on, and landing without review is
  already a second press after the refusal was read.
- **No Land until the card reads Approved** — the forge cache lags behind the forge; Jig asks the forge as it lands and
  names whom it waits for, which is what the roadmap item asks.
- **Request review on the direct flow too** — Jig offers it there, but `jig pr reviewers` without `--base` reads the
  staging branch's reviewers; the direct flow is left to the task that merges from the card.
- **One `tasks/act` route for the three**, as the task's page writes — their answers differ, and the card's writes have
  routes of their own (pause, resume, close).
- **Housekeeping after a review request**, so the card shows it at once — a heavy forge run on every press; the line
  says when the card catches up, and the project's card has **Housekeeping**.
- **Reviewers in the board's read** — a forge round trip on every read, for a panel opened rarely.

## Consequences

- Jig UI now writes to the forge as the person from the board: a merge into staging, a push and a pull request into
  the main branch, reviewers asked. Each is undone on the forge — a revert, a closed pull request, a review request
  taken back; Jig UI keeps nothing but the last reviewers' logins in memory.
- A promotion pushes the task's branch with this machine's git credentials, so the macOS keychain may ask; the write
  waits up to its 2 minutes.
- Untested on a forge: the answers' shapes come from Jig's contract and were written into fixtures by hand; a scratch
  project with a local bare origin gave only refusals (`forge-unavailable`, `not-ready`), kept as fixtures. The first
  real use is the forge test; an answer of another shape shows as "may have done it", never as a failure.
- If Jig counts these writes as working the task, with an agent session's id in its environment, as it does `task gate`
  (adr-20261118-a-person-writes-on-a-task-from-its-page), a Jig UI an agent started is always refused `stale-revision`;
  one started from a terminal or as a service is not.
- Undo: revert the merge; nothing is stored.
