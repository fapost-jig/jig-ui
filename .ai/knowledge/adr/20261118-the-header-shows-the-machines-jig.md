---
id: adr-20261118-the-header-shows-the-machines-jig
type: adr
status: accepted
date: 2026-11-18
domains: []
paths:
  - server/jig/client.ts
  - server/source/local.ts
  - server/http/app.ts
  - web/App.vue
  - web/components/MachineJig.vue
  - web/lib/upgrade.ts
summary: The header shows this machine's Jig and the newest release from `jig version --json` of the jig on PATH, run outside any project, with Update… running the confirmed self-update; any failure shows nothing
---
# The header shows the machine's Jig, read from the `jig` on PATH outside any project

## Context

Spec `jig-ui`, Phase 4: the page's header should show the Jig installed on this machine and the newest Jig released,
side by side, the newer one marked, with the update the upgrade panel runs. Until now Jig UI knew the machine's Jig
only from a project's `upgrade-available` item (feature-workspace), and ran Jig only in a project's main checkout
(convention-jig-client).

Jig 0.46.0 answers `jig version --json` — `installed`, `latest` and `checked_at` — at machine level, outside any
repository. Its `installed` is the version of the copy that runs: a project's `.ai/scripts/jig`, installed by copy,
names that project's Jig, not the machine's. Jig itself calls the machine's Jig the `jig` on PATH
(`jig_global_executable`). Jig keeps the newest release on the machine (`~/.cache/jig/latest-release`) for 6 hours, 1
after a failed check, and only then asks its origin again, within 5 s.

## Decision

- The local adapter reads `jig version --json` from the `jig` on PATH, through the same bash as a project's Jig (Git's
  on Windows, where it is sourced, as a project's is), in the home folder, outside any project: `readMachineJig` in
  `server/jig/client.ts`, the port's `machineJig`, `GET /api/instance/jig` →
  `{ jig: { installed, latest, updatable } | null }`, `updatable` when a connected project has a Jig to run the
  self-update through. The command's words are fixed; nothing a person typed reaches it.
- Reads asked while one runs share it: every open tab asks at once when a self-update ends.
- Any failure is `null` — no `jig` on PATH, a Jig before 0.46.0, which refuses `--json` there, a shape this Jig UI does
  not read, no answer in 15 s — and the header says nothing about Jig. `latest: null` (offline, not asked yet) shows the
  installed Jig only, unmarked.
- Jig UI keeps nothing: Jig's own cache decides when the network is asked. The page reads it with its first workspace
  read, once the change stream is open, and again only when the workspace read says something that changes the answer:
  a self-update ended since — the header's or a card's —, a project heard of a new release (`machine.release`), or the
  connected projects changed, which decides `updatable`. Any other project change signal does not read it.
- Both versions show while the newest is known: `jig 0.47.0 · newest 0.47.0` up to date, `jig 0.46.0 0.47.0 out`
  marked when the newest is newer.
- `latest` is marked where it is newer than `installed` by release numbers, a source build's `+<sha>` taking no part
  (`jigNewer`, `older` in `web/lib/upgrade.ts`). **Update…** beside it, only where `updatable`, asks first — the confirmation
  adr-20261029-upgrade-all-and-self-update-from-the-page requires before a self-update — and runs the same
  `POST /api/self-update`, then reads the version again; a refusal shows Jig's reasons in the question
  (`web/components/MachineJig.vue`).

This amends convention-jig-client's "run `jig` in a project's main checkout" and feature-workspace's "Jig UI never runs
Jig outside a project" for this one read.

## Alternatives

- **Through the first connected project's Jig** — no PATH lookup, but its `installed` is the project's copy, and the
  header would show a project's Jig as the machine's; with no project connected there would be nothing to run.
- **Reading Jig's cache file** (`~/.cache/jig/latest-release`) — no Jig run, but a file Jig never promised as a
  contract (convention-jig-client's MUST NOT), and it holds no installed version.
- **Jig UI asking GitHub for Jig's releases** — a second request of Jig UI's own to the internet (RULES), 60 an hour
  unauthenticated, for what Jig already keeps.
- **The `release-available` and `upgrade-available` items of the projects' reads** — already there, but a project hears
  of a release only at its own housekeeping, and neither names the machine's Jig while every project is on it.

## Consequences

- A `jig` on PATH is now something Jig UI reads. A machine whose projects run Jig only through their own copies, with
  no global Jig, shows nothing about Jig in the header.
- A header read may make Jig ask its origin (at most every 6 hours, within 5 s). The request is Jig's, not Jig UI's;
  RULES' network invariant says so.
- The header's update and the card's **Upgrade…** run one self-update: `409 running` refuses the second, as before.
