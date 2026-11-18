---
id: adr-20261118-a-person-writes-on-a-task-from-its-page
type: adr
status: accepted
date: 2026-11-18
domains: []
paths:
  - server/jig/client.ts
  - server/source/local.ts
  - server/source/project-source.ts
  - server/http/app.ts
  - web/views/TaskView.vue
  - web/views/BoardView.vue
  - web/components/GateApproval.vue
  - web/components/TaskWrites.vue
  - web/components/DependsEditor.vue
  - web/components/ActionList.vue
  - web/components/FinishedList.vue
  - web/lib/writes.ts
  - web/lib/refusal.ts
  - web/lib/finished.ts
summary: From Jig 0.46.0 the task's page approves a design as shown, abandons with a reason and archives, changes what the task waits for, and the finished list brings a task back or closes its roadmap item — each only where Jig offers it, with the revision of its read
reviewed_at: 2026-11-18
---
# A task's page runs the writes Jig 0.46.0 offers a person on it — approving a design, abandoning, archiving, what it waits for — and the finished list brings one back

## Context

Until now the task's page (`#/projects/<id>/tasks/<task>`) only listed the actions Jig offers, each as a command to copy
(feature-task-details, "Jig UI runs no action"). Jig 0.46.0 (`schemas/json.md`, commit 1fbb1da) takes a revision and
answers JSON on the rest of a person's writes: `task gate <id> approved`, `task abandon <id> --reason`, `task archive` and
`task unarchive`, `spec drop <id>` (a write in Jig's own tree on `spec/<sid>`, with a note on how far it went), and
`queue depend task:<id> --on <ref> --reason` / `queue undepend`. Its actions table offers `archive`, `unarchive` and
`drop-item` too, with new refusal codes (`no-gate`, `autopilot-running`, `autopilot-stopped`, `already-archived`,
`not-archived`, `wrong-status`, `already-closed`). Spec `jig-ui`, Phase 4, roadmap item "the rest of a person's writes";
task `person-writes`. The design was approved at its gate on 2026-11-18.

## Decision

- **Buttons for what Jig offers, commands for the rest.** On a project whose Jig is `WRITES_JIG_VERSION` (0.46.0) or
  later, the task's page runs `approve-gate`, `abandon` and `archive` where Jig offers them (`pageWrites` in
  `web/lib/writes.ts`); every other offered action stays a command to copy. `start` becomes the request for the
  person's agent, "Start task `<id>` in `<project>`": the work it begins is the agent's, never the page's. Below 0.46.0
  the page is as before and the adapter answers `unsupported`.
- **The design is approved as shown.** While Jig offers `approve-gate`, a panel above the facts shows `design.md` —
  for a T4 `spec.md` and `alternatives.md` before it, as Jig's gate hashes them — as written, with **Approve the
  design** under it (`web/components/GateApproval.vue`). The approval carries the smallest of the revisions those
  documents were read at (`readArtifact` now returns its envelope's revision), so Jig refuses it `stale-revision` when
  anything was written through Jig since — a design an agent rewrote (`jig task artifact write`) after it was shown is
  never approved. An edit by hand raises no revision (feature-live-updates) and is not caught. Pressing the button is
  the decision: no confirmation.
- **An abandon always asks its reason** (one line, at most 500 characters, no tab), though Jig requires one only of a
  spec-linked task: it is what the next agent reads. Once Jig abandoned or archived a live task, the page goes back to
  the board, where the task is among the finished ones. Abandoning never closes the roadmap item in the same press:
  that is a second write, offered on the finished row.
- **The finished list has a menu** per row with what Jig offers there — **Bring back** (`unarchive`), **Close its
  roadmap item** (`drop-item`), **Archive** — sent with the revision of that list's read
  (`web/components/FinishedList.vue`). From Jig 0.46.0 the list holds the archived tasks too (`readFinishedTasks` reads
  `--status archived` as a third run) and the board's count includes them, since the page can bring them back.
  A drop's note (how far `agent.git` let it go) is the board's notice.
- **What a task waits for** is changed in its facts: ✕ beside a dependency of its own, none beside one its epic gives
  it, and **Add…** for another live task or an open epic with the reason Jig asks for
  (`web/components/DependsEditor.vue`), with the revision of the task's board read (`GET …/tasks/:task` now serves it).
- **The adapter runs only what its last read offered** (adr-20261022-writes-carry-the-revision-of-their-read):
  `act` runs a write only when the task's last read details — or, for a finished task, the offers the last finished
  read kept in memory (`Entry.finished`, nothing on disk) — offer it; `depend` only between live tasks or onto an open
  epic of the last read; `undepend` only a dependency of the task's own. Anything else is `not-found`, Jig not run.
  An id from the page reaches Jig's arguments only after that check; the HTTP boundary checks the shape of the reason
  and of a queue reference (`task:<id>` or `epic:<id>`, never a flag).
- **One route for the task's writes**, `POST /api/projects/:id/tasks/act` with `{task, action, reason?, revision}`, and
  `POST …/queue/depend` and `…/queue/undepend` with `{task, on, reason?, revision}`; answers as every write's (200, 409
  stale, 404, 422 with Jig's reasons). Each refusal code has its own line (`writeRefusal` in `web/lib/refusal.ts`).
- This lifts feature-task-details' "Jig UI runs no action" for these writes, and amends
  adr-20261022-writes-carry-the-revision-of-their-read ("task ids that are live in the last read"): a finished task's
  write runs on an id the last read of the finished list showed, where Jig offered it.

## Alternatives

- **The writes in the board card's menu.** A card is a light row; a task's actions are read with its details only
  ("light rows for lists, the detail on demand"). Back to it if abandoning from the board is asked for often.
- **A route per write.** Five handlers that differ in one word; one `act` with the list of writes is shorter.
- **Abandon and close the roadmap item in one press.** Two writes, the second on the revision after the first, and a
  half-done refusal to show; Jig keeps them apart itself (`abandon.spec` leaves the item open).
- **A reason only where Jig requires one.** The reason is the next agent's; asking it always is simpler.
- **A confirmation before Approve.** The button under the design as shown is the decision.

## Consequences

- **From an agent's session the approval is always stale.** Jig 0.46.0 counts `task gate` as working the task: run
  with an agent session's id in its environment it records the session in `.ai/runtime/taken/<task>/` and raises the
  revision before it checks the one it was given, so `--revision` is always behind (as Jig #389 was for the
  close, which Jig exempted). A Jig UI started from a terminal or as a service has no such id and is unaffected; one an
  agent started shows the stale line. The fix is Jig's.
- The page keeps no list of its own of what is allowed: the buttons are Jig's offers, and the refusal lines are Jig's
  codes. A Jig that offers a new write shows it as a command until Jig UI learns it.
- Undoing a write is the person's, through Jig: `reopen` (a command), **Bring back**, or a new design for the gate.
