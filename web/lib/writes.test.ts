import { describe, expect, it } from 'vitest';
import { dependCandidates, gateDocuments, listedActions, pageWrites, refName, startRequest } from './writes';

const action = (id: string) => ({ id, command: `jig ${id} a` });

describe('pageWrites', () => {
  it('runs the approval, the abandon and the archive Jig offers, and none on a Jig before 0.46.0', () => {
    const actions = ['start', 'approve-gate', 'abandon', 'archive', 'set-class'].map(action);
    expect([...pageWrites({ actions, writes: true })]).toEqual(['approve-gate', 'abandon', 'archive']);
    expect([...pageWrites({ actions: [action('pause')], writes: true })]).toEqual([]);
    expect([...pageWrites({ actions, writes: false })]).toEqual([]);
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

describe('startRequest and refName', () => {
  it("words the agent's request and a dependency's target", () => {
    expect(startRequest('a', 'shop')).toBe('Start task a in shop');
    expect([refName('task:a'), refName('epic:x')]).toEqual(['a', 'epic x']);
  });
});

describe('listedActions', () => {
  const offered = ['start', 'approve-gate', 'pause'].map(action);

  it('leaves out what the page runs, and asks the agent to start the task on a Jig that takes a person’s writes', () => {
    expect(listedActions(offered, new Set(['approve-gate']), true, 'a', 'shop')).toEqual([
      { id: 'start', command: 'Start task a in shop', asks: true },
      { id: 'pause', command: 'jig pause a', asks: false },
    ]);
  });

  it("shows Jig's own commands below 0.46.0", () => {
    expect(listedActions(offered, new Set(), false, 'a', 'shop')).toEqual(offered.map((a) => ({ ...a, asks: false })));
  });
});

describe('dependCandidates', () => {
  it('offers the other live tasks and the open epics, less what the task waits for already', () => {
    expect(dependCandidates('a', ['a', 'b', 'c'], ['x', 'y'], [{ on: 'task:c' }, { on: 'epic:y' }])).toEqual(['task:b', 'epic:x']);
  });
});
