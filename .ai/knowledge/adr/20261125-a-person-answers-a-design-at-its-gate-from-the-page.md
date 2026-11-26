---
id: adr-20261125-a-person-answers-a-design-at-its-gate-from-the-page
type: adr
status: accepted
date: 2026-11-25
domains: []
paths:
  - web/components/GateApproval.vue
  - server/source/local.ts
  - server/jig/client.ts
  - web/lib/agent-prompts.ts
summary: "answer-gate: a one-line answer to a design at its gate from the task's page, where Jig (0.48.0+) offers it; the agent reads it on resume — amends adr-20261118"
---
# A person answers a design at its gate from the task's page

## Context

adr-20261118-a-person-writes-on-a-task-from-its-page let a person approve a design at its gate from the page. A design
that needs changing had no answer there: the person went to their agent's chat. Jig records an answer in the task's
state — `jig task gate <id> answered --answer <text>` — and an agent reads it when it resumes the task at its gate
(jig-task, human gate; jig-autopilot, `resume` brings back `gate answered: <words>`). Task `ui-improvements`,
2026-11-25; the maintainer asked for it on the task page's design.

## Decision

- **Amends adr-20261118-a-person-writes-on-a-task-from-its-page** with one write, `answer-gate`:
  `jig task gate <id> answered --answer <text> --revision <n> --json`, offered exactly where Jig offers its own
  action `answer-gate` (Jig 0.48.0 and later; a Jig that offers only the approval gets no answer field), against the same reads of the design an approval goes by: a design rewritten since is refused
  `stale-revision`. The answer is one line without a tab, as Jig's `--answer` takes it, at most 2000 characters; a
  blank one, or one with a line break or a tab, is refused before Jig runs.
- The gate's panel shows the design, a field for the answer, Approve the design and Send the answer, and says that the
  agent reads the decision when it resumes the task: an agent waiting in a chat does not see it. Ask your agent offers
  the sentence to send it.

## Alternatives

- **Only Approve, the answer in the agent's chat** — the person reads the design on the page and would retype where
  they were.
- **A message to the running session** — Jig UI does not talk to agents; the task's state is the channel both read.

## Consequences

- A design can be turned back from the page; nothing tells a waiting agent, so the page tells the person to.
- An answered gate shows on the card and the row as a quiet note until the design is reworked.
