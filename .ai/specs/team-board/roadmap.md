# Roadmap — Team board

Destination: a team runs its own server, every person's Jig UI keeps it current from the background,
the owner sees all of their projects and tasks from any device, and teammates see, claim and receive
what can be taken — with nothing about anyone's work in progress shown to them.

## Phase 1 — All my projects in one place

Goal: one person sees every project they write to, personal and team ones, and every state of their
own tasks on one server, from any device. Done when: the maintainer's server holds his personal
projects and the team's, his phone shows his tasks in progress, and closing the laptop leaves the
last copy on the board marked "as of".

- [ ] team server — one Docker image with SQLite on a volume; a public GitHub App with Metadata
  (read) only, created on first start through the app manifest flow; installations taken only from
  accounts the server's admin approved; sign-in through the App; several forge accounts per person,
  known by user id; projects by forge id, membership by write access polled within minutes
- [ ] background client — Jig UI as a service started at sign-in on macOS, Linux and Windows;
  `jig-ui connect <url>` once per person, to one or more servers; `jig-ui` opens the team board while
  a server is connected, the local page keeps a link to it (after: team server — there is nothing to
  connect to before it)
- [ ] the owner's reflection — a full snapshot per project on connect, then changes, with a contract
  version the server checks; each server receives only the projects its App is installed on; the
  owner sees all their tasks in every state, copies from a disconnected client marked "as of"; tasks
  from forks and from several clones of one person merge (after: background client — it is what
  sends the reflection)

## Phase 2 — The team board

Goal: teammates see what can be taken, and who took which spec. Done when: a teammate sees the
maintainer's backlog and paused tasks and the specs, and none of his tasks in progress.

- [ ] team view — teammates see backlog, tasks on pause and specs of the projects they write to;
  nothing in progress, waiting, in review or in testing; no presence; lost access hides a person's
  copies at once and deletes them after 30 days (after: the owner's reflection — the team view is a
  filter over it)
- [ ] spec claims — claim and release a spec in the server's database; released by the server when
  the reflection shows the spec closed or its epic finished (after: team view — a claim is seen on
  it)

## Phase 3 — Handing a task over

Goal: a task in the backlog or on pause moves from its owner to a colleague. Done when: a handed-over
task is in the recipient's workspace with its branch, in the owner's trash, and a handover of a task
the owner started offline is cancelled with a note.

- [ ] hand a task over — the owner offers a backlog or paused task to a teammate; the owner's client
  checks it is still free, moves it to trash and the recipient's client takes it in, renaming it on
  a clash; a started task cancels the offer (after: team view — the task is offered from it; Jig —
  commands that hand a task out of a workspace and take one in, and the owner's login in a task's
  JSON, in fapost-lab/jig)

## Phase 4 — GitLab

Goal: a team on GitLab — gitlab.com or its own — uses the same server. Done when: a project on a
company's own GitLab appears on the board for the people who may write to it.

- [ ] GitLab sign-in and membership — sign-in and the write-access check through the GitLab
  instance's own OAuth application; projects by GitLab project id (after: the owner's reflection —
  GitLab projects join the same reflection)

## Later

- [ ] fog: several servers on one page — a person's projects on two servers shown together; its
  shape waits for a real second server
- [ ] fog: answering an agent from the server and from a phone — a command channel from the server
  to the client; what may be written and how it is confirmed is not stated
- [ ] fog: a public cloud for many teams — operation, limits and data requests are not stated

## Waves

1. team server
2. background client
3. the owner's reflection
4. team view; GitLab sign-in and membership
5. spec claims; hand a task over

<!--
Rules (jig-idea §8):
- An item is a finished slice that makes the product noticeably better, never a layer.
- A dependency without a one-line reason is not a dependency.
- A `task-id` appears when the item's task is filed; `[x]` is set when that task is closed.
- `fog:` items are not split or sized; they become real items once the fog lifts.
- No dates, no point estimates: order is the priority.
- `jig spec list` counts checkbox lines only: `[x]` done, a leading backticked task id
  followed by a dash (`—` or `-`) filed, a leading `fog:` fog. Keep waves as a numbered list.
- A wave entry names an item by its title (the text before its first ` — `) or its task id,
  entries separated by `;` — `jig spec plan` reports an entry that names no item or several.
-->
