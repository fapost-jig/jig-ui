import type { Attention } from './project-source.js';

/** Jig's kinds of attention item that ask the person to decide a task's design at its gate. */
const GATE_KINDS = new Set(['gate-waiting', 'gate-changed']);

/**
 * Jig's attention items that are the person's. Jig lists a design waiting or changed at its gate even under an
 * unattended autopilot run that is on, where it refuses the person the approval: the agent approves it. Such an item
 * is left out — `gateApprovable` names the tasks whose gate Jig offers the person (its `approve-gate`) — so neither
 * the project's count nor the task's page sends the person to a gate nobody waits on them at. Every other item stays.
 */
export function personsAttention(attention: Attention[], gateApprovable: (task: string) => boolean): Attention[] {
  return attention.filter((a) => !GATE_KINDS.has(a.kind) || a.tasks.some(gateApprovable));
}
