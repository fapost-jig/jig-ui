---
id: convention-access-guard
type: convention
status: active
domains: []
paths:
  - "server/http/**"
  - server/team/access.ts
summary: MAY/MUST/MUST NOT for the replaceable access guards — the local one in server/http (the token) and the team server's in server/team/access.ts (public Host and Origin, setup, sessions, the webhook's HMAC); no route decides access
reviewed_at: 2026-11-20
---
# AccessGuard — who may use the server

## Practice

```
AccessGuard (server/http/access.ts)

MAY:      admit or refuse a request; exchange a credential for a session cookie;
          answer 401/403 itself
MUST:     run before every route, static files included; refuse every /api/* request it
          cannot attribute to the user; compare secrets in constant time
MUST NOT: read or log the credential anywhere but the comparison; let a route decide access
          itself; widen the bind address (that is main.ts's refusal, tied to which guard is in place)
Why:      a hosted Jig UI swaps the guard, not the routes; a route that checks access on its
          own survives the swap and keeps the old rule.
```

`secureHeaders` (no HSTS: the server is plain http on 127.0.0.1) runs before the guard so its
refusals carry the headers too; it sets headers and decides no access.

## Example

The local guard today is two middlewares applied to every route in `createApp`: `localOnly`
refuses a foreign `Host` or `Origin` (403); `tokenAccess` swaps `/?token=<t>` for a cookie named
`jig-ui-<port>` (HttpOnly, SameSite=Strict — browsers do not separate cookies by port) and
redirects to `/`, and answers 401 to any `/api/*` request without that cookie. The built page and
its assets need no token: they carry no data. A second start probes the running instance with the
same cookie, read from `instance.json`, rather than with a credential of its own.

There is no Vite dev server: its proxy rewrites `Host`, which the guard refuses, and a hole for it
would be a second rule. `npm run dev` rebuilds and restarts instead; the new token means opening
the freshly printed link.

## The team server's guard

`jig-ui team-server` has a guard of its own, two middlewares in `server/team/access.ts` applied to
every route of `createTeamApp`, after `secureHeaders` and a one-megabyte body limit:

```
TeamAccess (server/team/access.ts: publicOnly, teamAccess)

MAY:      admit or refuse a request; set and clear the setup and session cookies (`__Host-`,
          Secure, HttpOnly, SameSite=Lax); answer 401/403/404 itself, or, to a navigation —
          a GET of `/auth/*` or `/setup/done` —, send the browser back to `/?problem=<code>`
MUST:     run before every route, the page included; refuse a Host not the public address's, an
          Origin not its origin, and a write naming no origin but /webhook/github, which it holds
          to its HMAC; open the setup only while there is no admin, the App's creation only while
          there is no App; ask a session of every /api/team/* call but the state and the setup
          (the code, then the setup's cookie), and the admin's of /api/team/admin/*; compare
          secrets in constant time
MUST NOT: read or log a credential anywhere but the comparison; let a route decide who may reach
          it; share code with server/http's guard (the import boundary in eslint.config.js)
Why:      the server is on the internet; one place says who reaches what, as for the local guard.
```

What a sign-in proves is the callback's to check, not the guard's: `/auth/callback` takes GitHub's
answer only for a round this browser started (`Secrets.takeRound` against its cookie), links an
account only to the person whose session began the link, and makes the admin only through a setup
the code opened while there is no admin. These check a credential's round, not access to a route.
`/setup/done` likewise takes GitHub's answer to the manifest only for the setup this browser opened
(`Secrets.takeManifestState`). A refusal of a navigation — the guard's, `/setup/done`'s or `/auth/callback`'s — lands on the page with its code in `?problem=`,
which the page says in words (`problems` in `web/team/api.ts`): the person sees why and the way on, never
the API's JSON. Each refusal names its own condition, so its words fit: `/setup/done` once the admin is there is
`set-up`, with the App and no admin yet `app-exists`, without this browser's setup `bad-state`; the admin's sign-in once
there is an admin `set-up`, without the setup `no-setup`. In the guard, `refuse` sends a navigation back to the page and
answers anything else with `jsonRefusal`.

## Rationale

adr-20261014-local-server-access-guard, adr-20261014-project-source-port-keeps-hosting-open;
the boundary was approved in task `walking-skeleton`'s design on 2026-10-17. The team server's
guard: adr-20261117-the-team-server-signs-people-in-through-its-own-public-github-app, task
`team-server`.
