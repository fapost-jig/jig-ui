---
id: adr-20261125-the-specs-view-is-a-list-beside-the-chosen-spec
type: adr
status: accepted
date: 2026-11-25
domains: []
paths:
  - web/views/BoardView.vue
  - web/components/SpecList.vue
  - web/components/SpecBoard.vue
  - web/lib/specs.ts
summary: The Specs view is a searchable list of specs beside the chosen one, full titles at 12px, complete specs last with a close or finish request; amends the Specs view bullet of adr-20261110
reviewed_at: 2026-11-25
---
# The Specs view is a list of specs beside the chosen one, complete specs last and offered to close

## Context

adr-20261110-the-page-speaks-a-quiet-design-language made the Specs view "one spec at a time — a tab
for each when there are two or more". With twenty specs in a project the tabs are bare ids that wrap
into several rows, say nothing of what each spec is about or how far it is, and push the board below
the fold; a spec whose roadmap is done stays a tab like any other and is never closed. The maintainer
asked for the view to read like the workspace page — a list on the left, the chosen spec on the
right — and agreed the decisions and a mockup in the spec `specs-view` (`.ai/specs/specs-view/`,
2026-11-18). Phase 1 of that spec (task `specs-list-beside-spec`) builds it.

## Decision

This amends the **Specs view** bullet of adr-20261110-the-page-speaks-a-quiet-design-language: the
tabs of specs are replaced; the rest of that bullet — a step for each phase, three lanes, Up and Down
within a lane — and the rest of that ADR stand.

- **A list beside the spec.** The Specs view is a scrolling list of the project's specs on a tinted
  panel on the left (`web/components/SpecList.vue`, as `ProjectList` on the workspace page), with a
  search over title and id, and the chosen spec on the right (`SpecBoard.vue`); on a narrow screen the
  list stands above. The choice stays in the address (`?spec=<id>`); with none, the list's first.
- **A row** is the spec's full title at 12px, wrapping, never truncated; rows are separated by a
  hairline; the chosen one is a white card on the panel's tint. Under the title one badge for the epic
  and the queue's priority ("epic · P1", "epic", "P1"), the progress bar and done/total.
- **Order**: the server's order (queued epics, other open epics, the rest — features/specs) with the
  complete specs moved to the end, marked ✓ and "close it". Complete means the roadmap the head shows
  (`shownRoadmap`: the waiting one while edits wait) has every item done — Jig's numbers, not a count
  of ours. The epic menu's Up and Down step over the neighbours the list shows.
- **The head** of the chosen spec: full title, one meta line (id, progress, fog, epic, release, then
  the priority and the epic's menu), "Ask your agent (N)" collapsed to one line. A complete spec says
  its roadmap is complete and its request is to close the spec (`jig spec close`) or, with an open
  epic, to finish the epic (`jig spec epic --finish`); a finished epic still listed gets neither — its
  finishing pull request has not landed.
- **Sizes** stay those of adr-20261110: 12px is the smallest text, badges included (the mockup's
  11px is not taken).

## Alternatives

- **Tabs with titles** — still a wall of text above the board.
- **A dropdown of specs** — hides the progress of the others.
- **Hiding complete specs** — then nobody closes them.
- **Separate "Epics" and "Specs" groups in the list** — the badge on the row says it.

## Consequences

- The Specs view reads like the workspace page: the person already knows master–detail there.
- Complete specs no longer hide among the others; the page asks for them to be closed.
- The list's order differs from the server's for complete specs, so anything that moves through the
  specs by position (the epic menu) takes the list's order, not `ProjectSpecs`'.
- Phase 3 of the spec adds the spec's summary and its documents to the head, from Jig's contract
  only (adr-20261014-jig-ui-is-an-optional-layer-over-jig).
