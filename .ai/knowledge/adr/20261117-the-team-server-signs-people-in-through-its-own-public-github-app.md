---
id: adr-20261117-the-team-server-signs-people-in-through-its-own-public-github-app
type: adr
status: accepted
date: 2026-11-17
domains: []
paths:
  - server/team/access.ts
  - server/team/auth.ts
  - server/team/app.ts
  - server/team/github.ts
  - server/team/poll.ts
  - "web/team/**"
summary: Each team server registers its own public Metadata-only GitHub App; a setup code in the log until there is an admin; installations need the admin's approval; OAuth with state, PKCE and a round cookie, the person's token dropped; writers polled with the installation token; __Host- session cookies hashed in the DB; a guard of its own (amends adr-20261014-local-server-access-guard)
reviewed_at: 2026-11-19
---
# The team server signs people in through its own public GitHub App, behind a guard of its own

## Context

The team server (adr-20261117-a-team-server-keeps-a-reflection-of-its-own) is on the internet,
where the local Jig UI's guard — 127.0.0.1, a token printed in the terminal
(adr-20261014-local-server-access-guard) — does not apply. Spec `team-board` decided how people
reach it: a GitHub App with Metadata (read) only signs a person in and tells whether they may write
to a repository, without access to code; it is public, and the server keeps its own allow-list;
people are known by their forge id, their token used at sign-in and dropped; taking part means
write access, polled with the App's installation token (`.ai/specs/team-board/spec.md`,
`research.md`, the maintainer 2026-11-16). Task `team-server` built it; its design was approved on
2026-11-16, and its review hardened the sign-in (2026-11-17).

## Decision

- **Each server registers its own App** through GitHub's manifest flow at setup: public, asking for
  Metadata (read) only and for no events (installation events reach every App), its URLs on the
  public address, the webhook active only off `localhost`, named `Jig UI <8 random>`.
- **The setup is opened by a code in the log.** 128 random bits, in memory only, new at every
  start and printed at each start until the server has an admin. A correct code opens a setup for
  ten minutes in a `__Host-` cookie; creating the App needs that setup and no App yet; the admin's
  sign-in needs that setup and no admin yet, and spends the code. A setup whose admin sign-in did
  not finish is taken up again with the code.
- **An installation does nothing until the admin approves it.** The store keeps no repository of an
  installation that is not approved — the guard is in its SQL — and nobody signs in through one.
- **Sign-in is OAuth with `state` and PKCE S256**, the state also a `__Host-` cookie of the browser
  that started the round: GitHub's answer is taken in that browser only, once, within ten minutes.
  A linked account lands only on the person whose session began the link and is still signed in. The
  person's token is used for that sign-in — who they are, which approved installations they reach,
  where they may push — and dropped. A person with nothing on the server is told so, gets no
  session, and nothing of them is kept.
- **Who may write** is `GET /repos/{owner}/{repo}/collaborators?permission=push` with the
  installation token, every five minutes, with ETags; one repository failing keeps its last answer.
  Webhooks, checked by their HMAC, hide a removed repository or installation at once and end the
  sessions of a person who revoked the App.
- **Sessions** are a random id in `__Host-jig-ui-team` (HttpOnly, Secure, SameSite=Lax, Path=/, 30
  days); the database keeps only its SHA-256.
- **A second guard**, `teamAccess` in `server/team/access.ts`, beside `publicOnly`: `Host` must be
  the public address's, an `Origin` must be its origin, and a write must name one, except GitHub's
  webhook, held to its signature instead; bodies past a megabyte are refused before the guard reads
  them. It amends adr-20261014-local-server-access-guard for this mode: the team server binds
  `JIG_UI_HOST`, `0.0.0.0` by default, behind a proxy with HTTPS.

## Alternatives

- **An OAuth App.** It needs the `repo` scope to see write access to private repositories — full
  access to a person's code — and organisations block third-party OAuth apps until an admin approves
  them.
- **A private App owned by the organisation.** Only its members could sign in, but it installs on
  that organisation alone, so no personal repository could be on the server.
- **One App shared by several servers.** One private key in several hands, and one webhook address.
- **The Members (read) permission** for membership webhooks. An organisation permission: only an
  owner could install the App, never a repository admin on their own repositories.
- **Keeping the person's token** to ask about write access on each request. A credential of every
  person at rest, where the installation token answers the same question.
- **A stateless signed session cookie.** It cannot be revoked before it expires, where a revoked App
  or lost access must end the session.
- **An admin named in the environment, or a server that listens on localhost until set up.** The
  App is created before anyone signs in, so the first would still let anyone send the manifest; the
  second asks for an SSH tunnel behind a proxy.

## Consequences

- The database holds the App's private key and client secret and no person's token;
  `temp_clone_token`, which GitHub may add to a repository, is dropped by the response schemas.
- Without webhooks — a server on `localhost` — a change reaches the server by the next poll, and a
  revoked authorization ends no session until it expires. *(An installation the admin makes is read as
  GitHub sends them back from it, task `team-server-nits`, 2026-11-19.)*
- What a real App answers where GitHub's documentation is silent stays open (`team-board`'s open
  questions): the team server was built against a fake GitHub only, its live run dropped on the
  maintainer's word (2026-11-17). If `permission=push` means push alone, an admin misses a project;
  no stranger gains one.
- One admin, the person who set the server up; more admins are added when someone asks.
