---
id: adr-20261125-the-page-opens-tasks-and-questions-over-the-board
type: adr
status: accepted
date: 2026-11-25
domains: []
paths:
  - web/lib/tones.ts
  - web/components/TaskCard.vue
  - web/components/TaskRow.vue
  - web/views/TaskView.vue
  - web/components/WriteConfirm.vue
  - web/components/PrStatus.vue
  - web/components/ChoreReports.vue
  - web/components/FinishedList.vue
  - web/components/UpgradePanel.vue
  - web/components/ui/sonner/Sonner.vue
  - web/router.ts
  - server/http/app.ts
summary: A card names and the task page tells (2/3 task, 1/3 facts); questions, status, new task, upgrade and finished tasks open as dialogs; long actions report in toasts; Accept all and Keep all; tones gain accents; addresses are paths — amends adr-20261110 x2, 20261018, 20261029, 20261106, 20261114, 20261118, 20261119 x2, 20261120
---
# A task opens on its own page, questions and reports open over the page, and the page's addresses are paths

## Context

The maintainer collected UI improvements in task `ui-improvements` and settled each one live on 2026-11-25, on
prototypes on a design canvas and in the running page. A card expanded in place to show a task's facts, the List view
kept a side pane for them, and the task page was one long column with Jig's commands at its foot. Questions before a
write, a pull request's status, the new-task form, the upgrade's plan and the finished tasks opened as panels in a card
or under the board's head; Refresh's, Housekeeping's and a card write's reports stayed there until dismissed. The id,
the spec and the priority read alike in grey, a chosen row in a dark side list could hardly be told from the rest, and
the page's addresses carried `#/`. The maintainer's words for each change are in the task: "все артефакты должны
открываться в модалке", "там где мерж можно тоже в модалке вопрос задавать", "новая задача тоже в модалку", "апгрейд в
модалку", the finished tasks "тоже в модалке", toasts for "хаускипинг (да и вообще все действия типа рефреш, апгрейд)"
with their results and errors, "давай добавим кнопку принять все" and, for changed sources, "забыли изменения", and
"можем заодно убрать из роутера /#/?".

## Decision

- **Amends the Colour and Marks bullets of adr-20261110-the-page-speaks-a-quiet-design-language.** `web/lib/tones.ts`
  gains accents that mean something: `idAccent` (indigo) for a task's id, `epicAccent` (fuchsia) for a spec whose epic
  the task goes into, `priorityAccent` — P0–P1 red, P2 orange, lower slate —, `classAccent` — T3 and T4, which stop at a
  human gate, violet, the rest slate —, `ciDot` and `notHeardDot` for a pull request's CI, `endingAccent` for how a
  finished task ended, and `workingText` for a line saying the page reads now. Green and amber keep meaning done and
  needs you: no priority is green or amber. In the dark theme a chosen item on a panel is `bg-foreground/12` with a
  stronger ring, since a card there is hardly lighter than its panel.
- **A card names, a page tells.** A card no longer expands: its head is the id with a copy button and its menu, a spec
  chip under it, the goal (up to four lines, a link to the task's page), one status line with an icon (`TaskNote`: the
  autopilot's stage, what it waits for — its own dependencies or its epic's —, a pause, the gate waiting, changed or
  answered, staging) and a footer — P and T, the pull request as a chip with its CI as a dot (hollow while housekeeping
  has not heard of it) and when Jig last changed the task, in days: Jig keeps a date there, not a time. The card's data
  gains `stage`, `updatedAt` and `waitsFor` from the reads the board already makes: no new Jig run.
- **The List view is a table.** One line a task, the card's columns, the row a link to the task's page; no side pane.
  Narrower than `lg` the status shows on a line of its own.
- **The task page is two thirds the task and one third what is known of it.** Left: the id, the spec, the goal, the
  status line, the gate, what needs the person, the documents. Right: the writes Jig offers, the facts, sentences to copy
  for the person's agent (Ask your agent), and a timeline from the times Jig keeps. **Amends adr-20261118-a-person-
  writes-on-a-task-from-its-page:** Jig's other offered actions are no longer listed as commands to copy; what has no
  button is asked of the agent in words. No strip of the route's stages: Jig names a route only in words
  (`jig task route`), and adr-20261014-board-columns-are-derived-from-jig-state keeps the page from holding a copy of
  Jig's tables.
- **Questions and reports open over the page.** **Amends adr-20261029-close-a-ready-task-from-the-board,
  adr-20261119-a-person-lands-asks-review-and-prepares-for-prod-from-the-card and adr-20261119-a-person-merges-a-tasks-
  pull-request-and-asks-where-it-stands-from-the-card:** the question before closing, preparing for prod or merging,
  and a pull request's status open as dialogs over the page, not on the card; closing the dialog is Cancel. The
  new-task form, the upgrade's question and plan, and the finished tasks (with a search) open as dialogs too. The
  canvas draws them in place (`INLINE_DIALOGS`), beside their variants.
- **Long actions report in toasts.** **Amends adr-20261110-housekeeping-runs-from-the-project-card,
  adr-20261120-a-projects-page-has-refresh-housekeeping-and-read-again-beside-its-name and the two adr-20261119 above:**
  Refresh, Housekeeping and an item's close, merge or land turn a spinner on their button and say what runs, what came
  of it and what went wrong in a toast (`vue-sonner`, shadcn-vue's Sonner, a devDependency): a result goes by itself
  after 8 s, an error stays until closed; a toast closed is its report dismissed, and a toast goes with the view that
  holds it. *(Amended by adr-20261126-every-press-reports-in-a-toast, 2026-11-26: every press reports so, through `web/lib/report.ts`, not only these; a result that needs a look stays like an error.)* Housekeeping's toast says what it changed in a few words the server reads from Jig's report in
  `server/jig/client.ts` (`housekeepingSummary`) — the page still shows the report and never reads it —; the whole
  report opens in a dialog from the toast. A finished task's write reports in a toast, above its dialog.
- **Amends adr-20261106-knowledge-decisions-from-the-page and adr-20261114-knowledge-decisions-are-queued-on-the-page:**
  Accept all decides every proposal the page may accept now, and Keep all every changed source it may keep, in one
  `jig knowledge decide` write through the queue (`decideAll`); Accept all asks first, since agents read accepted
  knowledge from then on. Keeping changes no text and asks nothing.
- **Amends the Routing bullet of adr-20261018-page-built-from-shadcn-vue-with-router-and-canvas.** vue-router runs in
  history mode: `/projects/<id>`, `/projects/<id>/tasks/<task>`, `/canvas`. The server answers those paths with the
  page — after the access guard, as `/` — and 503 while a build has emptied it, never a missing asset; a link from
  before (`/#/projects/<id>`, the command line's own included) becomes its path when the page loads.

## Alternatives

- **The List view with a summary beside the rows** (variant B on the canvas) — lost to one line a task: the page is a
  click away, and the pane repeated it.
- **A strip of the route's stages from the class's route table** — built, then dropped in review: a copy of Jig's table
  that a lean route already contradicts (its trimmed plan stage), and adr-20261014 keeps such copies out.
- **The page reading Housekeeping's report for its summary** — the page must show Jig's report, never read it; the
  server's client reads it, as it reads every Jig answer.
- **Confirming in place, as before** — the maintainer asked for dialogs; a question in a card shifts the cards under it.
- **Keeping `#/` addresses** — the maintainer asked for paths; old links still land.

## Consequences

- The id, the spec, P and T are found by colour across the board, the list and the page.
- A long Housekeeping report no longer fills a toast; the toast is a summary and the report a press away. When Jig's
  report changes its words, the summary says less — never wrong numbers on the page.
- A report of a run that ends after its view went is not shown; the next read shows what it did. *(Amended by task `ui-improvements-nits`, 2026-11-26: a run still under way when another project is shown is kept, and reports when its project is shown again; a finished report is dropped on leaving, `WorkspaceView.vue`.)*
- The page needs its server to answer its paths: a static host of `dist/web` alone would not.
