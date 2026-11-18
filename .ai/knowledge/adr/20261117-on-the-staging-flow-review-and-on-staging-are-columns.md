---
id: adr-20261117-on-the-staging-flow-review-and-on-staging-are-columns
type: adr
status: accepted
date: 2026-11-17
domains: []
paths:
  - server/board/columns.ts
  - web/lib/waits.ts
  - server/jig/client.ts
  - web/components/BoardColumns.vue
  - web/lib/tones.ts
  - server/source/local.ts
summary: On Jig's staging flow parked tasks sit in Review and On staging, a Review card says its review's state, and Ready shows the promotion with its link; Jig 0.45.0 is read into 0.46.0's shape.
reviewed_at: 2026-11-18
---
# On Jig's staging flow the board has a Review and an On staging column, between In progress and Ready

## Context

adr-20261113-a-task-parked-at-staging-is-not-done kept a parked task in Ready, "the column rules are unchanged", and
rejected "a column of its own for parked tasks". The owner asked for the reverse (2026-11-13, PR #141, comment
6861995622): a task waiting on reviewers or on testing is neither in progress nor ready, and they want to see at a glance
what is on review and what is on staging. Jig 0.46.0 (fapost-lab/jig#523) gives what a card needs to say so: in
`jig task list --json` a parked task's `parked.review` — `{state: approved|changes|waiting|none, waiting_for: [login]}`,
`null` for `signal` and when the forge cache cannot say — and, on the staging flow, `promotion`, the pull request from the
task's branch into its base. Its `pull_request` there is now the one into staging with that pull request's own state and
CI; on 0.45.0 they were the promotion's. Roadmap item `review-staging-columns` of spec `jig-ui`; approved at the design
gate, 2026-11-17.

## Decision

- **Two more columns on the staging flow only**: Needs you, In progress, **Review**, **On staging**, Ready, Backlog,
  Paused (`COLUMNS` in `server/board/columns.ts`). `columnOf`, first rule that fits: Paused, Backlog, Needs you, then a task
  parked for `review` → Review, parked for `signal` → On staging, then Ready and In progress as before. The project is on
  the staging flow when one of its tasks says so (`stagingFlow`); a project with no task shows the other five.
  *(Amended by task `staging-columns-without-tasks`, 2026-11-18: a project with no task listed takes the flow from its
  setting `git.flow` (`jig config keys --json`, Jig 0.45.0), read only then, so it shows all seven; the read's
  `stagingFlow` carries it to `columns()`. A colleague on the staging flow with no live task saw five columns and took
  it for a bug.)* Seven
  columns are at least 11.5rem wide instead of 14rem (`BoardColumns.vue`), so they fit a 1440px window with a classic
  scrollbar (12rem left it no room, task `staging-nits`).
- **A card in Review says its review** (`inReview` in `web/lib/waits.ts`): "Approved — yours to land" or, with no
  approval read, "Pull request into staging — yours to land" for `hint: landing`, in the attention tone; "Waits for review
  from <logins>"; "Changes requested", attention; "Approved" (the agent lands it); "No review requested yet"; and, the
  review not known, "Pull request into staging waits for review". Its link is the pull request into staging.
- **Ready keeps a task whose promotion is open**, now with that promotion's state, CI and link ("Promotion open, CI
  pending"), or "Promotion opened" with the link alone: `jig task promote` records the link at once, and its state waits
  for the next housekeeping run; merged, the task waits for its close as before — the ✕ after housekeeping's `needs-consolidation` — and leaves
  the board when closed. The roadmap's "leaves the board once it merges" was narrowed so at the gate: a close is the
  person's step.
- **The details** show the pull request into staging and the promotion apart, each with its own state, CI, link and the
  time Jig's housekeeping heard it (`pullRequests`; the time per entry since task `staging-nits`).
- **One shape for both Jigs.** JigClient reads Jig 0.45.0, which has no `promotion`, into 0.46.0's shape: for a task on
  staging or parked, the state and CI of its `pull_request` become the promotion's, without a link, and the pull request
  into staging has none; `parked.review` is `null`.
- A resume takes a parked task out of parking (`resumed` in `columns.ts`), so **Take back for a fix** from Review or On
  staging still lands in In progress.
- This amends adr-20261113-a-task-parked-at-staging-is-not-done ("A parked task stays in Ready: the column rules are
  unchanged") and its rejected alternative "A column of its own for parked tasks"; the rest of it stands.

## Alternatives

- **The two columns on every flow** — two columns that are always empty in every project on the direct flow.
- **The flow from `jig status --json` or the config** — one more read for a project with no task, whose two columns would
  be empty anyway. *(Taken after all for that project, task `staging-columns-without-tasks`: empty columns that are
  missing read as a broken board; `jig status --json` does not name the flow, `jig config keys` does.)*
- **No promotion state on Jig 0.45.0** — fewer lines, but such a project would lose "Promotion open"; reading it into one
  shape costs a few lines in one place.
- **Changes requested in Needs you** — Needs you is read from the gate and the autopilot run, not from a review, and the
  owner asked to see the review in Review.
- **Cards that leave the board once the promotion merges** — the board would close tasks for the person, or hide ones not
  closed.

## Consequences

- A board on the staging flow is seven columns wide; narrower than 1440px it scrolls sideways, as five do on a narrow
  window.
- A project with no task listed, on Jig 0.45.0 or later, runs one more Jig at each read, `config keys --json`; a run
  Jig refuses shows five columns rather than failing the board, while an answer JigClient cannot read fails it as
  `incompatible`, as adr-20261018-jig-answers-checked-by-zod-schemas has every read do.
- The review is the forge cache's: right after a ship it shows on the next housekeeping run.
- The page copies one more of Jig's rules: a resume ends parking. A Jig that parks a resumed task makes `resumesTo` wrong
  until `columns.ts` follows.
- A new `review.state` from Jig fails the read (`incompatible`) rather than showing a wrong note.
- Seen against Jig 0.46.0 in a scratch repository on the staging flow with a local origin, the review states and the
  promotion from a forge cache written by hand (`server/jig/fixtures/task-list-staging-review.json`); untested on a forge.
- Undo: revert the merge; nothing is stored.
