import { describe, expect, it } from 'vitest';
import { agentHoldsGate, needsYou, timeline } from './timeline';

type NeedsDetails = Parameters<typeof needsYou>[0] & Parameters<typeof agentHoldsGate>[0];
type TimelineDetails = Parameters<typeof timeline>[0];

const run = (over: Partial<NonNullable<NeedsDetails['run']>> = {}): NonNullable<NeedsDetails['run']> => ({
  mode: 'autopilot',
  stage: null,
  stageAt: null,
  stopReason: null,
  stopAt: null,
  phase: null,
  ...over,
});

describe('needsYou', () => {
  const quiet: NeedsDetails = { autopilot: null, run: null, attention: [], housekeepingFlags: [], gate: null, gateApprovable: true };

  it('is false where nothing waits for the person', () => {
    expect(needsYou(quiet)).toBe(false);
    expect(needsYou({ ...quiet, autopilot: 'on', run: run({ stopReason: 'a question' }) })).toBe(false);
    // Stopped with no reason Jig kept: there is no question to show.
    expect(needsYou({ ...quiet, autopilot: 'stopped', run: run() })).toBe(false);
  });

  it('is true for a stopped autopilot with its question, an attention item, or a housekeeping flag', () => {
    expect(needsYou({ ...quiet, autopilot: 'stopped', run: run({ stopReason: 'which one?' }) })).toBe(true);
    expect(needsYou({ ...quiet, attention: [{} as unknown as NeedsDetails['attention'][number]] })).toBe(true);
    expect(needsYou({ ...quiet, housekeepingFlags: ['stale'] })).toBe(true);
  });
});

describe('timeline', () => {
  const base: TimelineDetails = { run: null, promotion: null, pullRequest: null, createdAt: null };

  it('has nothing without times', () => {
    expect(timeline(base)).toEqual([]);
  });

  it('lists what happened, the latest first', () => {
    const events = timeline({
      run: run({ stage: 'implement', stageAt: '2026-11-02T10:00:00Z', stopAt: '2026-11-03T10:00:00Z' }),
      promotion: null,
      pullRequest: { url: 'u', state: 'open', ci: null, fetchedAt: '2026-11-04T10:00:00Z' },
      createdAt: '2026-11-01T10:00:00Z',
    });
    expect(events.map((e) => e.text)).toEqual([
      'Pull request heard by housekeeping: open',
      'The autopilot stopped with a question',
      'Entered implement',
      'Filed',
    ]);
  });

  it('takes the promotion over the pull request, and leaves out a stage without its time or name', () => {
    const events = timeline({
      run: run({ stage: 'review' }),
      promotion: { url: null, state: null, ci: null, fetchedAt: '2026-11-05T10:00:00Z' },
      pullRequest: { url: 'u', state: 'open', ci: null, fetchedAt: '2026-11-04T10:00:00Z' },
      createdAt: null,
    });
    expect(events).toEqual([{ at: '2026-11-05T10:00:00Z', text: 'Pull request heard by housekeeping' }]);
  });
});

describe("the gate that is the agent's", () => {
  const item = (kind: string) => ({ kind }) as unknown as NeedsDetails['attention'][number];
  const held: NeedsDetails = {
    autopilot: 'on',
    run: null,
    attention: [item('gate-changed'), item('started-out-of-order')],
    housekeepingFlags: [],
    gate: 'changed',
    gateApprovable: false,
  };

  it("is the agent's only for a waiting or changed gate Jig does not offer, under a run that is on", () => {
    expect(agentHoldsGate(held)).toBe(true);
    expect(agentHoldsGate({ ...held, gate: 'waiting' })).toBe(true);
    expect(agentHoldsGate({ ...held, gateApprovable: true })).toBe(false);
    expect(agentHoldsGate({ ...held, autopilot: 'stopped' })).toBe(false);
    expect(agentHoldsGate({ ...held, gate: 'approved' })).toBe(false);
  });

  it('is not by itself something that needs the person: the quiet line stands beside the panel', () => {
    expect(needsYou({ ...held, attention: [] })).toBe(false);
    expect(needsYou(held)).toBe(true);
  });
});
