# Team board — a team server that reflects every person's Jig projects

Depth: deep — data leaves the machine, accounts appear, and the server can make a client move a
task out of its workspace; these are the most expensive mistakes Jig UI can make.

Origin: grown out of a conversation in the Jig repository (2026-11-14/15) about autopilot questions
lost in one session's output. It lifts this repository's `jig-ui` roadmap fog item "hosted and
self-hosted Jig UI".

## Idea

The maintainer's words, translated from Russian, in the order they were said:

- "I've hit the fact that I lack a UI in the cloud. From my phone I cannot see what is going on,
  because tasks are done on my computer."
- "It is a UI question. We thought about it and put it off. And it seems to me it is a step towards
  seeing what the neighbours do, and assigning tasks to colleagues."
- "If Jig UI sends JSON about a task to a server, nothing has to change in storage. Tasks stay local
  on the computer. If I assign my local task to someone else, my task in effect moves from my
  workspace to the other developer. Other people's tasks can be highlighted by colour, and the owner
  shown. The question is separating personal projects from shared ones: probably log in through
  GitHub or GitLab, or bind projects to a repository by registration, so that others' projects are
  shown only to those who really take part."
- "It is important to me that the team does not get the feeling of being watched. Everyone sees
  only the tasks in the backlog and on pause, and only those can be assigned to someone else. Tasks
  in progress and in other statuses are seen only by their owners. That also solves the noise. And
  specs need assigning too, so that I know a spec is already taken and I can take another."
- "I would not lean on the cloud's database. If I really did not start the client, nobody sees
  anything, and that is a full desync. The database may hold users, perhaps task titles, perhaps
  artifacts, but always as a draft. Even in the cloud it is only a reflection of state plus small
  conveniences for the team."
- "Cloud does not mean a service for the whole world. Rather it is a self-hosted solution; groundwork
  for a cloud is great, but later. The client itself must run without opening a page, otherwise it
  is easy to look at the local UI instead of the shared one. If a person is not connected, their
  backlog is not shown — and that is the same case of being watched. So we need to copy the list to
  the cloud's database and sync it when online."
- "I develop several projects, personal and team ones. Through the cloud I would solve all my
  problems of seeing every project in one place." — on a company server: "I can take the company's
  service on myself; for tests that is fine. And check along the way that one client connects to
  several servers."

## Goal and problem

- Who is worse off without this, and how: a person running Jig in several projects, personal and
  shared, sees them in one place only on the machine that runs them — never from a phone, and never
  together with what the team could take. A team has no shared view of what is free to take, which
  spec someone already took, or a way to hand a task over.
- What is true when the work is done: a team runs its own server; each person's Jig UI keeps it up
  to date from the background; the owner sees all of their projects and every state of their own
  tasks there, from any device; teammates see only what can be taken — backlog, tasks put on pause,
  specs — can claim a spec and receive a task its owner hands over; and Jig UI without the server
  works as it does today.

## Stress test

- Hidden assumptions — "this holds only if …":
  - only if a GitHub App can both sign a person in and tell whether they may write to a repository,
    with no access to code — it can, with Metadata (read) only, if the App is public and the server
    keeps its own allow-list (checked: `research.md`);
  - only if every teammate runs the client: a teammate who never connected looks like an empty
    backlog;
  - only if the reflection's JSON stays readable across Jig and Jig UI versions: a private state
    misread as backlog would show it to the team.
- The main trade-off: no feeling of being watched against coordination. The team does not see work
  in progress, so "who is touching X right now" stays unanswered here — the forge answers it with
  open pull requests and branches.
- The weakest point: handing a task over across a desync — the owner started the task offline while
  the server still shows it free.
- Failure modes — cause, what breaks, the signal that shows it (independent failure hunt, ranked by
  likelihood times cost; how each is met is in "Decisions"):
  - an OAuth app needs the `repo` scope to see write access to private repositories — full access to
    a person's code; people refuse at the consent screen and a leaked token table is a disaster;
  - organisations block third-party OAuth apps until an admin approves them, and SAML SSO hides
    organisation repositories — "project not found" for organisation repositories only;
  - a stale reflection shown as current — the team plans around tasks already started; handover
    requests for tasks no longer free;
  - a handover applied over a desync moves started work to trash — the same task id alive in two
    workspaces, restores from trash;
  - the team view is nearly empty, since most work is in progress — low use beyond specs;
  - task content reaches the server's operator, journals included (paths, command output, sometimes
    secrets) — security questionnaires, secret-scanner hits;
  - clones do not map to one project: forks, SSH aliases, renamed or transferred repositories —
    duplicate projects, "I cannot see my colleague's backlog";
  - one person with several clones or machines — duplicates, state flickering between pushes;
  - task ids collide on handover, and artifacts point at the owner's branches and paths — handover
    errors, `jig task start` failing on a missing branch;
  - the reflection's schema drifts between versions — parse errors after a release, unknown states;
  - revoked access lingers when it is checked only at sign-in — found at an offboarding audit, or
    never;
  - corporate proxies and sleeping laptops drop the websocket — pushes lost silently, long gaps.
- Other shapes considered, and why this one: the server as the source of truth for shared tasks
  (rejected: without a running client it is a desync, and Jig itself would have to work with tasks
  it does not hold); a public cloud first (rejected for now: the maintainer would carry its
  operation, and companies that keep data in-house need their own server anyway); the team's issue
  tracker as the shared view (not opened: Jig's `issue-intake` spec reads from trackers, nothing
  writes to them).

## Scope and non-goals

- In scope: a self-hosted team server; Jig UI as its background client, connected to one or more
  servers; the owner's view of all their projects and tasks from any device; the team view of
  backlog, paused tasks and specs; spec claims; handing a task over; GitHub first, GitLab second.
- Not doing: a public multi-team cloud (later; the data is shaped for it); one page showing several
  servers at once (later); answering an agent's question from the server or a phone (later — it is a
  command channel to the client); showing teammates anything about work in progress or anyone's
  presence; making the server the source of truth for any task.

## Decisions

- **The server is a reflection, never the truth.** Jig's files on each person's machine stay the
  source of truth. The server's database keeps the last reflection of every project permanently and
  updates it on every sync, so a person who is offline does not vanish from the board; besides that
  it holds users, spec claims and handovers — data no single machine owns. Task content (titles,
  artifacts) is held as a draft copy. Rejected: the server as the source of truth for shared tasks —
  without a running client that is a full desync, and Jig would have to change. Rejected: showing
  nothing for a client that is not connected — a person's backlog disappearing when their laptop
  closes is presence by another name, which is the watching this spec avoids.
- **Self-hosted first.** The team runs the server; a public cloud comes later. Every record is keyed
  by the GitHub App installation it came through, so one server can later serve many teams without
  a schema change. Rejected: a public cloud first — the maintainer would carry abuse, storage and
  data requests alone.
- **One repository, two programs.** The server is this repository's `server/` and `web/` behind a
  remote `ProjectSource` adapter, with accounts in place of the per-start token — the four seams in
  `jig-ui`'s `architecture.md` ("Room for a hosted or self-hosted Jig UI"). The local Jig UI is the
  connector.
- **Deployment.** One Docker image; SQLite on a volume by default, so there is no database to set
  up; HTTPS through the team's own reverse proxy.
- **The client runs in the background.** Jig UI installs as a service started at sign-in to the
  operating system — launchd on macOS, systemd on Linux, the Task Scheduler on Windows — and needs no
  open page. While a server is connected, `jig-ui` opens the team board, not the local page; the
  local page stays for work without a network, with a link to the team board. Rejected: a client
  that needs its page open — people would look at the local UI instead of the shared one.
- **Connecting is once per person, to one or more servers.** `jig-ui connect <url>` signs in through
  the browser and keeps the token. A client may be connected to several servers; each server
  receives only the projects whose repositories have that server's GitHub App installed, so
  personal repositories stay off a server by themselves, with no "private" mark to set.
- **Sync.** A full snapshot per project on connect, then changes. A task closed or removed locally
  leaves the board at the next sync. The client sends the version of the contract it speaks; the
  server refuses a version it cannot read rather than guess at its states.
- **Sign-in through a GitHub App that asks only for Metadata (read).** It signs a person in and
  tells whether they may write to a repository, and it cannot read code, which needs the Contents
  permission (checked against GitHub's documentation on 2026-11-16: `research.md`). The server
  creates its App on first start through GitHub's app manifest flow — a button, GitHub fills in the
  fields; under an organisation, an owner or an App manager registers it. The default name carries a
  suffix unique to the server, since App names are unique across GitHub. Rejected: an OAuth app — it
  needs the `repo` scope, full access to a person's code, and organisations block it. Rejected: one
  App shared by several servers — one private key in several hands and only one webhook address.
- **The App is public, and the server keeps its own allow-list.** One App is installed on several
  accounts — a person's own and the team's organisation — so one server holds all of a person's
  projects, and only a public App installs on accounts other than its owner's. Anyone can install a
  public App, so having it installed is not access: the server takes an installation only from an
  account its admin approved, and a person only through such an installation. Rejected: a private
  App owned by the organisation — only its members could sign in, but it installs on the
  organisation alone, so no personal repository could be on the server (the user, 2026-11-16).
- **People are known by their forge user id.** A login is shown, never a key: logins change. A
  person's user token is used at sign-in, to find who they are and which installations they reach,
  and is not kept, so the server's database holds no forge credentials of its people.
- **Several forge accounts per person.** A person on the server may link several forge accounts;
  they see the union of what those accounts can write to. A task's owner is the forge account its
  clone pushes as — `github.account`, which Jig already records per clone as a login; the server
  resolves it to the account's user id once and follows renames by that id.
- **Taking part means write access.** A person sees a project only if the forge says they may write
  to its repository, never read: read access would open a public repository's board to anyone.
  Access is checked with the App's installation token, not once per session: the server polls each
  repository's writers (`GET /repos/{owner}/{repo}/collaborators?permission=push`) every few minutes
  with conditional requests, which cost nothing while the answer is unchanged. Webhooks hide a
  project at once when the App loses it (`installation`, `installation_repositories`) and sign a
  person out when they revoke the App (`github_app_authorization`); no webhook reports a changed
  collaborator to an App with Metadata only. When access is lost, that person's copies are hidden at
  once and deleted after 30 days. Rejected: the Members (read) permission, for the `member`,
  `membership` and `team` webhooks — it is an organisation permission, so only an organisation owner
  could install the App, never a repository admin on their own repositories (the user, 2026-11-16).
- **A project is a repository by its forge id**, not by its URL. Tasks from a fork belong to its
  `parent`, the repository it was forked from, when the server's App covers that repository;
  otherwise the fork is a project of its own. Clones and machines of one person merge into one
  owner; a disagreement between them is marked, not hidden. Rejected: the root of the fork network
  (`source`) — a personal fork of a team repository that is itself a fork of an open-source project
  would land on the open-source project (the user, 2026-11-16).
- **What the team sees.** Teammates see tasks in the backlog (filed, not started), tasks a person
  put on pause, and specs. Tasks in progress, waiting for a person, in review or in testing are seen
  only by their owner. Nobody's presence is shown. A copy from a client that is not connected
  carries "as of <time>". Rejected: showing teammates the domains a task in progress touches — it
  edges towards watching; "who is touching X" belongs to the forge.
- **The owner's private data goes to the server, seen only by the owner.** Rejected: keeping
  private data on the machine — every hosted service holds its users' data, and it stops nobody;
  without it the owner's phone shows nothing of their own work.
- **A spec claim lives in the server's database.** It is faster than a pull request. The person who
  claimed releases it, or the server does when the reflection shows the spec closed or its epic
  finished. Without the server, people coordinate by themselves. Rejected: an `Owner:` line in
  `spec.md` through a pull request — a pull request for every claim. Rejected: pushing a branch as
  the claim — it stays taken until someone deletes the branch.
- **Handing a task over.** Only a task in the backlog or on pause, and only its owner hands it over.
  A handover is an offer, not an order: the owner's client, on its next connect, checks that the task
  is still in the backlog or on pause, moves it to Jig's trash — never deletes it — and the
  recipient's client takes its workspace in. If the owner started it meanwhile, the handover is
  cancelled with a note to both. The task's branch is pushed before the handover; on an id the
  recipient already has, the recipient renames it when taking it in.
- **What Jig has to provide** (fapost-lab/jig): commands to hand a task out of a workspace and take
  one in (working names `jig task give`, `jig task take`); the owner's forge login in a task's JSON;
  a contract version the server checks. These are Jig's to design; this spec only names them.
- **GitLab is the second forge, not "some day".** A company's own GitLab has its own OAuth
  application, where the wide `read_api` scope stays inside the company.
- **Each phase ships on its own**, as the rest of Jig UI does; no epic branch.

## Open questions

- How an organisation admin is led through installing the team's GitHub App on the organisation —
  the first-run experience of a team depends on it. Behind SAML SSO a person must start an SSO
  session before signing in, or the organisation's repositories are missing from that sign-in.
- What a real App answers where GitHub's documentation is silent (`research.md`, "What this changes
  in the spec"): whether a manifest asking only for Metadata registers; whether
  `GET /repos/{owner}/{repo}` hands such an App a `temp_clone_token` for a private repository — a
  short-lived credential for Git, which the server then never stores or logs; whether
  `permission=push` means push or higher; whether SAML SSO limits installation tokens; whether a
  repository's id survives a rename and a transfer. Each is a short test with a real App, at the
  start of the team server's task.
- How GitLab's membership check and sign-in fit the same server — Phase 4 depends on it.

## Set aside

- One page showing several servers together, like a mail client with several mailboxes; the page of
  any server keeps the sign-ins to the others and asks them itself — set aside until a real second
  server exists; Phase 1's client already connects to several.
- Answering an agent's question from the server and from a phone — set aside: it is a command channel
  from the server to the client, a write where everything else is a read; the websocket is there for
  it.
- A public cloud for many teams — set aside for later; the records are keyed by installation for it.
- unexplored: notifications from the server, beside Jig's Telegram messages or instead of them.
- unexplored: Jig's `issue-intake` spec — requests from a tracker reaching the team's backlog.
- unexplored: whether Jig's side is a spec of its own in fapost-lab/jig or tasks linked from here.

## Assumptions left untested

- A claim releasing itself when the reflection shows the spec closed or its epic finished is enough
  — taken at deep; the first claim left behind tests it.
- Teammates accept a board that shows only what can be taken — taken at deep; a week of a real team
  using it, and whether anyone says they feel watched, tests it.
