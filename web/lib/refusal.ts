/** Jig's reasons in a refusal the server answered with, paths already cut out by the server; none where it gave none. */
export const reasonsOf = (error: object): string[] => ('reasons' in error && Array.isArray(error.reasons) ? error.reasons.map(String) : []);

/**
 * The line above the board for a change Jig refused, other than a stale revision (that one shows the conflict) —
 * never Jig's message, which may name a path.
 */
export function refusal(code: string, doing: string, task: string): string {
  if (code === 'wrong-checkout') return `${task} keeps its work in a stash: run jig task resume ${task} in the project, on its branch.`;
  if (code === 'stash-conflict') {
    return `${task}'s stash did not apply cleanly in the project's checkout: resolve the conflicts there, then run jig task resume ${task}.`;
  }
  // Jig 0.45.0: neither paused nor parked at the staging branch any more.
  if (code === 'not-paused') return `Somebody resumed ${task} first.`;
  if (code === 'already-paused') return `Somebody paused ${task} first.`;
  if (code === 'upgrading') return `Jig is being upgraded in this project: try ${doing} ${task} again once it has finished.`;
  if (code === 'incompatible')
    return `Jig answered ${doing} ${task} in a form this Jig UI does not read, and may have done it: update Jig UI.`;
  return `Jig refused ${doing} ${task} (${code}).`;
}

/**
 * The line for a close Jig refused: a stale revision as the project having changed since it was read — a project's card
 * shows no conflict, as the board does —; Jig's own reasons, paths already cut out by the server, where it gave them —
 * the pull request not merged, the knowledge decision not recorded; a task no longer closable is said so; anything else
 * as `refusal` says it.
 */
export function closeRefusal(code: string, reasons: string[], task: string): string {
  if (code === 'stale-revision') return `The project changed while you were closing ${task}. Try again on it as it is now.`;
  if (reasons.length > 0) return `Jig did not close ${task}: ${reasons.join(' ')}`;
  if (code === 'not-found') return `${task} cannot be closed from the page any more: read it again.`;
  return refusal(code, 'closing', task);
}

/** `agent.git: none`: Jig commits nothing, so a write it makes on a branch of its own is refused; the level is a setting. */
export const NO_COMMITS = "Jig commits nothing in this clone (agent.git is none): choose a level in the project's Settings.";

/**
 * The line for a roadmap edit Jig refused: `agent.git: none`, where Jig commits nothing, sends the person to the
 * project's Settings; an item or phase the specs no longer show is said so; otherwise Jig's own reasons, paths already
 * cut out by the server — a checkout on the spec's branch, a base not on origin — or, without any, as `refusal` says it.
 */
export function roadmapRefusal(code: string, reasons: string[], doing: string, spec: string): string {
  if (code === 'git-not-allowed') return NO_COMMITS;
  if (code === 'not-found') return `The roadmap of ${spec} no longer has what you were ${doing}: try again on the specs as they are now.`;
  if (reasons.length > 0) return `Jig did not change the roadmap of ${spec}: ${reasons.join(' ')}`;
  return refusal(code, doing, `the roadmap of ${spec}`);
}

/**
 * The line for filing an item's task that Jig refused: an id a finished task has (`taken`); an item that names a task
 * already (`already-filed`); any other `already-exists` in Jig's own words; an id or a goal Jig does not take;
 * `undefined` for anything else, which `roadmapRefusal` says.
 */
export function fileItemRefusal(code: string, reasons: string[], task: string, taken: boolean): string | undefined {
  if (taken) return `The project has a finished task called ${task}. Choose another id.`;
  if (code === 'already-filed')
    return 'The item names a task already, filed from another clone perhaps: the roadmap is shown as it is now.';
  if (code === 'already-exists' && reasons.length > 0) return `Jig did not file ${task}: ${reasons.join(' ')}`;
  return code === 'usage' ? 'Jig does not take this id or goal: one line of goal, not starting with #.' : undefined;
}

/**
 * The line for a person's write on a task that Jig refused — approving its design, abandoning, archiving or bringing it
 * back, closing its roadmap item, adding or removing a dependency: a stale revision as the project having changed since
 * it was read, the design included; somebody having done it first; `agent.git: none` sending to Settings; Jig's own
 * reasons, paths already cut out by the server, where it gave them; anything else as `refusal` says it.
 */
export function writeRefusal(code: string, reasons: string[], doing: string, task: string): string {
  if (code === 'stale-revision') return `The project changed while you were ${doing} ${task}. Look at it again as it is now.`;
  if (code === 'not-found') return `${task} does not offer this any more: look at it again as it is now.`;
  if (code === 'already-archived') return `Somebody archived ${task} first.`;
  if (code === 'not-archived') return `Somebody brought ${task} back first.`;
  if (code === 'already-closed') return `The roadmap item of ${task} is closed already.`;
  if (code === 'no-gate') return `${task} has no design waiting at its gate any more.`;
  if (code === 'autopilot-running') return `${task}'s autopilot run is on: the approval there is the agent's.`;
  if (code === 'autopilot-stopped') return `${task}'s autopilot run stopped on a question: answer it, or take the task over, first.`;
  if (code === 'wrong-status') return `${task} is no longer in a state that takes this: look at it again as it is now.`;
  if (code === 'write-busy') return 'Jig is making another change in this project: try again in a moment.';
  if (code === 'git-not-allowed') return NO_COMMITS;
  if (reasons.length > 0) return `Jig refused ${doing} ${task}: ${reasons.join(' ')}`;
  return refusal(code, doing, task);
}

/**
 * The line for a landing, a promotion or a review request Jig refused, in Jig UI's words where the person has a next
 * step — the review it waits for, a conflict the agent resolves, a check still running — and Jig's own words where only
 * Jig knows why; a timeout or an answer this Jig UI does not read may have done it. The rest as `writeRefusal` says it.
 */
export function stagingRefusal(code: string, reasons: string[], doing: string, task: string): string {
  if (code === 'not-approved') {
    return reasons.length > 0 ? `Jig did not land ${task}: ${reasons.join(' ')}` : `${task}'s pull request is not approved yet.`;
  }
  if (code === 'review-required') return `Only an approval lands ${task} here: the project's git.staging_review is require.`;
  if (code === 'conflict')
    return `${task}'s pull request conflicts with staging. Ask your agent to land ${task}: it resolves the conflict.`;
  if (code === 'base-conflict') {
    const paths = reasons.length > 0 ? ` (${reasons.join(' ')})` : '';
    return `${task}'s branch conflicts with the main branch${paths}: ask your agent to merge it in, then prepare for prod again.`;
  }
  if (code === 'ci-pending') return `${task}'s checks are still running: try again in a moment.`;
  if (code === 'mergeable-unknown') return `The forge cannot say yet whether ${task}'s pull request merges cleanly: try again in a moment.`;
  if (code === 'autopilot-running') return `${task}'s autopilot run is on: the agent is on it.`;
  if (code === 'timeout') return 'Jig did not answer in time and may have done it: look at the board again.';
  if (code === 'incompatible') return 'Jig answered in a way Jig UI does not read, and may have done it: look at the board again.';
  return writeRefusal(code, reasons, doing, task);
}

/** Refusals of a merge where the pull request's status says nothing more: it is gone, the forge cannot be asked, or the merge was never Jig's to make. */
const NO_STATUS = new Set([
  'pull-request-closed',
  'no-pull-request',
  'wrong-flow',
  'forge-unavailable',
  'not-found',
  'timeout',
  'incompatible',
]);

/** Whether Status… goes beside a merge Jig refused: where the pull request is still open and its status says why. */
export const mergeShowsStatus = (code: string): boolean => !NO_STATUS.has(code);

/**
 * The line for a merge Jig refused, nothing merged: Jig UI's words where the person has a next step — a check to wait for
 * or to fix, a conflict or a draft that is the agent's, a ship that merges it itself — and Jig's own words for whom the
 * review waits for and where only Jig knows why. Status… beside it says the rest.
 */
export function mergeRefusal(code: string, reasons: string[], task: string): string {
  if (code === 'ci-red') return `A check of ${task}'s pull request failed: nothing was merged.`;
  if (code === 'ci-pending') return `${task}'s checks are still running: try again once they pass.`;
  if (code === 'ci-none') return `No check has run on ${task}'s pull request: nothing was merged.`;
  if (code === 'not-approved') {
    return reasons.length > 0 ? `Jig did not merge ${task}: ${reasons.join(' ')}` : `${task}'s pull request is not approved yet.`;
  }
  if (code === 'conflict') return `${task}'s pull request conflicts with its base: ask your agent to merge the base in.`;
  if (code === 'draft') return `${task}'s pull request is a draft: mark it ready for review first.`;
  if (code === 'ship-running') return `The agent's ship of ${task} waits for CI and merges it itself.`;
  if (code === 'notes-stale') return `${task}'s release notes no longer reach the base: ask your agent to bring them up to date.`;
  if (code === 'pull-request-closed') return `${task}'s pull request was closed without a merge.`;
  return stagingRefusal(code, reasons, 'merging', task);
}
