import type { Attention, Project } from '@/api';
import { older } from './upgrade';

/** The person's own commits on staging the base does not have, as Jig 0.46.0's `staging-unowned` item lists them. */
export type OwnStaging = NonNullable<Attention['staging']>;

/** The first Jig whose `staging-unowned` item lists the person's own commits; before it, it counted everyone's. */
const OWN_STAGING_JIG_VERSION = '0.46.0';

/** Mark as known on a card: under way, or what Jig refused, with its reasons, until dismissed. */
export type AckState =
  | { state: 'running' }
  | {
      state: 'refused';
      message: string;
      reasons: string[];
    };

/**
 * The bell beside a project's name: lit with the person's own work on staging, dark on the staging flow while there is
 * none, and none off it or below Jig 0.46.0, whose item lists no commits — it counted everyone's — and stays in the
 * card's list as Jig says it.
 */
export function bellOf(project: Project): { lit: OwnStaging } | 'dark' | undefined {
  if (project.state !== 'ready') return undefined;
  const staging = project.attention.find((a) => a.kind === 'staging-unowned')?.staging;
  if (staging) return { lit: staging };
  return project.stagingFlow && !older(project.jigVersion, OWN_STAGING_JIG_VERSION) ? 'dark' : undefined;
}

/** What needs the person on a card, as Jig ordered it, without the item its bell says. */
export function listed(attention: Attention[]): Attention[] {
  return attention.filter((a) => !(a.kind === 'staging-unowned' && a.staging));
}

/** How many commits the list shows: all of them, or Jig's newest 20 of the exact count. */
export function countOf(staging: OwnStaging): string {
  const n = staging.commits;
  if (staging.list.length < n) return `The newest ${staging.list.length} of ${n} commits of yours`;
  return `${n} commit${n === 1 ? '' : 's'} of yours`;
}
