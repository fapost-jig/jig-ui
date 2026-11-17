import type { TeamStore } from './db.js';
import { appJwt, type GitHub, GitHubError } from './github.js';

export const POLL_EVERY = 5 * 60_000;

export interface PollDeps {
  store: TeamStore;
  github: GitHub;
  now: () => Date;
  /** A line for the server's log: what failed and why, never a token. */
  log: (line: string) => void;
}

const why = (error: unknown): string => (error instanceof GitHubError ? `${error.code}: ${error.message}` : String(error));

/**
 * One installation's repositories, each fork's parent once, and who may write to each, the unchanged lists answered by
 * their ETag. Only an approved installation is read: the store keeps no repository of any other. One repository
 * failing keeps its last answer and does not stop the others.
 */
export async function pollInstallation({ store, github, now, log }: PollDeps, installationId: number): Promise<void> {
  const app = store.app();
  const installation = store.installations().find((one) => one.id === installationId);
  if (!app || installation?.state !== 'approved') return;
  const jwt = () => appJwt(app.id, app.pem, now());
  const token = await github.installationToken(jwt, installationId);
  store.replaceRepositories(installationId, await github.installationRepositories(token));
  for (const repository of store.repositories(installationId)) {
    try {
      if (repository.fork && repository.parentId === null) {
        const parent = await github.parentOf(token, repository.fullName);
        if (parent !== null) store.setParent(repository.id, parent);
      }
      const writers = await github.writers(token, repository.fullName, repository.writersEtag);
      if (!writers.unchanged) store.setWriters(repository.id, writers.ids, writers.etag, now());
    } catch (error) {
      log(`Could not read ${repository.fullName}: ${why(error)}`);
    }
  }
}

/**
 * Every installation GitHub has for the App: a new one is recorded waiting for the admin, one GitHub no longer has
 * leaves with its repositories, a suspended one shows none until it is back, and each approved one is read again.
 * One installation failing does not stop the others.
 */
export async function pollAll(deps: PollDeps): Promise<void> {
  const { store, github, now, log } = deps;
  const app = store.app();
  if (!app) return;
  const installations = await github.appInstallations(appJwt(app.id, app.pem, now()));
  const listed = new Set(installations.map((installation) => installation.id));
  for (const known of store.installations()) if (!listed.has(known.id)) store.removeInstallation(known.id);
  for (const installation of installations) {
    if (!installation.account) continue;
    store.noteInstallation(
      {
        id: installation.id,
        accountId: installation.account.id,
        accountLogin: installation.account.login,
        accountType: installation.account.type,
      },
      now(),
    );
  }
  for (const installation of installations) {
    if (installation.suspended) {
      store.clearRepositories(installation.id);
      continue;
    }
    await pollInstallation(deps, installation.id).catch((error: unknown) =>
      log(`Could not read installation ${installation.id}: ${why(error)}`),
    );
  }
}

/** Polls every five minutes, one pass at a time; `soon` asks for a pass now, run after the one under way. */
export function poller(
  deps: PollDeps,
  every = POLL_EVERY,
): {
  soon: () => Promise<void>;
  stop: () => void;
} {
  let running: Promise<void> | null = null;
  let again = false;
  const pass = (): Promise<void> => {
    if (running) {
      again = true;
      return running;
    }
    running = pollAll(deps)
      .catch((error: unknown) => deps.log(`Could not read the App's installations: ${why(error)}`))
      .finally(() => {
        running = null;
        if (again) {
          again = false;
          void pass();
        }
      });
    return running;
  };
  const timer = setInterval(() => void pass(), every);
  timer.unref();
  return { soon: pass, stop: () => clearInterval(timer) };
}
