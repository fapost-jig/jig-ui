import { describe, expect, it } from 'vitest';
import { landed, opened, ownedBy, shownDocument } from './documents';

describe('shownDocument', () => {
  it('shows what is read, and a failure for anything Jig answered but its words', () => {
    expect(shownDocument('reading')).toEqual({ state: 'reading' });
    expect(shownDocument('not-found')).toEqual({ state: 'not-found' });
    expect(shownDocument('failed')).toEqual({ state: 'failed' });
    expect(shownDocument({ state: 'ready', content: '# A', lossy: true })).toEqual({ state: 'ready', content: '# A', lossy: true });
    expect(shownDocument({ state: 'unsupported' })).toEqual({ state: 'failed' });
    expect(shownDocument({ state: 'unreadable', code: 'failed' })).toEqual({ state: 'failed' });
    expect(shownDocument({ state: 'unreadable' })).toEqual({ state: 'failed' });
  });

  it('says the epic is nowhere for a roadmap Jig refuses for it, which no Read again helps', () => {
    expect(shownDocument({ state: 'unreadable', code: 'epic-missing' })).toEqual({ state: 'epic-missing' });
  });
});

describe('the open document', () => {
  const roadmap = { owner: 'a', kind: 'roadmap', read: 'reading' } as const;

  it('opens being read, and again (Read again) being read', () => {
    expect(opened('a', 'roadmap')).toEqual(roadmap);
  });

  it('is shown only under its owner, so choosing another spec closes it', () => {
    expect(ownedBy(roadmap, 'a')).toBe(roadmap);
    expect(ownedBy(roadmap, 'b')).toBeUndefined();
    expect(ownedBy(undefined, 'a')).toBeUndefined();
  });

  it('takes a read of the document still open', () => {
    expect(landed(roadmap, { ...roadmap, read: 'failed' })).toEqual({ ...roadmap, read: 'failed' });
  });

  it('discards a late read of a closed or replaced document', () => {
    const late = { owner: 'a', kind: 'roadmap', read: 'failed' } as const;
    expect(landed(undefined, late)).toBeUndefined();
    expect(landed({ ...roadmap, kind: 'spec' }, late)).toEqual({ ...roadmap, kind: 'spec' });
    expect(landed({ ...roadmap, owner: 'b' }, late)).toEqual({ ...roadmap, owner: 'b' });
  });
});
