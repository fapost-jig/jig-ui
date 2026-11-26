import { describe, expect, it } from 'vitest';
import { dependCandidates, gateDocuments, pageWrites, refName } from './writes';

const action = (id: string) => ({ id, command: `jig ${id} a` });

describe('pageWrites', () => {
  it('runs the approval, the abandon and the archive Jig offers', () => {
    const actions = ['start', 'approve-gate', 'abandon', 'archive', 'set-class'].map(action);
    expect([...pageWrites({ actions })]).toEqual(['approve-gate', 'abandon', 'archive']);
    expect([...pageWrites({ actions: [action('pause')] })]).toEqual([]);
  });
});

describe('gateDocuments', () => {
  it('shows the design at a T3 gate, and a T4 its spec and alternatives first where it has them', () => {
    expect(gateDocuments('T3', ['spec', 'alternatives', 'design'])).toEqual(['design']);
    expect(gateDocuments('T4', ['task', 'spec', 'alternatives', 'design'])).toEqual(['spec', 'alternatives', 'design']);
    expect(gateDocuments('T4', ['design'])).toEqual(['design']);
    // Not listed yet: the read of the design says it is not there.
    expect(gateDocuments('T3', [])).toEqual(['design']);
  });
});

describe('refName', () => {
  it("words a dependency's target", () => {
    expect([refName('task:a'), refName('epic:x')]).toEqual(['a', 'epic x']);
    expect([refName('release:x'), refName('foo')]).toEqual(['release:x', 'foo']);
  });
});

describe('dependCandidates', () => {
  it('offers the other live tasks and the open epics, less what the task waits for already', () => {
    expect(dependCandidates('a', ['a', 'b', 'c'], ['x', 'y'], [{ on: 'task:c' }, { on: 'epic:y' }])).toEqual(['task:b', 'epic:x']);
  });
});
