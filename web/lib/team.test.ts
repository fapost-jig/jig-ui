import { describe, expect, it } from 'vitest';
import type { Installation, Project } from '../team/api';
import { installationShown, projectGroups } from './team';

const project = (id: number, fullName: string, parent: Project['parent'] = null): Project => ({ id, fullName, parent });
const installation = (accountType: string, state: Installation['state']): Installation =>
  ({ id: 1, accountId: 100, accountLogin: 'team', accountType, state }) as Installation;

describe('projectGroups', () => {
  it('puts a fork under its parent, mutes a parent the person may not write to, and sorts by name', () => {
    const groups = projectGroups([
      project(3, 'me/board', { id: 1, fullName: 'team/board' }),
      project(2, 'me/alone'),
      project(4, 'me/notes', { id: 5, fullName: 'team/notes' }),
      project(1, 'team/board'),
    ]);
    expect(groups.map(({ fullName, writable, forks }) => [fullName, writable, forks.map((fork) => fork.fullName)])).toEqual([
      ['me/alone', true, []],
      ['team/board', true, ['me/board']],
      ['team/notes', false, ['me/notes']],
    ]);
  });
});

describe('installationShown', () => {
  it('names the account’s kind and the state, and marks the one that waits for the admin', () => {
    expect(installationShown(installation('Organization', 'pending'))).toEqual({
      kind: 'organization',
      state: 'waits for you',
      waits: true,
    });
    expect(installationShown(installation('User', 'approved'))).toEqual({ kind: 'personal', state: 'approved', waits: false });
    expect(installationShown(installation('Enterprise', 'refused'))).toEqual({ kind: 'enterprise', state: 'refused', waits: false });
  });
});
