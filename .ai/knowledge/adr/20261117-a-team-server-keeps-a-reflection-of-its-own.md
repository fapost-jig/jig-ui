---
id: adr-20261117-a-team-server-keeps-a-reflection-of-its-own
type: adr
status: accepted
date: 2026-11-17
domains: []
paths:
  - "server/team/**"
  - server/main.ts
  - Dockerfile
  - eslint.config.js
summary: The team server is a second command of the package, server/team/ beside createApp with an import boundary both ways, keeping a reflection of GitHub's answers in one SQLite file (node:sqlite, team.db 0600 in JIG_UI_DATA); no ProjectSource until wave 3 (amends adr-20261014-jig-ui-is-an-optional-layer-over-jig)
reviewed_at: 2026-11-17
---
# A team server keeps a reflection of its own, in one SQLite file, beside the local Jig UI

## Context

Spec `team-board` (Phase 1, wave 1, task `team-server`) asks for one Jig UI run for a whole team, on
a server of theirs, where people sign in with GitHub and see every project they may write to. The
local Jig UI keeps no state of its own: Jig's files are the truth, and it stores only its registry
and settings (adr-20261014-jig-ui-is-an-optional-layer-over-jig). A team server has no clone and
runs no Jig, so it cannot read that truth: it must keep what it learns from GitHub — its App, the
installations and the admin's decision on each, people and their accounts, the repositories of
approved installations and who may write to each — and its sessions. Decided with the maintainer at
the task's design gate, 2026-11-16.

## Decision

- **One package, a second command.** `jig-ui team-server` runs the team server from the same
  package; the Docker image runs that command. Its code is `server/team/`, a Hono app of its own
  (`createTeamApp`) with its own guard and routes, beside `createApp`. Neither side imports the
  other: `eslint.config.js` refuses `server/team/**` importing `../*` and any other `server/**`
  module importing `team/`; `server/main.ts` only dispatches the command, before the config
  directory is read.
- **Its store is a reflection, never the truth.** Who may write is GitHub's answer, read again every
  five minutes and on GitHub's webhooks; a person's tasks, in later waves, are Jig's, sent by each
  person's own Jig UI. The server keeps them so a page loads without asking GitHub per repository.
- **One SQLite file, `team.db`, through `node:sqlite`**, built into Node 24, so the package keeps no
  native dependency. Migrations follow `PRAGMA user_version`. The file is created 0600 in a folder
  it creates 0700 when missing, `JIG_UI_DATA` (`/data` in the image, its volume).
- **No ProjectSource in wave 1.** The team server reads no project; how a remote ProjectSource and
  a per-person view meet `createApp` is decided in wave 3, when clients send their reflection —
  deferred, not decided (task `team-server`, alternatives §3).
- It runs no `jig` and reads no file outside its data folder and the built page.

## Alternatives

- **The team mode inside `createApp`, the guard chosen at start, with a remote adapter now.** The
  seam would be right, but the adapter would be thirty-odd stubbed methods that show nothing, and the
  port is global where each person sees their own; the decision would be made blind.
- **A separate package in the repository.** A second build and a second release, where a workspace
  of packages was already rejected (adr-20261014-stack-vue-hono-sse-on-node).
- **`better-sqlite3`.** A native dependency the package rules out.
- **JSON files, like the registry.** No transactions and no queries: the approval guard lives in
  SQL, and a poll replaces an installation's repositories in one transaction.
- **No store: ask GitHub on every request.** Every page costs calls per repository, sign-in slows
  with the team's size, and the rate limit sets how many people may look.
- **Encrypting the App's secrets with a key from the environment.** It protects a backup stolen
  without the environment, at the price of managing a key whose loss loses the App; the people's
  tasks of later waves would not be covered by it anyway.

## Consequences

- The invariants in `RULES.md` on what Jig UI stores, which requests it makes and where it binds
  name both modes.
- The volume holds the App's private key and client secret: a backup of it is a secret, and the
  docs say so.
- `node:sqlite` is still a release candidate in Node 24; the image pins Node 24 by digest.
- A hosted Jig UI over people's own projects (wave 3) still has its seam in ProjectSource
  (adr-20261014-project-source-port-keeps-hosting-open); this decision does not use it yet.
