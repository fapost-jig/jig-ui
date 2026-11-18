import { describe, expect, it } from 'vitest';
import { cardKey } from './task-key';

describe('cardKey', () => {
  it("names a task with a goal by its tracker's key", () => {
    expect(cardKey('SRD-2598-long-term-storage-threshold', 'Let the warehouse decide', false)).toBe('SRD-2598');
    expect(cardKey('ABC2-17', 'A goal', false)).toBe('ABC2-17');
  });

  it('shows the whole id without a goal, on an open card, or where the id has no key', () => {
    expect(cardKey('SRD-2606-transfer-packing-refusal-not-reported', null, false)).toBeNull();
    expect(cardKey('SRD-2598-long-term-storage-threshold', 'Let the warehouse decide', true)).toBeNull();
    expect(['card-long-id', 'phase-2-items', 'SRD-2598x-long'].map((id) => cardKey(id, 'A goal', false))).toEqual([null, null, null]);
  });
});
