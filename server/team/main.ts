import { serve } from '@hono/node-server';
import { createTeamApp } from './app.js';
import { Secrets } from './auth.js';
import { teamConfig } from './config.js';
import { TeamStore } from './db.js';
import { gitHub } from './github.js';
import { pollInstallation, poller } from './poll.js';

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** What a start logs while the server has no admin: the setup code its first visitor enters. Nothing once it has one. */
export function setupLine(store: TeamStore, secrets: Secrets, publicUrl: URL): string | null {
  return store.hasAdmin() ? null : `Not set up yet. Open ${publicUrl.origin}/ and enter the setup code: ${secrets.setupCode}`;
}

/**
 * The team server in this process: one database in the data folder, the App it registered, and the poll that keeps
 * membership fresh. A server with no admin yet prints the setup code its first visitor enters.
 */
export function runTeamServer(port: number, version: string): void {
  const config = teamConfig(process.env, port);
  if ('error' in config) fail(config.error);
  let store: TeamStore;
  try {
    store = TeamStore.open(config.dataDir);
  } catch (error) {
    fail(`Could not open the database in ${config.dataDir}: ${error instanceof Error ? error.message : String(error)}`);
  }
  const secrets = new Secrets();
  const github = gitHub(config.github);
  const log = (line: string): void => console.log(line);
  const deps = { store, github, now: () => new Date(), log };
  const polling = poller(deps);
  const app = createTeamApp({
    config,
    store,
    github,
    secrets,
    pollSoon: () => polling.soon(),
    pollInstallation: (id) => pollInstallation(deps, id),
    log,
  });

  const server = serve({ fetch: app.fetch, hostname: config.host, port }, () => {
    console.log(`Jig UI ${version} team server is listening on ${config.host}:${port}, for ${config.publicUrl.origin}`);
    if (store.app()) void polling.soon();
    const line = setupLine(store, secrets, config.publicUrl);
    if (line) console.log(line);
  });
  server.on('error', (error: Error) => fail(`Could not start the team server: ${error.message}`));

  const shutdown = (): void => {
    polling.stop();
    server.close(() => {
      store.close();
      process.exit(0);
    });
    if ('closeAllConnections' in server) server.closeAllConnections();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
