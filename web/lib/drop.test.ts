import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../api';
import { useDrop } from './drop';

const task = (id: string, pauseRequestable: boolean, resumesTo: Task['resumesTo'] = null, pausable = false): Task => ({
  id,
  class: 'T2',
  status: 'active',
  goal: null,
  paused: resumesTo !== null,
  pauseRequest: null,
  pauseRequestable,
  pausable,
  resumable: resumesTo !== null,
  closable: false,
  landable: false,
  reviewRequestable: false,
  promotable: false,
  mergeable: false,
  statusable: false,
  staging: null,
  parked: null,
  stagingFlow: false,
  spec: null,
  promotion: null,
  resumesTo,
  started: true,
  gate: null,
  autopilot: null,
  pullRequest: null,
  priority: null,
  queue: null,
});

const event = () => ({ preventDefault: vi.fn(), dataTransfer: null }) as unknown as DragEvent;

describe('useDrop onto another column', () => {
  it.each([
    ['asks a pause on Paused when Jig offers it', 'paused', true, false, ['a']],
    ['pauses on Paused a task nobody started, which Jig pauses at once', 'paused', false, true, ['a']],
    ['allows nothing on Paused when Jig offers neither', 'paused', false, false, []],
    ['allows nothing on any other column', 'backlog', true, true, []],
  ])('%s', (_, list, requestable, pausable, paused) => {
    const onMove = vi.fn();
    const onPause = vi.fn();
    const drag = useDrop(onMove, onPause, vi.fn(), vi.fn());
    drag.start(event(), 'in-progress', task('a', requestable, null, pausable));
    const over = event();
    drag.over(over, list, []);
    expect(over.preventDefault).toHaveBeenCalledTimes(paused.length);
    drag.drop(list);
    expect(onPause.mock.calls.map(([id]) => id)).toEqual(paused);
    expect(onMove).not.toHaveBeenCalled();
    expect(drag.gap.value).toBeUndefined();
  });
});

describe('useDrop out of Paused', () => {
  it.each([
    ['resumes on the column a resume puts it in', 'in-progress', 'in-progress', ['a']],
    ['allows nothing on another column', 'ready', 'in-progress', []],
    ['allows nothing anywhere when it is not resumable', 'in-progress', null, []],
    // A task paused while parked for prepare for prod resumes onto On staging: a resume there, never a landing.
    ['resumes on On staging, not lands, a card parked there before its pause', 'on-staging', 'on-staging', ['a']],
  ] as const)('%s', (_, list, resumesTo, resumed) => {
    const onMove = vi.fn();
    const onResume = vi.fn();
    const onLand = vi.fn();
    const drag = useDrop(onMove, vi.fn(), onResume, onLand);
    drag.start(event(), 'paused', { ...task('a', false, resumesTo), landable: true });
    const over = event();
    drag.over(over, list, []);
    expect(over.preventDefault).toHaveBeenCalledTimes(resumed.length);
    drag.drop(list);
    expect(onResume.mock.calls.map(([id]) => id)).toEqual(resumed);
    expect(onMove).not.toHaveBeenCalled();
    expect(onLand).not.toHaveBeenCalled();
  });
});

describe('useDrop onto On staging', () => {
  it.each([
    ['lands a Review card Jig offers to land', 'review', true, 'on-staging', ['a']],
    ['allows nothing when Jig does not offer to land it', 'review', false, 'on-staging', []],
    ['allows nothing from another column', 'ready', true, 'on-staging', []],
    ['allows nothing on any other column', 'review', true, 'ready', []],
  ] as const)('%s', (_, from, landable, list, landed) => {
    const onLand = vi.fn();
    const onResume = vi.fn();
    const drag = useDrop(vi.fn(), vi.fn(), onResume, onLand);
    // A parked card is resumable too: its resume puts it in In progress, not on staging.
    drag.start(event(), from, { ...task('a', false), landable, resumable: true, resumesTo: 'in-progress' });
    const over = event();
    drag.over(over, list, []);
    expect(over.preventDefault).toHaveBeenCalledTimes(landed.length);
    drag.drop(list);
    expect(onLand.mock.calls.map(([id]) => id)).toEqual(landed);
    expect(onResume).not.toHaveBeenCalled();
  });

  it('still resumes a Review card dropped on In progress', () => {
    const onLand = vi.fn();
    const onResume = vi.fn();
    const drag = useDrop(vi.fn(), vi.fn(), onResume, onLand);
    drag.start(event(), 'review', { ...task('a', false), landable: true, resumable: true, resumesTo: 'in-progress' });
    drag.over(event(), 'in-progress', []);
    drag.drop('in-progress');
    expect(onResume.mock.calls.map(([id]) => id)).toEqual(['a']);
    expect(onLand).not.toHaveBeenCalled();
  });
});

describe('useDrop on a sorted board', () => {
  it('allows no drop within the list, and still a pause on Paused', () => {
    const onMove = vi.fn();
    const onPause = vi.fn();
    const drag = useDrop(onMove, onPause, vi.fn(), vi.fn());
    drag.start(event(), 'backlog', task('a', true));
    const within = event();
    drag.over(within, 'backlog');
    expect(within.preventDefault).not.toHaveBeenCalled();
    expect(drag.gap.value).toBeUndefined();
    const paused = event();
    drag.over(paused, 'paused');
    expect(paused.preventDefault).toHaveBeenCalledOnce();
    drag.drop('paused');
    expect(onPause.mock.calls.map(([id]) => id)).toEqual(['a']);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('clears the gap another list left when the drag comes back over its own', () => {
    const drag = useDrop(vi.fn(), vi.fn(), vi.fn(), vi.fn());
    drag.start(event(), 'backlog', task('a', true));
    drag.over(event(), 'paused');
    expect(drag.gap.value?.list).toBe('paused');
    drag.over(event(), 'backlog');
    expect(drag.gap.value).toBeUndefined();
  });
});
