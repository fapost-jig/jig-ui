# Research — a GitHub App for sign-in and the write-access check

Question: can one GitHub App that holds only the Metadata (read) repository permission sign a person
in and tell the server whether that person may write to a repository, with no access to code?
Checked 2026-11-16 against GitHub's documentation.

## Verdict

The assumption holds, with one correction the spec has to take in.

- **Sign-in works.** The web application flow gives a user access token, and `GET /user` gives the
  person's durable `id` and current `login`.
- **The write check works with Metadata (read) alone,** in two documented ways:
  - with the person's user access token, `GET /user/installations/{installation_id}/repositories`
    lists the repositories with `permissions.push`;
  - with the App's own installation token, `GET /repos/{owner}/{repo}/collaborators/{username}/permission`
    for one person, or `GET /repos/{owner}/{repo}/collaborators?permission=push` for every writer of a
    repository.

  Both work for private and organisation repositories, as long as the App's installation covers the
  repository. Git access needs the Contents permission, so the App cannot read code.
- **The correction: the App must be public.** A private App installs only on the account that owns
  it, so "one App on a person's account and on the organisation" needs a public App. Any GitHub user
  can install and authorise a public App, so the server has to keep its own allow-list of the
  installations and people it accepts.
- **Webhooks do not report permission changes.** With Metadata alone the App cannot subscribe to
  `member`, `membership`, `organization` or `team`; all four need the Members organisation permission.
  So "re-checked within minutes" means polling.

## Findings

### 1. Sign-in — yes

**Verdict: yes.** The App signs a person in through the OAuth web flow. The flow returns an expiring
user access token, with a refresh token that changes every time it is used.

- The flow sends the person to `https://github.com/login/oauth/authorize` with `client_id`, plus
  `redirect_uri`, `state`, and PKCE `code_challenge`/`code_challenge_method` (recommended). The
  returned `code` is then exchanged by `POST https://github.com/login/oauth/access_token` with
  `client_id`, `client_secret`, `code` and `code_verifier`. Source:
  <https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app>,
  "Using the web application flow to generate a user access token".
- There are no scopes to ask for: "To receive an expiring user access token and a refresh token for
  this authorization, set this value to `offline_access`. No other scopes are supported for GitHub
  Apps." (same page, `scope` parameter).
- A person can sign in without installing anything: "An app does not need to be installed in order
  for a user to authorize the app." Source:
  <https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-with-a-github-app-on-behalf-of-a-user>.
- **Identity.** `GET /user` returns the signed-in person. GitHub's "Login with GitHub" tutorial calls
  `https://api.github.com/user` with the token and reads `login` from the answer
  (<https://docs.github.com/en/apps/creating-github-apps/writing-code-for-a-github-app/building-a-login-with-github-button-with-a-github-app>).
  The OpenAPI schemas `public-user` and `private-user` mark `id`, `node_id` and `login` as required
  (github/rest-api-description, `descriptions/api.github.com/api.github.com.json`). `GET /user` is in
  the list of endpoints that work with user access tokens and needs no App permission: it is absent
  from the permissions table
  (<https://docs.github.com/en/rest/authentication/endpoints-available-for-github-app-user-access-tokens>).
- **Key people by `id`, not `login`.** `GET /user/{account_id}` "takes their durable user ID instead
  of their login, which can change over time." Source:
  <https://docs.github.com/en/rest/users/users#get-a-user-using-their-id>. It works with both user and
  installation tokens.
- **Expiry.** "By default, the user access token expires after 8 hours." `expires_in` "will always be
  `28800`" and `refresh_token_expires_in` "will always be `15897600` (6 months)." (generating page,
  "About user access tokens" and the response table). Expiry is on unless you opt out: "When you
  create your app, expiration of user access tokens is enabled unless you opt out." Source:
  <https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens>,
  "Configuring your app to use user access tokens that expire".
- **Refresh.** `POST https://github.com/login/oauth/access_token` with `client_id`, `client_secret`,
  `grant_type=refresh_token` and `refresh_token`. "Once you use a refresh token, that refresh token and
  the old user access token will no longer work." (refreshing page, "Refreshing a user access token
  with a refresh token"). A bad or expired refresh token returns `bad_refresh_token`, and "you must
  restart the web application flow or device flow" (generating page, "Bad refresh token").
- **Revocation.** The App always receives `github_app_authorization` when a person revokes it: "If
  your GitHub App continues to use a revoked access token, it will receive the 401 Bad Credentials
  error." Source: <https://docs.github.com/en/webhooks/webhook-events-and-payloads#github_app_authorization>.

### 2. Write access with Metadata (read) only — yes

**Verdict: yes.** Every endpoint below sits under "Repository permissions for 'Metadata'" at `read`
access in <https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps>.

| Endpoint | Token | App permission | What it tells |
|---|---|---|---|
| `GET /user/installations` | user only | none listed | the App's installations this person can reach |
| `GET /user/installations/{installation_id}/repositories` | user only | Metadata read | each repository with `permissions.{admin,maintain,push,triage,pull}` for this person |
| `GET /repos/{owner}/{repo}/collaborators/{username}/permission` | user and installation | Metadata read | `permission` = `admin` / `write` / `read` / `none`, plus `role_name` |
| `GET /repos/{owner}/{repo}/collaborators?permission=push` | user and installation | Metadata read | every collaborator with push, with a `permissions` hash each |
| `GET /repos/{owner}/{repo}` | user and installation | Metadata read | `id`, `node_id`, `fork`, `parent`, `source`, `permissions` |

- **User token, per installation.** The docs say: "List repositories that the authenticated user has
  explicit permission (:read, :write, or :admin) to access for an installation. The authenticated user
  has explicit permission to access repositories they own, repositories where they are a
  collaborator, and repositories that they can access through an organization membership. The access
  the user has to each repository is included in the hash under the permissions key." Source:
  <https://docs.github.com/en/rest/apps/installations#list-repositories-accessible-to-the-user-access-token>.
  The schema gives each repository `permissions` with `admin`, `pull` and `push` required and
  `triage` and `maintain` optional (same section). The word "explicit" means a public repository the
  person merely reads is not listed, which matches "write, never read".
- **Installation token, per person.** The docs say: "The `permission` attribute provides the legacy
  base roles of `admin`, `write`, `read`, and `none`, where the `maintain` role is mapped to `write`
  and the `triage` role is mapped to `read`. … The calculated permissions are the highest role
  assigned to the collaborator after considering all sources of grants, including: repo, teams,
  organization, and enterprise." Source:
  <https://docs.github.com/en/rest/collaborators/collaborators#get-repository-permissions-for-a-user>.
  It takes a `username` (login), so the server has to map `id` to the current login first (§1).
  The docs list only `200` and `404` and do not say what a person with no role gets back; test it.
- **Installation token, per repository.** `GET /repos/{owner}/{repo}/collaborators` takes
  `permission` ("Filter collaborators by the permissions they have on the repository", one of
  `pull`, `triage`, `moderate`, `push`, `maintain`, `admin`). For organisation repositories the list
  "includes outside collaborators, organization members that are direct collaborators, organization
  members with access through team memberships, organization members with access through default
  organization permissions, and organization owners." Source:
  <https://docs.github.com/en/rest/collaborators/collaborators#list-repository-collaborators>.
  Two things are not stated: whether `permission=push` means "at least push" (the `permissions` hash
  in each entry settles it either way), and how the sentence "The authenticated user must have write,
  maintain, or admin privileges on the repository" applies to an installation token. The
  permissions table lists the endpoint for installation tokens, so test it.
- **`GET /repos/{owner}/{repo}` with a user token: partly.** It needs Metadata (read), and its
  `full-repository` schema has `permissions` (OpenAPI). The docs do not say whose permissions those
  are on this endpoint. They also do not say it refuses a repository outside the App's
  installations: a user token can "read public resources" (§7). So it is not a gate by itself.
- **Private and organisation repositories: yes, inside the installation.** "The app can only access
  resources that the user has access to … The app can only access resources that it has permission
  to access … The app can only access resources in an account where it is installed. If your app is
  only installed on a user's personal account, it cannot access resources in an organization that
  the user is a member of unless the app is also installed on that organization." Source: "Authenticating
  on behalf of a user" page above. An installation token "only depends on the app's permissions"
  (<https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app>),
  which here means the repositories its installation covers.
- **The intersection.** "A GitHub App user access token only has permissions that both the user and
  the app have. For example, if the app was granted permission to write the contents of a
  repository, but the user can only read the contents, then the user access token can only read the
  contents." (generating page, "About user access tokens"). The repositories endpoint above reports the
  person's own access ("the access the user has"), not the token's.
- **No code.** "If you want your app to use an installation or user access token to authenticate for
  HTTP-based Git access, you should request the 'Contents' repository permission." (choosing-permissions
  page, "Choosing permissions for Git access"). GitHub's older docs describe Metadata as a set of
  "read-only endpoints with metadata for various resources. These endpoints do not leak sensitive
  private repository information."
  (<https://docs.github.com/en/enterprise-server@3.2/rest/overview/permissions-required-for-github-apps>,
  "Metadata"; the current page no longer carries that paragraph).
- **One gap: `temp_clone_token`.** `GET /repos/{owner}/{repo}` may return `temp_clone_token`: "When
  present and non-empty, temp_clone_token is a temporary credential for read-only Git access to this
  repository. It expires five minutes after generation … Treat this value as sensitive and avoid
  recording it in logs." Source: <https://docs.github.com/en/rest/repos/repos#get-a-repository>. The
  docs do not say when it is issued, or whether a Metadata-only App gets one. Not confirmed either
  way; test it, and never store or log that field.

### 3. Organisations: who installs, OAuth restrictions, SAML SSO — yes, with conditions

**Verdict: yes for installing and for OAuth restrictions. Partly for SAML SSO, which can hide
organisation repositories from a user token.**

- **Who installs.** "Anyone can install GitHub Apps on their personal account. Organization owners can
  install GitHub Apps on their organization. Repository admins can install GitHub Apps in the
  organization that owns the repository if the app does not request any organization permissions or
  the 'Repository administration' permission. When doing so, they can only install the app with
  access to the repositories that they administer." Source:
  <https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party>,
  "Requirements to install a GitHub App". A Metadata-only App qualifies, unless the owner has
  restricted installation to owners
  (<https://docs.github.com/en/organizations/managing-programmatic-access-to-your-organization/limiting-oauth-app-and-github-app-access-requests-and-installations>,
  "About GitHub App installation restrictions").
- **Members can request.** "Organization members and outside collaborators that cannot install an app
  on the organization can still select the organization during the install process. Instead of
  installing the app, GitHub will send a notification to the organization owner" (same install page).
  See also <https://docs.github.com/en/apps/using-github-apps/requesting-a-github-app-from-your-organization-owner>.
  "By default, app access requests are enabled." (limiting page, "About app access requests").
- **OAuth app access restrictions do not govern GitHub Apps.** The limiting page separates the two:
  "For GitHub Apps this is a request for installation, which grants the app access to your
  organization directly. For OAuth apps this is a request to allow the app through the [OAuth app
  access restrictions]". The restriction itself blocks OAuth apps, and "When you create a new
  organization, OAuth app access restrictions are enabled by default." Source:
  <https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data/about-oauth-app-access-restrictions>.
  That supports the spec's rejection of an OAuth app.
- **SAML SSO and user tokens.** "You must have an active SSO session each time you authorize an OAuth
  app or GitHub App in order to access an organization that uses or enforces SSO. If you do not have an
  active session for an organization that requires SSO when you sign into the app, the app will be
  unable to access that organization." Source:
  <https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-single-sign-on/about-authentication-with-single-sign-on>,
  "About OAuth apps, GitHub Apps, and SSO". And: "The SSO credential authorization is tied to the
  specific sign-in session with the app. If you plan to sign in to the app again on another device or
  after your SSO sessions expire, you will need to start new SSO sessions before you sign in". Source:
  <https://docs.github.com/en/enterprise-cloud@latest/apps/using-github-apps/saml-and-github-apps>,
  "Authorizing GitHub Apps for users". The fix is to open `https://github.com/orgs/ORG/sso`, revoke
  the App and sign in again (same page).
- **SAML SSO and installation tokens: not stated.** No page says SSO limits an installation token.
  Every SSO page found speaks of authorising, installing or requesting an App. If installation tokens
  are not limited by SSO, the installation-token check (§2) does not depend on whether a person
  had an SSO session when they signed in. Not confirmed in GitHub's docs.

### 4. The app manifest flow — yes

**Verdict: yes, for a personal account and for an organisation.** The exchange returns everything
the server needs. The docs neither show nor forbid a Metadata-only manifest.

- **Where.** "a `POST` request to `https://github.com/settings/apps/new` for a personal account or
  `https://github.com/organizations/ORGANIZATION/settings/apps/new` for an organization account". The
  manifest goes as JSON in a `manifest` field, with an optional `state`. Source:
  <https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest>,
  "1. You redirect people to GitHub to register a new GitHub App".
- **Who, for an organisation.** An App can be registered "Under an **organization you own**" or under
  one "that has granted you permission to manage all its apps" (an App manager). Source:
  <https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app>,
  "About registering GitHub Apps".
- **What comes back.** GitHub redirects to `redirect_url` with a `code`. Then
  `POST /app-manifests/{code}/conversions` within one hour ("You must complete all three steps in the
  GitHub App Manifest flow within one hour."). The 201 response is the App object plus `client_id`,
  `client_secret`, `webhook_secret` (nullable) and `pem`, all four required. Sources: the manifest
  page, "3. You exchange the temporary code"; <https://docs.github.com/en/rest/apps/apps#create-a-github-app-from-a-manifest>;
  OpenAPI `/app-manifests/{code}/conversions`. The App `id` comes in the `integration` part of the
  response.
- **Permissions in the manifest.** `default_permissions` is "The set of permissions needed by the
  GitHub App", keyed by permission name with `read`/`write` values (manifest parameters table). The
  docs' example uses `issues` and `checks`; none shows `{"metadata": "read"}` alone. Not confirmed;
  try it once. Older docs: "GitHub Apps have the Read-only metadata permission by default." (GHES 3.2
  page above).
- **Other manifest fields that matter.**
  - `public` ("Set to `true` when your GitHub App is available to the public or `false` when it is
    only accessible to the owner of the app"); see §7.
  - `callback_urls` (up to 10).
  - `hook_attributes.url`.
  - `request_oauth_on_install`.

  The manifest has no field for token expiry or the device flow, so expiry stays on by default (§1).
- **The name.** "The name must be unique across GitHub" and "cannot be longer than 34 characters"
  (registering page, step 6). The person can edit the name during the manifest flow. Many
  self-hosted servers will collide on one default name.

### 5. Repository identity and forks — partly

**Verdict: partly.** The API gives `id` and `node_id`, and a fork's `parent` and `source`. The docs
do not say in so many words that `id` survives a rename or a transfer.

- **Forks.** "The parent and source objects are present when the repository is a fork. parent is the
  repository this repository was forked from, source is the ultimate source for the network." Source:
  <https://docs.github.com/en/rest/repos/repos#get-a-repository>.
- **Renames.** "When you rename a repository, all existing information, with the exception of project
  site URLs, is automatically redirected to the new name"
  (<https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository>).
  The REST API answers `301` for a moved repository: "You should repeat your request to the URL
  specified by the `location` header." (<https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api>,
  "Follow redirects").
- **Transfers.** "If the transferred repository is a fork, then it remains associated with the
  upstream repository." (<https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository>).
  The `repository` webhook has `renamed` and `transferred` actions with a `changes` object. But
  `transferred` "is only sent to the account where the ownership is transferred. To receive the
  repository.transferred event, the new owner account must have the GitHub App installed"
  (<https://docs.github.com/en/webhooks/webhook-events-and-payloads#repository>).
- **`id` stability: not confirmed in GitHub's docs.** The webhook payloads and the redirect behaviour
  are consistent with a stable `id`, but no page states it. The API has no documented
  `GET /repositories/{id}`; the OpenAPI description has no such path either.

### 6. Rate limits and webhooks — partly

**Verdict: partly.** Polling every few minutes fits the limits. Webhooks cover installation changes
and revocation, but not permission changes for a Metadata-only App.

- **User tokens.** "Primary rate limits for GitHub App user access tokens … are dictated by the
  primary rate limits for the authenticated user. This rate limit is combined with any requests that
  another GitHub App or OAuth app makes on that user's behalf and any requests that the user makes with
  a personal access token." That limit is "5,000 requests per hour", or 15,000 when the App is owned
  by a GitHub Enterprise Cloud organisation. Source:
  <https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api>, "Primary rate limit
  for GitHub App installations" and "… for authenticated users".
- **Installation tokens.** "the installation's minimum rate limit of 5,000 requests per hour … Installations that have more than 20 repositories receive another 50
  requests per hour for each repository. Installations that are on an organization that have more than
  20 users receive another 50 requests per hour for each user. The rate limit cannot increase beyond
  12,500 requests per hour." On a GitHub Enterprise Cloud organisation the limit is 15,000. Same page.
  Installation tokens "expire after 1 hour"
  (<https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app>).
- **Secondary limits.** No more than 100 concurrent requests, and no more than 900 points per minute
  per REST endpoint. Also: "No more than 2,000 OAuth access token requests per hour are allowed for
  GitHub Apps and OAuth apps", which counts refreshes (rate-limits page, "About secondary rate limits").
- **Conditional requests are free when nothing changed.** "Making a conditional request does not
  count against your primary rate limit if a `304` response is returned". GitHub's advice is
  "You should subscribe to webhook events instead of polling the API" (best-practices page, "Avoid
  polling", "Use conditional requests").
- **What that means for a five-minute check** (12 polls an hour):
  - One user-token call per person and installation costs 12 requests an hour per pair, from that
    person's budget.
  - One `collaborators?permission=push` call per repository costs 12 requests an hour per
    repository; 30 repositories make 360 of the installation's 5,000.
  - Per-person `…/permission` calls grow as repositories × people: 30 × 20 at five minutes is 7,200
    an hour, over the floor unless most come back `304`.
- **Webhooks a Metadata-only App gets.**
  - `installation`: "All GitHub Apps receive this event by default"; actions `created`, `deleted`,
    `new_permissions_accepted`, `suspend`, `unsuspend`.
  - `installation_repositories`: `added`, `removed`.
  - `installation_target`: the account was renamed.
  - `github_app_authorization`: a person revoked the App.
  - `repository`: needs the "Metadata" repository permission; actions `renamed`, `transferred`,
    `privatized`, `publicized`, `archived`… Its `deleted` action is not sent: "GitHub Apps and
    repository webhooks will not receive this event."

  Source: <https://docs.github.com/en/webhooks/webhook-events-and-payloads>, each event's section.
- **Webhooks it does not get.** For `member` ("Permissions were changed for a collaborator on a
  repository", with `changes`), `membership` (team membership), `organization` (`member_added`,
  `member_removed`) and `team` (`added_to_repository`, `removed_from_repository`), the docs say: "To
  subscribe to this event, a GitHub App must have at least read-level access for the 'Members'
  organization permission." (same page). Asking for Members (read) is an organisation permission. A
  repository admin could then no longer install the App alone; an organisation owner would have to
  (§3). For a personal account installation, the docs do not say whether `member` arrives at all.
- **Webhooks need a reachable server.** A self-hosted server behind a company firewall gets no
  deliveries. The webhook can be switched off: "if you do not want your app to receive webhook events,
  deselect **Active**." (registering page, step 15). Polling then has to carry everything.

### 7. Contradictions with the spec's decisions

1. **"One App is installed on several accounts" needs a public App.** "If you set your GitHub App
   registration to private, it can only be installed on the account that owns the app. Only members of
   the organization that owns it can authorize it." And: "If you set your GitHub App registration to
   public, any user on GitHub can install it and authorize it." Source:
   <https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/making-a-github-app-public-or-private>,
   "About visibility for GitHub Apps". Once a public App has other installations it cannot go back:
   "Public apps cannot be made private if they're installed on other accounts."
   (<https://docs.github.com/en/apps/maintaining-github-apps/modifying-a-github-app-registration>,
   "Changing the visibility of a GitHub App"). The spec's rule "a server receives only projects whose
   repositories have its App installed" is therefore not an access control: a stranger can install
   the server's public App and sync.
2. **"An organisation admin confirms" mixes two steps.** Registering the App under an organisation
   needs an owner or an App manager (§4). Installing it on the organisation needs an owner, or a
   repository admin for their own repositories (§3). App managers cannot install: "The GitHub App
   manager role does not grant recipients access to install and uninstall GitHub Apps on an
   organization." (<https://docs.github.com/en/organizations/managing-programmatic-access-to-your-organization/adding-and-removing-github-app-managers-in-your-organization>).
3. **"Re-checked within minutes" cannot lean on webhooks** with Metadata only (§6). It is polling, or
   a Members (read) permission that takes away the repository admin's self-service install.
4. **"A task's owner is the forge login its clone pushes as"**: logins change (§1). The owner should
   be the user `id`, with the login shown.
5. **SAML SSO can make write access look lost.** On a user-token check, an organisation behind SSO
   disappears if the person signed in without an SSO session, or signs in again on another device
   after their sessions expired (§3). That shows up as "project not found", which the spec names as a
   failure mode.
6. **"Tasks from a fork belong to the repository it was forked from"** meets "taking part means write
   access". The docs do not contradict either rule, but together they admit only fork users who also
   have write on the upstream. The docs also leave open which upstream counts: `parent` (one step up)
   or `source` (the root of the network) (§5).

Nothing in the docs contradicts the rest: sign-in through the App, Metadata only, the manifest flow,
one App per server (an App has one webhook URL), and the forge `id` as the project key.

## What this changes in the spec

- **Confirmed.**
  - Sign-in through a GitHub App: web flow, `GET /user` for `id` and `login`.
  - The App needs only Metadata (read); Git access needs Contents, which it does not ask for.
  - Rejecting the OAuth app: `repo` "Grants full access to public and private repositories including
    read and write access to code"
    (<https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps>), and
    OAuth app access restrictions are on by default for new organisations.
  - Creating the App through the manifest flow, for a personal account or an organisation.
  - One App per server.
  - A project keyed by forge `id`, with the fork's `parent`/`source` available.
  - A repository admin can install a Metadata-only App on their own organisation repositories without
    an owner, and members can request it.
- **Needs changing.**
  - **The App is public** (`"public": true` in the manifest). Add a server-side allow-list: the server
    accepts installations only from accounts its admin approved, and people only after sign-in on such
    an installation. "Has the App installed" stops being the boundary on its own. The alternative is a
    private App owned by the organisation. Only its members can authorise it, and it installs only on
    the organisation, which means a person's personal repositories cannot be on that server. Decide
    between the two.
  - **Name the check.** Re-check through the installation token:
    `GET /repos/{owner}/{repo}/collaborators?permission=push` per repository, with ETags, every few
    minutes. Use `…/collaborators/{username}/permission` for a single answer. This needs no stored
    user tokens, so the server can drop each user token after sign-in. A leaked database then holds no
    GitHub credentials of its people. Keep `GET /user/installations/{id}/repositories` with the user
    token for the moment of sign-in, to show a person their projects.
  - **Webhooks speed things up but are not the check:**
    - `installation` and `installation_repositories` hide a project at once when the App loses it;
    - `github_app_authorization` signs the person out;
    - `repository` `renamed`/`transferred`/`privatized` update the project.

    Collaborator and team changes come from polling. Say so, or add Members (read) and accept that
    an organisation owner must install.
  - **People are keyed by forge user `id`; logins are display only.** `github.account` in Jig is a
    login, so the server resolves it to an `id` once and follows renames with `GET /user/{account_id}`.
  - **Name the fork rule's upstream:** `parent` or `source`.
  - **The manifest's default App name gets a unique suffix,** since App names are global and 34
    characters at most.
- **New open questions** (each one a short test against a real App):
  - Does a Metadata-only manifest (`default_permissions: {"metadata": "read"}`) register?
  - Does `GET /repos/{owner}/{repo}` hand a Metadata-only App a `temp_clone_token` for a private
    repository? If it does, "no access to code" is not quite true, and that field must never be stored.
  - Does `collaborators?permission=push` with an installation token return "push or higher" on
    personal and organisation repositories? What does `…/permission` return for a non-collaborator
    on a public repository?
  - Does SAML SSO limit installation tokens? The docs speak only of user authorisation.
  - Does a repository's `id` survive a rename and a transfer? Expected yes; not stated in the docs.
  - How does an organisation behind SSO see its first sign-in? The person must start an SSO session
    before signing in, so the team's first-run guide (already an open question in the spec) should
    say so.

## Sources

- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-user-access-token-for-a-github-app
- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/refreshing-user-access-tokens
- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/authenticating-with-a-github-app-on-behalf-of-a-user
- https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app
- https://docs.github.com/en/apps/creating-github-apps/writing-code-for-a-github-app/building-a-login-with-github-button-with-a-github-app
- https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/registering-a-github-app
- https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/choosing-permissions-for-a-github-app
- https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/making-a-github-app-public-or-private
- https://docs.github.com/en/apps/maintaining-github-apps/modifying-a-github-app-registration
- https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-from-a-manifest
- https://docs.github.com/en/apps/using-github-apps/installing-a-github-app-from-a-third-party
- https://docs.github.com/en/apps/using-github-apps/requesting-a-github-app-from-your-organization-owner
- https://docs.github.com/en/apps/using-github-apps/authorizing-github-apps
- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/differences-between-github-apps-and-oauth-apps
- https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps
- https://docs.github.com/en/rest/apps/installations#list-repositories-accessible-to-the-user-access-token
- https://docs.github.com/en/rest/apps/apps#create-a-github-app-from-a-manifest
- https://docs.github.com/en/rest/collaborators/collaborators#get-repository-permissions-for-a-user
- https://docs.github.com/en/rest/collaborators/collaborators#list-repository-collaborators
- https://docs.github.com/en/rest/repos/repos#get-a-repository
- https://docs.github.com/en/rest/users/users#get-a-user-using-their-id
- https://docs.github.com/en/rest/authentication/permissions-required-for-github-apps
- https://docs.github.com/en/rest/authentication/endpoints-available-for-github-app-user-access-tokens
- https://docs.github.com/en/rest/authentication/endpoints-available-for-github-app-installation-access-tokens
- https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- https://docs.github.com/en/rest/using-the-rest-api/best-practices-for-using-the-rest-api
- https://docs.github.com/en/webhooks/webhook-events-and-payloads
- https://docs.github.com/en/organizations/managing-oauth-access-to-your-organizations-data/about-oauth-app-access-restrictions
- https://docs.github.com/en/organizations/managing-programmatic-access-to-your-organization/limiting-oauth-app-and-github-app-access-requests-and-installations
- https://docs.github.com/en/organizations/managing-programmatic-access-to-your-organization/adding-and-removing-github-app-managers-in-your-organization
- https://docs.github.com/en/enterprise-cloud@latest/apps/using-github-apps/saml-and-github-apps
- https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-single-sign-on/about-authentication-with-single-sign-on
- https://docs.github.com/en/enterprise-cloud@latest/authentication/authenticating-with-single-sign-on/authorizing-an-app-for-single-sign-on
- https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository
- https://docs.github.com/en/repositories/creating-and-managing-repositories/transferring-a-repository
- https://docs.github.com/en/enterprise-server@3.2/rest/overview/permissions-required-for-github-apps (older version; Metadata paragraph)
- https://github.com/github/rest-api-description — `descriptions/api.github.com/api.github.com.json` (schemas `full-repository`, `public-user`, `private-user`, `repository-collaborator-permission`; path `/app-manifests/{code}/conversions`)
