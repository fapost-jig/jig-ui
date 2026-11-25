# Roadmap — Specs view

Destination: the Specs view lists every spec on the left by its full title, epic, priority and
progress, with complete specs marked to close, and shows the chosen spec on the right with its
meta, a short description and its documents above its phases and board.

## Phase 1 — The list beside the spec

Goal: the Specs view is a list on the left and the chosen spec on the right, with no change in
Jig. Done when: twenty specs are found by search, read by title, and a complete one is marked
"close it" at the bottom with the request to close it.

- [ ] `specs-list-beside-spec` — Specs list beside the chosen spec — the list with search, scrolling, full titles at 12px, a hairline between rows, the chosen row as a card, epic and priority as a badge, complete specs last with ✓ and "close it"; the head with title, meta line, "Ask your agent" collapsed with the close request for a complete spec, then the phases and board

## Phase 2 — A spec's words from Jig

Goal: Jig gives a spec's summary and its documents' text through its contract. Done when: a Jig
release has both and Jig UI's adapter can read them. Filed in `fapost-jig/jig`.

- [x] Summary in `jig spec list --json` — a short description of each spec, from the source Jig decides (see Open questions)
- [x] Text of a spec's documents — a command that gives `spec.md` and `roadmap.md` as written, in JSON

## Phase 3 — The spec's words on the page

Goal: the head of the chosen spec shows what the spec is about. Done when: the description stands
under the title and Spec and Roadmap open the documents, as `mockup.html` shows.

- [x] `spec-words-on-page` — Description under the spec's title (after: Summary in `jig spec list --json` — the page has nothing to show before it)
- [x] `spec-words-on-page` — Spec and Roadmap open the spec's documents (after: Text of a spec's documents — the same reason)

## Waves

1. Specs list beside the chosen spec; Summary in `jig spec list --json`; Text of a spec's documents
2. Description under the spec's title; Spec and Roadmap open the spec's documents

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
