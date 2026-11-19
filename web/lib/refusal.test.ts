import { describe, expect, it } from 'vitest';
import { closeRefusal, fileItemRefusal, reasonsOf, refusal, roadmapRefusal, stagingRefusal, unnamedRefusal, writeRefusal } from './refusal';

describe('reasonsOf', () => {
  it("reads Jig's reasons as lines, and none from an answer without them or with them in another shape", () => {
    expect(reasonsOf({ code: 'refused', reasons: ['not merged', 7] })).toEqual(['not merged', '7']);
    expect(reasonsOf({ code: 'refused' })).toEqual([]);
    expect(reasonsOf({ code: 'refused', reasons: 'not merged' })).toEqual([]);
  });
});

describe('refusal', () => {
  it.each([
    ['wrong-checkout', 'a keeps its work in a stash: run jig task resume a in the project, on its branch.'],
    [
      'stash-conflict',
      "a's stash did not apply cleanly in the project's checkout: resolve the conflicts there, then run jig task resume a.",
    ],
    ['not-paused', 'Somebody resumed a first.'],
    ['already-paused', 'Somebody paused a first.'],
    ['upgrading', 'Jig is being upgraded in this project: try resuming a again once it has finished.'],
    ['incompatible', 'Jig answered resuming a in a form this Jig UI does not read, and may have done it: update Jig UI.'],
    ['already-exists', 'Jig refused resuming a (already-exists).'],
  ])('says %s in its own words', (code, line) => {
    expect(refusal(code, 'resuming', 'a')).toBe(line);
  });
});

describe('closeRefusal', () => {
  it.each([
    ['failed', ['its pull request is open;', 'merge it'], 'Jig did not close a: its pull request is open; merge it'],
    ['failed', [], 'Jig refused closing a (failed).'],
    ['not-found', [], 'a cannot be closed from the page any more: read it again.'],
    ['stale-revision', ['written since'], 'The project changed while you were closing a. Try again on it as it is now.'],
    ['upgrading', [], 'Jig is being upgraded in this project: try closing a again once it has finished.'],
  ])('says %s with %j in its own words', (code, reasons, line) => {
    expect(closeRefusal(code, reasons, 'a')).toBe(line);
  });
});

describe('roadmapRefusal', () => {
  it.each([
    ['git-not-allowed', [], "Jig commits nothing in this clone (agent.git is none): choose a level in the project's Settings."],
    ['not-found', [], 'The roadmap of shop no longer has what you were moving: try again on the specs as they are now.'],
    ['branch-checked-out', ['spec/shop is checked out in …'], 'Jig did not change the roadmap of shop: spec/shop is checked out in …'],
    // Jig 0.41.0: an earlier edit still waits where this one cannot follow; Jig's line says what to do.
    [
      'write-still-waits',
      ['spec/shop has 1 edit(s) that never reached origin, …'],
      'Jig did not change the roadmap of shop: spec/shop has 1 edit(s) that never reached origin, …',
    ],
    ['write-busy', [], 'Jig refused moving the roadmap of shop (write-busy).'],
  ])('says %s', (code, reasons, line) => {
    expect(roadmapRefusal(code, reasons, 'moving', 'shop')).toBe(line);
  });
});

describe('unnamedRefusal', () => {
  it('says the task was filed, why it was not named, and how to name it', () => {
    expect(unnamedRefusal('branch-checked-out', ['spec/shop is checked out in …'], 'search')).toBe(
      'Filed search, but Jig did not name it on the item (spec/shop is checked out in …). Once that is resolved, File task… again with search.',
    );
    expect(unnamedRefusal('write-busy', [], 'search')).toContain('the item (write-busy).');
  });
});

describe('fileItemRefusal', () => {
  it.each([
    // Jig 0.40.0: the task was filed and Jig refused to name it.
    ['branch-checked-out', ['spec/shop is checked out in …'], true, false, 'Filed search, but Jig did not name it on the item'],
    // An id the server found among the finished tasks, whatever Jig's line.
    ['already-exists', ['task already exists: search'], false, true, 'The project has a finished task called search. Choose another id.'],
    // Any other `already-exists` of `--new` (Jig 0.41.0) in Jig's own line.
    [
      'already-exists',
      ['i-aaaaaaaaaaaa already names task other'],
      false,
      false,
      'Jig did not file search: i-aaaaaaaaaaaa already names task other',
    ],
    // Jig 0.42.0: an item that names a task already has a code of its own.
    [
      'already-filed',
      ['i-aaaaaaaaaaaa already names task other'],
      false,
      false,
      'The item names a task already, filed from another clone perhaps: the roadmap is shown as it is now.',
    ],
    ['usage', [], false, false, 'Jig does not take this id or goal: one line of goal, not starting with #.'],
  ])('says %s with %j', (code, reasons, filed, taken, line) => {
    expect(fileItemRefusal(code, reasons, 'search', filed, taken)).toContain(line);
  });

  it('leaves any other refusal to roadmapRefusal', () => {
    expect(fileItemRefusal('git-not-allowed', [], 'search', false, false)).toBeUndefined();
  });
});

describe('writeRefusal', () => {
  it.each([
    ['stale-revision', [], 'The project changed while you were archiving a. Look at it again as it is now.'],
    ['not-found', [], 'a does not offer this any more: look at it again as it is now.'],
    ['already-archived', [], 'Somebody archived a first.'],
    ['not-archived', [], 'Somebody brought a back first.'],
    ['already-closed', [], 'The roadmap item of a is closed already.'],
    ['no-gate', [], 'a has no design waiting at its gate any more.'],
    ['autopilot-running', [], "a's autopilot run is on: the approval there is the agent's."],
    ['write-busy', [], 'Jig is making another change in this project: try again in a moment.'],
    ['git-not-allowed', [], "Jig commits nothing in this clone (agent.git is none): choose a level in the project's Settings."],
    ['autopilot-stopped', [], "a's autopilot run stopped on a question: answer it, or take the task over, first."],
    ['wrong-status', [], 'a is no longer in a state that takes this: look at it again as it is now.'],
    ['failed', ['the branch is gone'], 'Jig refused archiving a: the branch is gone'],
    ['already-exists', [], 'Jig refused archiving a (already-exists).'],
  ])('says %s with %j in its own words', (code, reasons, line) => {
    expect(writeRefusal(code, reasons, 'archiving', 'a')).toBe(line);
  });
});

describe('stagingRefusal', () => {
  it("says whom a landing waits for in Jig's words, and what the person can do where there is something", () => {
    expect(
      stagingRefusal(
        'not-approved',
        ['not landed: u is not approved (waiting for alice); land it without review, or wait for review'],
        'landing',
        'a',
      ),
    ).toBe('Jig did not land a: not landed: u is not approved (waiting for alice); land it without review, or wait for review');
    expect(stagingRefusal('review-required', [], 'landing', 'a')).toBe(
      "Only an approval lands a here: the project's git.staging_review is require.",
    );
    expect(stagingRefusal('conflict', [], 'landing', 'a')).toBe(
      "a's pull request conflicts with staging. Ask your agent to land a: it resolves the conflict.",
    );
    expect(stagingRefusal('base-conflict', ['conflicts in app.ts'], 'preparing for prod', 'a')).toBe(
      "a's branch conflicts with the main branch (conflicts in app.ts): ask your agent to merge it in, then prepare for prod again.",
    );
    expect(stagingRefusal('ci-pending', [], 'landing', 'a')).toBe("a's checks are still running: try again in a moment.");
    expect(stagingRefusal('autopilot-running', [], 'asking review for', 'a')).toBe("a's autopilot run is on: the agent is on it.");
  });

  it("says a write that may have happened as one, and the rest in Jig's words", () => {
    expect(stagingRefusal('timeout', [], 'landing', 'a')).toBe('Jig did not answer in time and may have done it: look at the board again.');
    expect(stagingRefusal('incompatible', [], 'landing', 'a')).toBe(
      'Jig answered in a way Jig UI does not read, and may have done it: look at the board again.',
    );
    expect(stagingRefusal('ci-red', ['a check of u failed'], 'landing', 'a')).toBe('Jig refused landing a: a check of u failed');
    expect(stagingRefusal('not-found', [], 'preparing for prod', 'a')).toBe(
      'a does not offer this any more: look at it again as it is now.',
    );
  });
});
