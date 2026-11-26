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
