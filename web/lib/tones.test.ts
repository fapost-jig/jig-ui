import { describe, expect, it } from 'vitest';
import { endingAccent, endingChip } from './tones';

describe('endingChip', () => {
  it('gives each known ending its chip, and any other the archived one', () => {
    expect(endingChip('closed')).toBe(endingAccent.closed);
    expect(endingChip('abandoned')).toBe(endingAccent.abandoned);
    expect(endingChip('something-new')).toBe(endingAccent.archived);
  });
});
