---
id: adr-20261125-a-specs-documents-are-shown-as-written
type: adr
status: accepted
date: 2026-11-25
domains: []
paths:
  - server/jig/client.ts
  - server/source/local.ts
  - server/http/app.ts
  - web/components/DocumentDialog.vue
  - web/components/SpecBoard.vue
  - web/lib/documents.ts
summary: A spec's summary and documents read through Jig 0.48.0 on demand, shown as written with their paths, in the page's generic DocumentDialog — amends the path invariant, convention-project-source and features/specs
reviewed_at: 2026-11-25
---
# A spec's summary and documents are shown as their authors wrote them, read through Jig 0.48.0, in a dialog

## Context

The Specs view showed a spec's title and roadmap but nothing of what the spec is about. Phase 3 of
the spec `specs-view` (`.ai/specs/specs-view/`, decided with the maintainer on 2026-11-18) asked for
a short description under the spec's title and its documents one click away, through Jig's contract
only. Jig 0.48.0 gives both: `jig spec list --json` carries each spec's `summary` (the `Summary:`
line of `spec.md`), and `jig spec read <id> spec|roadmap --json` a document's text with `lossy`.
A spec is free text, like a task's documents, and names paths (`web/views/BoardView.vue`,
`.ai/specs/<id>/`); the path invariant in RULES, convention-project-source's MUST NOT and
features/specs' "no ref and no path reach the page" allowed only a closed list of exceptions.
On 2026-11-25 the maintainer asked that every document the page shows open in a modal dialog.
Task `spec-words-on-page`; the maintainer confirmed showing a spec's summary and documents as written,
paths included, on 2026-11-25 (in the session, after the review asked for it).

## Decision

- **Amends** the path invariant of RULES, the MUST NOT of convention-project-source and features/specs'
  "no ref and no path reach the page", as adr-20261030-a-task-document-is-shown-as-written did for a
  task's documents: a spec's `summary` and a spec's document reach the page as their authors wrote
  them, a path in them included. The API names no path of its own: Jig's `path` and `ref` are dropped
  in `server/jig/client.ts`, and a refusal carries Jig's code only.
- The summary comes with the specs' read (`jig spec list`), `null` below Jig 0.48.0 or without a
  `Summary:` line, and stands under the spec's title.
- A document is read on demand — `GET /api/projects/:id/specs/:spec/documents/:kind`, `kind` `spec`
  or `roadmap` → `ProjectSource.specText` → `readSpecText` — never with the board's read. Jig runs
  only for a spec id Jig itself listed; below 0.48.0 the page offers no buttons (`canRead`).
- The document is rendered as a task's documents are (`web/lib/markdown.ts`: marked, then DOMPurify)
  in a modal dialog (`web/components/DocumentDialog.vue`, the project's shadcn `Dialog`), one at a
  time; the dialog is generic, for every document the page shows.

## Alternatives

- **The server reads `.ai/specs/<id>/*.md` itself** — breaks adr-20261014-jig-ui-is-an-optional-layer-over-jig;
  Jig knows the epic's ref and the files' encoding.
- **Strip paths from the text** — a spec without its paths says less, and a path in prose cannot be
  told from other words reliably; the task documents' precedent shows them as written.
- **Open the document inline under the spec's head** — built first; the maintainer chose a dialog for
  every document instead, so one reading surface serves the whole page.

## Consequences

- A spec's text is on the page as written, paths included — the same exposure task documents have.
- The dialog is the place a later task moves a task's documents and knowledge texts to.
- A roadmap read through `jig spec read` leaves out edits waiting on the spec's branch, which the
  board shows; the dialog says so while edits wait.
