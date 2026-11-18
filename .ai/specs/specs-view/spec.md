# Specs view — a list of specs beside the chosen one

Depth: easy — every decision was taken with the maintainer in one conversation and each is undone
by a revert of the page; the one change outside this repository, Jig's contract for a spec's text,
is filed and decided there.

## Idea

The maintainer's words, translated from Russian (2026-11-18), in the order they were said:

- "I want to rework the specs page. First, take the specs off the top and make, as on the main
  page, a scrolling list on the left (maybe with search) and the main block on the right. On top
  the spec's title and meta, below the phases and the boards. It matters that the spec's
  artifacts are visible, so one can read what it is about. Though to begin with, maybe just a
  short description under the spec's title."
- "The spec's epic can go right on the epic's card. I am for the full title: better make its font
  smaller so it fits, but that is clearer."
- "The description — add it: this is a prototype of what we want in the end. And I do not see
  the epics separated, only the chosen one. On the main page a project is one line, it is clear;
  here, because there are several lines, it all runs together."
- "Finished but not closed — let us show them. Otherwise one can forget to close the spec."

The prototype the maintainer agreed to is `mockup.html` next to this file.

## Goal and problem

- Who is worse off without this, and how: a person with twenty specs in a project. Today the
  specs are tabs of bare ids across the top of the Specs view (`web/views/BoardView.vue`): the ids
  wrap into three rows, say nothing of what each spec is about or how far it is, and push the
  board below the fold. Nothing on the page says what a spec is for, and a spec whose roadmap is
  done stays a tab like any other, so it is never closed.
- What is true when the work is done: the Specs view reads like the main page — a list of specs
  on the left, each with its full title, its epic and priority, and its progress; the chosen spec
  on the right with its title, meta and a short description, its documents one click away, then
  its phases and board. A spec whose roadmap is complete is marked at the bottom of the list and
  offers the request that closes it.

## Stress test

- Hidden assumptions — "this holds only if …": the description and the documents hold only if Jig
  gives them; `jig spec list --json` has a title and the roadmap, nothing else, and no command reads
  a spec's files (Jig 0.47.0). Until it does, Phase 1 ships without them.
- The main trade-off: full titles in the list are clear but take two or three lines each, so fewer
  specs fit on screen; ids fit but say nothing. Full titles at 12px with a hairline between rows
  were chosen.
- The weakest point: Phase 3 waits on a Jig release; until then the prototype's description and
  document buttons are not on the page.
- Failure modes — cause, what breaks, the signal that shows it: a long list with multi-line titles
  runs together → the person cannot tell where one spec ends → rows without a divider in review;
  a complete spec sinks to the bottom and is still forgotten → specs with a full roadmap linger in
  `jig spec list`.
- Other shapes considered, and why this one: keeping tabs with titles (still a wall of text above
  the board); a dropdown of specs (hides the progress of the others). The master–detail of the main
  page was chosen because the person already reads it there.

## Scope and non-goals

- In scope: the Specs view's layout, the list and its order, the head of the chosen spec, a short
  description and the spec's documents once Jig gives them; Jig's contract for them, filed in Jig.
- Not doing: editing a spec's text from the page; rendering a spec as rich Markdown beyond what a
  task's documents get; showing closed specs (Jig removes their directory, so it lists none).

## Decisions

- The list is on the left, scrolling, with a search field, as `ProjectList` on the main page; on a
  narrow screen it stands above the spec — rejected: tabs across the top, because twenty ids wrap
  and say nothing.
- A row shows the spec's full title at 12px, wrapping, never truncated — rejected: the id, short but
  unclear to a person.
- Rows are separated by a hairline; the chosen one is a card on the panel's tint, as the chosen
  project on the main page — because multi-line rows otherwise run together.
- A spec's epic and its priority are a badge on its row, next to its progress — rejected: separate
  "Epics" and "Specs" groups in the list, which the badge makes unnecessary.
- Order: the queued epics in the queue's order, then the other specs in Jig's order, then the
  specs whose roadmap is complete, marked ✓ and "close it" — rejected: hiding complete specs,
  because then nobody closes them. Closed specs never appear: `jig spec close` and
  `jig spec epic --finish` remove the spec's directory.
- A complete spec's head says the roadmap is complete, and its "Ask your agent" offers to close the
  spec (or finish the epic).
- The head of the chosen spec: full title, a line of meta (id, progress, fog, epic, release,
  priority, the epic's menu), the description, buttons Spec and Roadmap, then "Ask your agent"
  collapsed to one line, then the phases and the board as today.
- The description and the documents' text come through Jig's contract only — rejected: the server
  reading `.ai/specs/<id>/*.md` itself, which breaks
  adr-20261014-jig-ui-is-an-optional-layer-over-jig and features/specs.md ("Jig UI never reads a
  roadmap file").

## Open questions

- Where Jig takes a spec's summary from: an explicit `Summary:` line in `spec.md`'s template, or the
  first paragraph of "Goal and problem". Leaning to the explicit line: the opening paragraphs of
  today's specs quote the owner rather than describe the spec. Decided in Jig; Phase 2 depends on
  it.
- Whether a spec's document is shown as written, as a task's documents are
  (adr-20261030-a-task-document-is-shown-as-written), or rendered. Phase 3 depends on it; as written
  is the default.

## Set aside

- unexplored: a count of the spec's tasks in work on its row.
- unexplored: moving through the list with the arrow keys.

## Assumptions left untested

- A spec's directory may hold files besides `spec.md` and `roadmap.md` (here `mockup.html`) without
  Jig reporting them — taken at easy; `jig spec list` after the ship tests it.
