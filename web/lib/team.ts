import type { Installation, Project } from '../team/api';

/** A line of the person's projects: a repository, and its forks they may write to. */
export interface ProjectGroup {
  id: number;
  fullName: string;
  /** Whether the person may write to it, or it is shown, muted, only as the parent of their forks. */
  writable: boolean;
  forks: Project[];
}

/** The person's projects as the team page lists them: a fork under its parent, by name. */
export function projectGroups(projects: Project[]): ProjectGroup[] {
  const byId = new Map<number, ProjectGroup>();
  const group = (id: number, fullName: string) => byId.get(id) ?? byId.set(id, { id, fullName, writable: false, forks: [] }).get(id)!;
  for (const project of projects) {
    if (project.parent) group(project.parent.id, project.parent.fullName).forks.push(project);
    else group(project.id, project.fullName).writable = true;
  }
  return [...byId.values()].sort((a, b) => a.fullName.localeCompare(b.fullName));
}

const states: Record<Installation['state'], string> = { pending: 'waits for you', approved: 'approved', refused: 'refused' };

/** How the admin's panel shows an installation: its account's kind, its state, and whether it waits for the admin. */
export function installationShown(installation: Installation): {
  kind: string;
  state: string;
  waits: boolean;
} {
  return {
    kind:
      installation.accountType === 'Organization' ? 'organization' : installation.accountType === 'Enterprise' ? 'enterprise' : 'personal',
    state: states[installation.state],
    waits: installation.state === 'pending',
  };
}
