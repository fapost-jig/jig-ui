import { link, type Task } from '../api';
import { ciDot, notHeardDot } from './tones';

/** A pull request as a chip shows it: its number, its link, its CI as a dot, and what it stands at in words. */
export interface ShownPull {
  url: string | undefined;
  number: string;
  dot: string | undefined;
  title: string;
}

/**
 * The task's pull request a chip shows — the promotion once there is one —, by its number, with its CI; `undefined`
 * without one. Not heard yet (housekeeping has not asked the forge since it opened) is a hollow dot.
 */
export function shownPull(task: Pick<Task, 'pullRequest' | 'promotion'>): ShownPull | undefined {
  const p = task.promotion?.url ? task.promotion : task.pullRequest;
  if (!p) return undefined;
  const number = /\/(?:pull|merge_requests)\/(\d+)/.exec(p.url ?? '')?.[1];
  return {
    url: link(p.url),
    number: number ? `#${number}` : 'PR',
    dot: p.ci ? ciDot[p.ci] : p.fetchedAt === null ? notHeardDot : undefined,
    title:
      p.fetchedAt === null
        ? 'Pull request: CI not heard yet — run Housekeeping'
        : `Pull request ${p.state ?? 'opened'}${p.ci && p.ci !== 'none' ? `, CI ${p.ci}` : ''}`,
  };
}
