import type { ReadyDetails } from '../api';

/** Something that happened to a task, and when. */
export interface TimelineEvent {
  at: string;
  text: string;
}

/** Something needs the person beside the gate: the autopilot's question, Jig's attention items, housekeeping's flags. */
export function needsYou(d: Pick<ReadyDetails, 'autopilot' | 'run' | 'attention' | 'housekeepingFlags'>): boolean {
  return (d.autopilot === 'stopped' && !!d.run?.stopReason) || d.attention.length > 0 || d.housekeepingFlags.length > 0;
}

/**
 * The design waits or changed at its gate, but Jig does not offer the person its approval and the autopilot run is on:
 * the run is unattended and the agent approves the design itself. The server leaves Jig's gate item out of the
 * attention then (server/source/attention.ts); the page says whose the gate is instead.
 */
export function agentHoldsGate(d: Pick<ReadyDetails, 'autopilot' | 'gate' | 'gateApprovable'>): boolean {
  return (d.gate === 'waiting' || d.gate === 'changed') && !d.gateApprovable && d.autopilot === 'on';
}

/** What happened to the task, the latest first, from the times Jig keeps. */
export function timeline(d: Pick<ReadyDetails, 'run' | 'promotion' | 'pullRequest' | 'createdAt'>): TimelineEvent[] {
  const pr = d.promotion ?? d.pullRequest;
  const events = [
    d.run?.stopAt && { at: d.run.stopAt, text: 'The autopilot stopped with a question' },
    d.run?.stageAt && d.run.stage && { at: d.run.stageAt, text: `Entered ${d.run.stage}` },
    pr?.fetchedAt && { at: pr.fetchedAt, text: `Pull request heard by housekeeping${pr.state ? `: ${pr.state}` : ''}` },
    d.createdAt && { at: d.createdAt, text: 'Filed' },
  ].filter((e): e is TimelineEvent => !!e);
  return events.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}
