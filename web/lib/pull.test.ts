import { describe, expect, it } from 'vitest';
import { shownPull } from './pull';
import { ciDot, notHeardDot } from './tones';

const pr = (
  over: Partial<{
    url: string;
    state: string | null;
    ci: string | null;
    fetchedAt: string | null;
  }> = {},
) => ({
  url: 'https://github.com/o/r/pull/12',
  state: 'open',
  ci: null,
  fetchedAt: '2026-11-26T10:00:00Z',
  ...over,
});

describe('shownPull', () => {
  it('shows nothing without a pull request or a promotion', () => {
    expect(shownPull({ pullRequest: null, promotion: null })).toBeUndefined();
  });

  it('shows the pull request by its number, with its CI as a dot', () => {
    expect(shownPull({ pullRequest: pr({ ci: 'green' }), promotion: null })).toEqual({
      url: 'https://github.com/o/r/pull/12',
      number: '#12',
      dot: ciDot.green,
      title: 'Pull request open, CI green',
    });
  });

  it('shows the promotion once there is one, in place of the pull request into staging', () => {
    const shown = shownPull({
      pullRequest: pr(),
      promotion: { url: 'https://gitlab.com/o/r/-/merge_requests/30', state: 'open', ci: 'red', fetchedAt: '2026-11-26T10:00:00Z' },
    });
    expect(shown).toMatchObject({ number: '#30', dot: ciDot.red });
  });

  it('keeps the pull request while the promotion has no url yet', () => {
    const promotion = { url: null, state: null, ci: null, fetchedAt: null };
    expect(shownPull({ pullRequest: pr(), promotion })?.number).toBe('#12');
    expect(shownPull({ pullRequest: null, promotion })).toBeUndefined();
  });

  it('calls a pull request without a number PR, and says nothing of CI when there is none', () => {
    const shown = shownPull({ pullRequest: pr({ url: 'https://example.com/x', ci: 'none', state: null }), promotion: null });
    expect(shown).toMatchObject({ number: 'PR', dot: undefined, title: 'Pull request opened' });
  });

  it('shows a hollow dot while the forge has not been heard', () => {
    expect(shownPull({ pullRequest: pr({ fetchedAt: null }), promotion: null })).toMatchObject({
      dot: notHeardDot,
      title: 'Pull request: CI not heard yet — run Housekeeping',
    });
  });
});
