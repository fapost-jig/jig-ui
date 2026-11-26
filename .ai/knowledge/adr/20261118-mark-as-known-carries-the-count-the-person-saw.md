---
id: adr-20261118-mark-as-known-carries-the-count-the-person-saw
type: adr
status: accepted
date: 2026-11-18
domains: []
paths:
  - web/components/StagingWork.vue
  - web/lib/staging.ts
summary: Why the staging bell's Mark as known sends the count the person saw instead of a revision, and never runs the command string Jig prints
reviewed_at: 2026-11-18
---
# The bell's Mark as known carries the count and the shas of the commits the person saw, not a revision, and Jig UI puts its command together itself

## Context

On Jig's staging flow, commits land on the staging branch that no task brings to the base: a fix pushed there by hand,
a task abandoned after it landed. From Jig 0.46.0 (fapost-lab/jig#511) the `staging-unowned` item of `jig status --json`
counts only the reader's own such commits — the author's email or name is the clone's git identity — and stays until
they are acknowledged with `jig staging ack` (Jig's adr-20261113-staging-work-is-reported-to-its-own-author-until-acknowledged).
It carries `staging: {commits, list, ack}`: the exact count, the newest 20 as `{sha, subject, date}`, and the command,
`jig staging ack --expect <commits>`. The command takes no `--revision` and prints no JSON; `--expect <n>` refuses,
exit 1 and nothing written, when the count is not `n` any more. The spec `jig-ui` asked for a bell beside the project's
name that lists them and marks them as known (task `own-staging-work`).

## Decision

- **The bell replaces the item.** On a project on the staging flow (`ProjectView.stagingFlow`), the card has a bell
  beside its name: lit while the item lists the person's commits, dark — no button — while there are none. A press opens
  the list on the card (`StagingWork.vue`), and the item leaves the card's list (`listed` in `web/lib/staging.ts`). An
  item of a Jig before 0.46.0 — no `staging`, or Jig 0.45.0's `{commits}` alone — counted everyone's commits and lists
  none: it stays in the list as Jig says it, and the card has no bell below 0.46.0.
- **The write carries the count and the shas, not a revision.** `POST /api/projects/:id/staging/ack {expect, shas}`
  takes the count the card showed and the shas it listed. Through `ProjectSource.ackStaging` and the adapter's
  `writing()`, the adapter reads `jig status --json` again and refuses `stale-revision`, 409, unless the item's count
  and list are the ones sent; then it runs `jig staging ack --expect <expect>`. Jig checks the count alone: a commit
  shown that reached the base while another arrived would leave it the same, and a fetch from a terminal reads nothing
  again, so without the list the new commit would be marked unseen. Jig says a moved count only in its message
  (`… now, not <n>; …`), which `ackStaging` in `server/jig/client.ts` reads. Refused `unsupported` below Jig 0.46.0
  without running Jig, and `upgrading` while the project's upgrade runs. A refusal's reasons reach the card.
- **Jig UI puts the command together itself.** The item's `ack` text never leaves `server/jig/`: the schema reads
  `commits` and `list` only, and the adapter builds the argv. A command string from Jig's output is not run.

## Alternatives

- **The revision of the read**, as adr-20261022-writes-carry-the-revision-of-their-read asks of a write. `jig staging
  ack` takes none, and a revision would refuse the mark whenever anything else in the project was written since,
  though the commits shown are the same; the count and the list guard exactly what the person decided about.
- **The count alone**, as Jig's `--expect` offers (the first cut of this task). Its review found the case above where it
  marks a commit nobody was shown.
- **Running the item's `ack` as given.** It is text Jig printed for a terminal; running it would make Jig UI execute
  whatever a later Jig puts there.
- **A popover beside the bell.** The page's kit has none, and the card already opens its panels (Upgrade, Housekeeping,
  Refresh) under its header.
- **Showing the item of an older Jig as a bell.** It has no list, and its count includes other people's commits, which
  the page never shows.

## Consequences

- A commit fetched from a terminal lights the bell at the next read of the project, not at once: the page follows a
  project by watching its `.ai/` (feature-live-updates), and a fetch writes only under `.git/`. Refresh and Housekeeping
  read the project again after their fetch.
- Marking is per clone: Jig keeps the acknowledgement in `.ai/runtime/staging-acked`, by patch id and sha, so a rebase
  of the staging branch keeps it and another clone of the same person still lights its bell.
- A later Jig that changes its refusal's wording turns a moved count into `failed` with Jig's own reasons, still nothing
  marked.
- Beyond Jig's newest 20 the person sees only the count, so a mark of more than 20 covers commits they saw counted, not
  listed; a newer one arriving among them still moves the list's newest, and the mark is refused.
- The status read and Jig's mark are two runs: a commit that lands between them, milliseconds apart, is the one case
  left, and only if a shown one left the list in the same instant.

*(Amended by task `jig-min-0-48`, 2026-11-26: Jig UI needs Jig 0.48.0, so the 0.46.0 gate (`unsupported` below it),
the item of a Jig before 0.46.0 and the card without a bell no longer apply.)*
