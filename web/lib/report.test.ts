import { beforeEach, describe, expect, it, vi } from 'vitest';

interface Shown {
  kind: string;
  title: string;
  options: any;
}

const calls = vi.hoisted(() => ({ shown: [] as Shown[], dismissed: [] as string[] }));

vi.mock('vue-sonner', () => {
  const make = (kind: string) => (title: string, options: unknown) => void calls.shown.push({ kind, title, options });
  return {
    toast: {
      loading: make('loading'),
      success: make('success'),
      info: make('info'),
      warning: make('warning'),
      error: make('error'),
      dismiss: (id: string) => void calls.dismissed.push(id),
    },
  };
});

import { kindOf, reporter } from './report';

const last = () => calls.shown[calls.shown.length - 1]!;

beforeEach(() => {
  calls.shown.length = 0;
  calls.dismissed.length = 0;
});

describe('reporter', () => {
  it('raises each report under a fresh id and drops the previous one', () => {
    const r = reporter('upgrade:a');
    r.show({ kind: 'loading', title: 'one' });
    r.show({ kind: 'success', title: 'two' });
    const [first, second] = calls.shown;
    expect(first!.options.id).not.toBe(second!.options.id);
    expect(second!.options.id).toMatch(/^upgrade:a#/);
    expect(calls.dismissed).toEqual([first!.options.id]);
  });

  it('sets every option explicitly, so nothing of the last report carries over', () => {
    const r = reporter('k');
    r.show({ kind: 'error', title: 'a', description: 'd', action: { label: 'Go', run: () => {} } });
    r.show({ kind: 'error', title: 'b' });
    expect(last().options.description).toBeUndefined();
    expect(last().options.action).toBeUndefined();
  });

  it('keeps successes and info for 8 s and the rest until closed', () => {
    const r = reporter('k');
    const duration = (kind: 'loading' | 'success' | 'info' | 'warning' | 'error') => {
      r.show({ kind, title: kind });
      return last().options.duration;
    };

    expect(duration('success')).toBe(8000);
    expect(duration('info')).toBe(8000);
    expect(duration('loading')).toBe(Infinity);
    expect(duration('warning')).toBe(Infinity);
    expect(duration('error')).toBe(Infinity);
  });

  it('runs onClosed when the current toast is closed by the person or by itself', () => {
    const closed = vi.fn();
    const r = reporter('k', closed);
    r.show({ kind: 'success', title: 'a' });
    last().options.onDismiss();
    expect(closed).toHaveBeenCalledTimes(1);
    r.show({ kind: 'success', title: 'b' });
    last().options.onAutoClose();
    expect(closed).toHaveBeenCalledTimes(2);
  });

  it('does not run onClosed for a toast replaced or cleared', () => {
    const closed = vi.fn();
    const r = reporter('k', closed);
    r.show({ kind: 'warning', title: 'a' });
    const old = last().options;
    r.show({ kind: 'warning', title: 'b' });
    old.onDismiss();
    old.onAutoClose();
    r.clear();
    last().options.onDismiss();
    expect(closed).not.toHaveBeenCalled();
    expect(calls.dismissed).toHaveLength(2);
  });

  it('runs an action without closing the toast', () => {
    const run = vi.fn();
    const r = reporter('k');
    r.show({ kind: 'warning', title: 'a', action: { label: 'Steps', run } });
    const event = { preventDefault: vi.fn() };
    expect(last().options.action.label).toBe('Steps');
    last().options.action.onClick(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(run).toHaveBeenCalled();
  });
});

describe('kindOf', () => {
  it('keeps what went wrong and what needs a look, and lets what went well or is only said go', () => {
    expect(kindOf('bad')).toBe('error');
    expect(kindOf('attention')).toBe('warning');
    expect(kindOf('good')).toBe('success');
    expect(kindOf('quiet')).toBe('info');
  });
});
