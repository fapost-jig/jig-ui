import { describe, expect, it } from 'vitest';
import { agentPrompts } from './agent-prompts';

type Details = Parameters<typeof agentPrompts>[0];
const details = (over: Partial<Details> = {}): Details => ({
  id: 'a',
  gate: null,
  gateApprovable: true,
  autopilot: null,
  actions: [],
  class: 'T2',
  status: 'active',
  ...over,
});

describe('agentPrompts', () => {
  it.each(['waiting', 'changed', 'answered'])(
    'asks the agent to read the answer and to continue after approval at a gate that is %s',
    (gate) => {
      const prompts = agentPrompts(details({ gate }));
      expect(prompts.map((p) => p.when)).toEqual(['after you send an answer', 'after you approve it']);
      expect(prompts[0]!.text).toContain('jig task show a');
    },
  );

  it('offers one prompt to stop the run where the agent approves the gate while an unattended run is on', () => {
    for (const gate of ['waiting', 'changed']) {
      const prompts = agentPrompts(details({ gate, gateApprovable: false, autopilot: 'on' }));
      expect(prompts).toEqual([
        {
          text: 'Stop the autopilot run of a and hand the task over to me: I want to answer its design gate myself.',
          when: 'the agent approves the design while the run is on',
        },
      ]);
    }
  });

  it('asks the person to settle the question a stopped autopilot waits on', () => {
    const prompts = agentPrompts(details({ autopilot: 'stopped' }));
    expect(prompts).toHaveLength(1);
    expect(prompts[0]).toMatchObject({ when: 'the autopilot waits for you' });
  });

  it("asks for the stopped run's question, not the gate, where Jig does not offer the person the gate", () => {
    expect(agentPrompts(details({ gate: 'changed', gateApprovable: false, autopilot: 'stopped' }))[0]!.when).toBe(
      'the autopilot waits for you',
    );
  });

  it('puts the gate before a stopped autopilot', () => {
    expect(agentPrompts(details({ gate: 'waiting', autopilot: 'stopped' }))[0]!.when).toBe('after you send an answer');
  });

  it('asks a ready task to be shipped, and any other to be continued', () => {
    expect(agentPrompts(details({ status: 'ready' }))[0]!.text).toBe('Ship a: consolidate it and open its pull request.');
    expect(agentPrompts(details({ status: 'active' }))[0]!.text).toBe('Continue a from where it stands.');
    // A gate that is not open falls to the same sentence.
    expect(agentPrompts(details({ gate: 'approved' }))[0]!.text).toBe('Continue a from where it stands.');
  });

  it('asks for the class check where Jig offers set-class and the page has no button, naming the class when it has one', () => {
    const actions = [{ id: 'set-class', command: 'jig task set a class' }] as Details['actions'];
    expect(agentPrompts(details({ actions }))[1]!.text).toContain('(now T2)');
    expect(agentPrompts(details({ actions, class: null }))[1]!.text).not.toContain('now');
    expect(agentPrompts(details())).toHaveLength(1);
  });
});
