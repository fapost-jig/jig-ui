import type { ReadyDetails } from '../api';
import { agentHoldsGate } from './timeline';

/** A sentence to paste to the person's agent, and when it is the one to use. */
export interface AgentPrompt {
  text: string;
  when: string;
}

/**
 * What the person may ask their agent about a task, by where it stands. The page's writes reach Jig, not an agent: an
 * answer or an approval at the gate waits in the task's state until an agent resumes it, and an agent waiting in a chat
 * does not see it. These say so to it. Jig's actions the page has no button for are asked for in words too.
 */
export function agentPrompts(
  details: Pick<ReadyDetails, 'id' | 'gate' | 'gateApprovable' | 'autopilot' | 'actions' | 'class' | 'status'>,
): AgentPrompt[] {
  const id = details.id;
  const prompts: AgentPrompt[] = [];
  if (agentHoldsGate(details)) {
    prompts.push({
      text: `Stop the autopilot run of ${id} and hand the task over to me: I want to answer its design gate myself.`,
      when: 'the agent approves the design while the run is on',
    });
  } else if (((details.gate === 'waiting' || details.gate === 'changed') && details.gateApprovable) || details.gate === 'answered') {
    prompts.push(
      {
        text: `I answered the gate of ${id} on the board. Read my answer with \`jig task show ${id}\` and rework the design.`,
        when: 'after you send an answer',
      },
      { text: `The design of ${id} is approved. Continue its route.`, when: 'after you approve it' },
    );
  } else if (details.autopilot === 'stopped') {
    prompts.push({
      text: `Read the question ${id}'s autopilot stopped on, and let's settle it: \`jig task show ${id}\`.`,
      when: 'the autopilot waits for you',
    });
  } else {
    prompts.push({
      text: details.status === 'ready' ? `Ship ${id}: consolidate it and open its pull request.` : `Continue ${id} from where it stands.`,
      when: 'in a session that is not running it',
    });
  }
  if (details.actions.some((a) => a.id === 'set-class')) {
    prompts.push({
      text: `Check the class of ${id}${details.class ? ` (now ${details.class})` : ''} against its risk, change it if it is wrong, and run what the new class asks for.`,
      when: 'no button for it on the page',
    });
  }
  return prompts;
}
