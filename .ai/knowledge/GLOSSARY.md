# Glossary

Canonical ubiquitous language for this project. One entry per term. Use the canonical
term in source code, database schema, APIs, documentation and commit messages.

Entry format:

```
## <Canonical Term>

One-sentence definition.

Informal synonyms: <words people say instead>.
Use in: source code, schema, API, documentation.
```


## Connected project

A Jig project registered in Jig UI by the path of its main checkout, and named by an id
everywhere else.

Informal synonyms: repo, clone, workspace (wrong: workspace is all connected projects).
Use in: source code, API, documentation.

## Main checkout

A clone's primary working tree, which lists every task of the clone; a worktree is never
connected.

Informal synonyms: root, main repo.
Use in: source code, documentation.

## Registry

Jig UI's list of connected projects, kept in the user's config directory; the only data Jig UI
owns besides interface settings.

Informal synonyms: project list, database (wrong: the local Jig UI has none; the team server's is
`team.db`).
Use in: source code, documentation.

## Workspace

All connected projects together, as the workspace dashboard shows them.

Informal synonyms: overview, all projects.
Use in: source code, API, documentation.

## Board

One connected project's tasks laid out in columns derived from Jig's state.

Informal synonyms: kanban.
Use in: source code, API, documentation.

## Column

A board lane computed from a task's Jig state; never stored.

Informal synonyms: status (wrong: status is one of Jig's fields the column is computed from).
Use in: source code, documentation.

## Lane

One of the three groups a spec's phase shows its items in on the Specs view — To file, In work,
Done — worked out from the item, never stored.

Informal synonyms: column (wrong: a column is the board's).
Use in: source code, documentation.

## Request

A sticky ask from the page that Jig holds until it is honoured or cancelled — today a pause, which
a started task takes at its next stage boundary; the card shows it with its age. A task nobody
started is paused at once instead.

Informal synonyms: pending move.
Use in: source code, API, documentation.

## Parked

Jig's word for a ready task on its staging flow that waits at the staging branch — for a review of its
pull request into staging, or, once there, for "prepare for prod"; not finished. The board puts the first
in Review and the second in On staging, columns only a staging project's board has.

Informal synonyms: waiting at staging; landed (wrong: landed is only the merge into staging, and a
landed task taken back for a fix is on staging but not parked).
Use in: source code, documentation.

## Promotion

On Jig's staging flow, the pull request from a task's branch into its base, opened at "prepare for prod"
once the work was tested on staging; a task whose promotion is open is no longer parked.

Informal synonyms: the pull request (wrong: on the staging flow that is the one into staging).
Use in: source code, documentation.

## Queue

Jig's order of a project's work (`jig queue list`): tasks and epics by level — the top level, then
each open epic's — and position. A task is in it only once something placed it there; the board
orders each column by it.

Informal synonyms: backlog order, ranking.
Use in: source code, API, documentation.

## Priority

A task's urgency in Jig's queue, 0 (most) to 5, or none; shown on a card as `P0`…`P5`. Set
apart from its position: priority does not reorder the queue.

Informal synonyms: severity, importance.
Use in: source code, API, documentation.

## Revision

The version of a project's state a read came from; carried by the change signal and sent back
with every write, so a stale write is refused.

Informal synonyms: version, etag, hash.
Use in: source code, API.

## Conflict
A change from the page that Jig refused as `stale-revision`, shown as what changed on the board
between the read it was made on and the read after it.
Informal synonyms: stale write, collision.
Use in: source code, documentation.

## ProjectSource

The port through which the server reads and changes a connected project, and finds the ones not
connected yet; the local adapter is built from JigClient and Watcher.

Informal synonyms: provider, backend.
Use in: source code.

## JigClient

The module that runs `jig` and validates its JSON; the only code that knows Jig's shapes.

Informal synonyms: Jig adapter, CLI wrapper.
Use in: source code.

## Action

Something a person may do next with a task, as Jig decides it from the task's state, with the Jig
command that takes it; Jig UI shows the ones Jig offers, and takes some of them itself — a pause
request, a pause of a task nobody started and a resume from the board, a close from the board
and from a project's card, and from Jig 0.46.0 a design's approval, an abandon and an archive on the
task's page and a bring-back, a roadmap item's close and an archive on the finished list
(adr-20261118-a-person-writes-on-a-task-from-its-page), and on the staging flow a landing, a review request and a
promotion from a card's menu, and a landing by a drop on On staging (adr-20261119-a-person-lands-asks-review-and-prepares-for-prod-from-the-card);
off it a merge of the task's pull request from a card's menu and from a project's card, and the forge's word on where
it stands on a press, Status… (adr-20261119-a-person-merges-a-tasks-pull-request-and-asks-where-it-stands-from-the-card).

Informal synonyms: legal move, button.
Use in: source code, API, documentation.

## Setting

One of Jig's configuration keys in a project, as `jig config keys` lists it: the project's, answered
by `.ai/config.yaml` and shared through git, or the person's own in a clone, answered by
`.ai/config.local.yaml`. Not Jig UI's interface settings, which Jig UI keeps in its config directory.

Informal synonyms: config key, option.
Use in: source code, API, documentation.

## Team server

Jig UI run once for a whole team (`jig-ui team-server`), on a server of theirs, where people sign in
with GitHub and see the repositories they may write to; it keeps a reflection, never the truth.

Informal synonyms: hosted Jig UI, the board, the server.
Use in: source code, API, documentation.

## Installation

The team server's GitHub App installed on one account or organisation, by GitHub's installation id;
it gives nothing until the admin approves it.

Informal synonyms: install, org.
Use in: source code, schema, API, documentation.

## Allow-list

The installations the team server's admin approved; only through them does anyone sign in or any
repository reach the server.

Informal synonyms: whitelist, approved orgs.
Use in: source code, documentation.

## Person

Someone on the team server, with one or several linked forge accounts; they see what any of their
accounts may write to.

Informal synonyms: user (wrong: a GitHub user is an account).
Use in: source code, schema, API, documentation.

## Account

One forge account of a person on the team server, known by its forge user id; its login is shown,
never a key.

Informal synonyms: GitHub user, login.
Use in: source code, schema, API, documentation.
