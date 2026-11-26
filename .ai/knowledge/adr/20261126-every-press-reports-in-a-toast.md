---
id: adr-20261126-every-press-reports-in-a-toast
type: adr
status: accepted
date: 2026-11-26
domains: []
paths:
  - web/lib/report.ts
  - web/views/BoardView.vue
  - web/views/WorkspaceView.vue
  - web/views/TaskView.vue
  - web/components/UpgradePanel.vue
  - web/components/StagingWork.vue
  - web/components/UpgradeAllDialog.vue
  - web/components/MachineJig.vue
summary: Every press reports by a spinner on its button and a toast through lib/report.ts, every question is a dialog; results that need a look stay; upgrade result, task-page refusals, board notice, settings notice and self-update move to toasts — amends adr-20261125 (toasts), adr-20261027 (Dismiss), adr-20261118 (refusals)
---
# Every press on the page reports by a spinner and a toast, and every question before an action is a dialog

## Context

adr-20261125-the-page-opens-tasks-and-questions-over-the-board moved Refresh, Housekeeping and an item's close, merge
and land into toasts, and left the rest of the page's actions reporting where they were made: Check merge, Check all
merges, Upgrade all, Land all, Mark as known, Connect and Find projects, the settings dialog's notice, the board's
notice line, the task page's refusals and this machine's self-update. The maintainer found the gap in use (2026-11-26):
"чек мерж не обработали. Проверь все кнопки, может еще что пропустили". Three bugs came with the toasts raised straight
from `vue-sonner`: sonner never forgets an id and merges a toast raised again under the same id into the old one; a
toast dismissed from code fired its `onDismiss` like a person's close did, and wiped server state (the upgrade's result)
that the replaced toast had no say in; and each component kept its own copy of the tone-to-kind mapping, which diverged.

## Decision

- **Every press reports in one way:** a spinner on its button while it runs and a toast for what came of it; every
  question before an action is a dialog that is the question only. The one place that raises a toast is
  `web/lib/report.ts`. `reporter(key, onClosed?)` gives `{show, clear}`: each `show` replaces the last toast under a
  fresh id; `onClosed` runs only when the person closes the toast shown or it closes by itself, never on a replace or a
  `clear`; `clear` runs when the view that holds the state unmounts. `kindOf(tone)` is the one mapping: bad is an
  error, attention a warning, good a success, quiet an info. Success and info go by themselves after 8 s (`SHOWN_MS`);
  a spinner, a warning and an error stay until closed. A toast's action keeps it up.
- **Amends adr-20261125-the-page-opens-tasks-and-questions-over-the-board, "Long actions report in toasts":** "a result
  goes by itself after 8 s, an error stays" now reads: a result that went well goes by itself, one that needs a look
  (an attention result, such as an upgrade that ended with steps by hand) stays like an error. The actions it listed
  are now every press, not a few.
- **Amends adr-20261027-upgrading-a-project-runs-in-the-background, "The result stays until Dismiss":** the run and its
  result are a toast (`UpgradePanel.vue`). Closing the toast is the Dismiss (`DELETE /api/projects/:id/upgrade`); the
  card no longer keeps the result. **Steps** on an attention result opens a dialog with the steps by hand and the
  request for the person's agent.
- **Amends adr-20261118-a-person-writes-on-a-task-from-its-page:** the task page's refusals (the gate's, the task's
  writes', the dependencies') are toasts, no longer worded inline where the write was made; a drop's note is a toast too,
  not the board's notice line.
- **Moved to toasts:** the upgrade run and its result; Check merge and Check all merges; Upgrade all's run and refusal,
  its question being the dialog `UpgradeAllDialog.vue`; Land all; Mark as known's refusal; the refusals of Connect and
  Find projects; the settings dialog's notice; the board's notice (land, promote, merge, request review, moves,
  priority, pause, resume, close, epic and roadmap edits, filing an item, knowledge decisions) — the cards' change marks
  after a stale revision live until that toast closes or the next change replaces it —; and this machine's `jig
  self-update` (a loading toast, an error toast, a spinner on the header's **Update…**; its dialog is the question only).
- **Left inline on purpose:** a refusal inside its own dialog (New task, File item), where the person is still
  filling the form; a read failure with **Read again**; busy lines such as "sending to Jig…"; status lines that are not
  a press's result.

## Alternatives

- **Calling `vue-sonner` per component, as before.** Rejected: merged ids, a programmatic dismiss that fired `onDismiss`
  and wiped server state, and copies of the tone-to-kind mapping that diverged.
- **Keeping the task page's refusals beside their field.** Rejected: one place for a press's result is what the
  maintainer asked for, and the toast stays when the field's dialog or panel is gone.
- **A result that needs a look going by itself after 8 s.** Rejected: an upgrade that ended with steps by hand would be
  lost before it was read; it stays like an error.

## Consequences

- A new press has one way to report: `reporter` and its spinner; a component that calls `toast` directly is a defect.
- A toast closed is a report dismissed; one that the view outlives needs `clear` on unmount, or it stays over another view.
- Refusals leave their forms: the field no longer shows why it was refused, the toast does.
