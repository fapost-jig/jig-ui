import { describe, expect, it } from 'vitest';
import type { Attention } from './project-source.js';
import { personsAttention } from './attention.js';

const item = (kind: string, tasks: string[]) => ({ kind, tasks }) as unknown as Attention;

describe('personsAttention', () => {
  it('leaves out a gate item of a task whose gate Jig does not offer the person, and keeps every other item', () => {
    const attention = [item('gate-changed', ['a']), item('gate-waiting', ['b']), item('started-out-of-order', ['a'])];
    const kept = personsAttention(attention, (id) => id === 'b');
    expect(kept.map((a) => [a.kind, a.tasks])).toEqual([
      ['gate-waiting', ['b']],
      ['started-out-of-order', ['a']],
    ]);
  });
});
