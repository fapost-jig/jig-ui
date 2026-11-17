import { chmodSync, closeSync, mkdirSync, openSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

/** The GitHub App the server created through the manifest flow: one row, the server's only forge credentials. */
export interface AppRecord {
  id: number;
  slug: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string | null;
  pem: string;
}

export type InstallationState = 'pending' | 'approved' | 'refused';

export interface InstallationRecord {
  id: number;
  accountId: number;
  accountLogin: string;
  accountType: string;
  state: InstallationState;
}

export interface RepositoryRecord {
  id: number;
  fullName: string;
  fork: boolean;
  parentId: number | null;
  writersEtag: string | null;
}

export interface Person {
  id: number;
  isAdmin: boolean;
  accounts: {
    githubId: number;
    login: string;
  }[];
}

export interface ProjectRecord {
  id: number;
  fullName: string;
  /** A fork's parent, when the App covers it: the fork is shown under it. */
  parent: {
    id: number;
    fullName: string;
  } | null;
}

// Each entry moves the schema one version on; `user_version` says how many have run.
const MIGRATIONS = [
  `CREATE TABLE app (
     id INTEGER PRIMARY KEY, slug TEXT NOT NULL, client_id TEXT NOT NULL, client_secret TEXT NOT NULL,
     webhook_secret TEXT, pem TEXT NOT NULL, created_at TEXT NOT NULL);
   CREATE TABLE installation (
     id INTEGER PRIMARY KEY, account_id INTEGER NOT NULL, account_login TEXT NOT NULL, account_type TEXT NOT NULL,
     state TEXT NOT NULL CHECK (state IN ('pending', 'approved', 'refused')), updated_at TEXT NOT NULL);
   CREATE TABLE person (id INTEGER PRIMARY KEY AUTOINCREMENT, is_admin INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL);
   CREATE TABLE account (
     github_id INTEGER PRIMARY KEY, person_id INTEGER NOT NULL REFERENCES person (id) ON DELETE CASCADE,
     login TEXT NOT NULL, linked_at TEXT NOT NULL);
   CREATE TABLE repository (
     id INTEGER PRIMARY KEY, installation_id INTEGER NOT NULL REFERENCES installation (id) ON DELETE CASCADE,
     full_name TEXT NOT NULL, fork INTEGER NOT NULL, parent_id INTEGER, writers_etag TEXT, polled_at TEXT);
   CREATE TABLE writer (
     repository_id INTEGER NOT NULL REFERENCES repository (id) ON DELETE CASCADE, github_id INTEGER NOT NULL,
     PRIMARY KEY (repository_id, github_id));
   CREATE TABLE session (
     id_hash TEXT PRIMARY KEY, person_id INTEGER NOT NULL REFERENCES person (id) ON DELETE CASCADE,
     created_at TEXT NOT NULL, expires_at TEXT NOT NULL);`,
];

const num = (value: unknown): number => Number(value);
const text = (value: unknown): string => String(value);
const textOrNull = (value: unknown): string | null => (value === null ? null : String(value));
const numOrNull = (value: unknown): number | null => (value === null ? null : Number(value));

/**
 * The team server's database, `team.db` in its data folder, readable by its owner only. It holds the App, the
 * installations and the admin's decision on each, people and their forge accounts, the repositories of approved
 * installations with who may write to them, and sessions by the hash of their id. Never a person's forge token.
 */
export class TeamStore {
  private constructor(private readonly db: DatabaseSync) {}

  /** Opens `team.db` in `dir`, creating it owner-only and bringing its schema up to date. */
  static open(dir: string): TeamStore {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    const file = join(dir, 'team.db');
    // Created owner-only before SQLite opens it; SQLite gives its journal the database's own mode.
    closeSync(openSync(file, 'a', 0o600));
    chmodSync(file, 0o600);
    return TeamStore.over(new DatabaseSync(file));
  }

  /** A database in memory, for tests. */
  static memory(): TeamStore {
    return TeamStore.over(new DatabaseSync(':memory:'));
  }

  private static over(db: DatabaseSync): TeamStore {
    db.exec('PRAGMA foreign_keys = ON');
    const version = num(db.prepare('PRAGMA user_version').get()?.user_version);
    for (let next = version; next < MIGRATIONS.length; next++) {
      db.exec('BEGIN');
      try {
        db.exec(MIGRATIONS[next]!);
        db.exec(`PRAGMA user_version = ${next + 1}`);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    }
    return new TeamStore(db);
  }

  close(): void {
    this.db.close();
  }

  private run(sql: string, ...params: SQLInputValue[]): void {
    this.db.prepare(sql).run(...params);
  }

  private rows(sql: string, ...params: SQLInputValue[]): Record<string, unknown>[] {
    return this.db.prepare(sql).all(...params);
  }

  private transaction<T>(work: () => T): T {
    this.db.exec('BEGIN');
    try {
      const result = work();
      this.db.exec('COMMIT');
      return result;
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  app(): AppRecord | null {
    const row = this.rows('SELECT * FROM app')[0];
    if (!row) return null;
    return {
      id: num(row.id),
      slug: text(row.slug),
      clientId: text(row.client_id),
      clientSecret: text(row.client_secret),
      webhookSecret: textOrNull(row.webhook_secret),
      pem: text(row.pem),
    };
  }

  saveApp(app: AppRecord, now: Date): void {
    this.run(
      'INSERT INTO app (id, slug, client_id, client_secret, webhook_secret, pem, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      app.id,
      app.slug,
      app.clientId,
      app.clientSecret,
      app.webhookSecret,
      app.pem,
      now.toISOString(),
    );
  }

  installations(): InstallationRecord[] {
    return this.rows('SELECT * FROM installation ORDER BY account_login').map((row) => ({
      id: num(row.id),
      accountId: num(row.account_id),
      accountLogin: text(row.account_login),
      accountType: text(row.account_type),
      state: text(row.state) as InstallationState,
    }));
  }

  /** Records an installation GitHub reported: a new one waits for the admin, a known one keeps its state. */
  noteInstallation(installation: Omit<InstallationRecord, 'state'>, now: Date): void {
    this.run(
      `INSERT INTO installation (id, account_id, account_login, account_type, state, updated_at) VALUES (?, ?, ?, ?, 'pending', ?)
       ON CONFLICT (id) DO UPDATE SET account_login = excluded.account_login, account_type = excluded.account_type`,
      installation.id,
      installation.accountId,
      installation.accountLogin,
      installation.accountType,
      now.toISOString(),
    );
  }

  /** The admin's decision. Anything but approved takes the installation's repositories off the server. */
  decideInstallation(id: number, state: Exclude<InstallationState, 'pending'>, now: Date): boolean {
    return this.transaction(() => {
      const changed = this.db.prepare('UPDATE installation SET state = ?, updated_at = ? WHERE id = ?').run(state, now.toISOString(), id);
      if (state !== 'approved') this.run('DELETE FROM repository WHERE installation_id = ?', id);
      return Number(changed.changes) > 0;
    });
  }

  /** An installation GitHub no longer has: it goes with its repositories. */
  removeInstallation(id: number): void {
    this.run('DELETE FROM installation WHERE id = ?', id);
  }

  /** Takes an installation's repositories off the server, its decision kept: a suspended one, until it is back. */
  clearRepositories(installationId: number): void {
    this.run('DELETE FROM repository WHERE installation_id = ?', installationId);
  }

  repositories(installationId: number): RepositoryRecord[] {
    return this.rows('SELECT * FROM repository WHERE installation_id = ? ORDER BY full_name', installationId).map((row) => ({
      id: num(row.id),
      fullName: text(row.full_name),
      fork: Boolean(row.fork),
      parentId: numOrNull(row.parent_id),
      writersEtag: textOrNull(row.writers_etag),
    }));
  }

  /** A repository of an approved installation as GitHub listed it; only an approved one is ever kept. */
  noteRepository(installationId: number, repository: Pick<RepositoryRecord, 'id' | 'fullName' | 'fork'>): void {
    this.run(
      `INSERT INTO repository (id, installation_id, full_name, fork)
       SELECT ?, id, ?, ? FROM installation WHERE id = ? AND state = 'approved'
       ON CONFLICT (id) DO UPDATE SET installation_id = excluded.installation_id, full_name = excluded.full_name, fork = excluded.fork`,
      repository.id,
      repository.fullName,
      repository.fork ? 1 : 0,
      installationId,
    );
  }

  /** The installation's repositories are exactly these: the rest leave the server. */
  replaceRepositories(installationId: number, repositories: Pick<RepositoryRecord, 'id' | 'fullName' | 'fork'>[]): void {
    this.transaction(() => {
      const keep = new Set(repositories.map((repository) => repository.id));
      for (const known of this.repositories(installationId)) {
        if (!keep.has(known.id)) this.run('DELETE FROM repository WHERE id = ?', known.id);
      }
      for (const repository of repositories) this.noteRepository(installationId, repository);
    });
  }

  removeRepositories(ids: number[]): void {
    this.transaction(() => {
      for (const id of ids) this.run('DELETE FROM repository WHERE id = ?', id);
    });
  }

  setParent(repositoryId: number, parentId: number): void {
    this.run('UPDATE repository SET parent_id = ? WHERE id = ?', parentId, repositoryId);
  }

  /** Who may write to the repository now, as the poll read it, with the answer's ETag. */
  setWriters(repositoryId: number, githubIds: number[], etag: string | null, now: Date): void {
    this.transaction(() => {
      this.run('DELETE FROM writer WHERE repository_id = ?', repositoryId);
      for (const id of new Set(githubIds)) this.run('INSERT INTO writer (repository_id, github_id) VALUES (?, ?)', repositoryId, id);
      this.run('UPDATE repository SET writers_etag = ?, polled_at = ? WHERE id = ?', etag, now.toISOString(), repositoryId);
    });
  }

  /** A writer seen at sign-in, before the poll confirms it; the ETag is dropped so the next poll reads the list whole. */
  addWriter(repositoryId: number, githubId: number): void {
    this.transaction(() => {
      this.run('INSERT OR IGNORE INTO writer (repository_id, github_id) SELECT id, ? FROM repository WHERE id = ?', githubId, repositoryId);
      this.run('UPDATE repository SET writers_etag = NULL WHERE id = ?', repositoryId);
    });
  }

  /** The person a forge account belongs to, if any. */
  personOf(githubId: number): number | null {
    const row = this.rows('SELECT person_id FROM account WHERE github_id = ?', githubId)[0];
    return row ? num(row.person_id) : null;
  }

  createPerson(account: Person['accounts'][number], isAdmin: boolean, now: Date): number {
    return this.transaction(() => {
      const created = this.db.prepare('INSERT INTO person (is_admin, created_at) VALUES (?, ?)').run(isAdmin ? 1 : 0, now.toISOString());
      const id = Number(created.lastInsertRowid);
      this.linkAccount(id, account, now);
      return id;
    });
  }

  /** Adds a forge account to a person, or updates its login. Refuses one that belongs to someone else. */
  linkAccount(personId: number, account: Person['accounts'][number], now: Date): boolean {
    const owner = this.personOf(account.githubId);
    if (owner !== null && owner !== personId) return false;
    this.run(
      `INSERT INTO account (github_id, person_id, login, linked_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (github_id) DO UPDATE SET login = excluded.login`,
      account.githubId,
      personId,
      account.login,
      now.toISOString(),
    );
    return true;
  }

  makeAdmin(personId: number): void {
    this.run('UPDATE person SET is_admin = 1 WHERE id = ?', personId);
  }

  /** Whether the setup is finished: the App exists and its admin signed in. */
  hasAdmin(): boolean {
    return this.rows('SELECT 1 FROM person WHERE is_admin = 1 LIMIT 1').length > 0;
  }

  person(id: number): Person | null {
    const row = this.rows('SELECT * FROM person WHERE id = ?', id)[0];
    if (!row) return null;
    const accounts = this.rows('SELECT github_id, login FROM account WHERE person_id = ? ORDER BY linked_at, github_id', id).map(
      (account) => ({
        githubId: num(account.github_id),
        login: text(account.login),
      }),
    );
    return { id, isAdmin: Boolean(row.is_admin), accounts };
  }

  /** The repositories of approved installations that any of the person's accounts may write to. */
  projects(personId: number): ProjectRecord[] {
    return this.rows(
      `SELECT DISTINCT r.id, r.full_name, p.id AS parent_id, p.full_name AS parent_name FROM repository r
       JOIN installation i ON i.id = r.installation_id AND i.state = 'approved'
       JOIN writer w ON w.repository_id = r.id
       JOIN account a ON a.github_id = w.github_id AND a.person_id = ?
       LEFT JOIN repository p ON p.id = r.parent_id
       ORDER BY r.full_name`,
      personId,
    ).map((row) => ({
      id: num(row.id),
      fullName: text(row.full_name),
      parent: row.parent_id === null ? null : { id: num(row.parent_id), fullName: text(row.parent_name) },
    }));
  }

  createSession(idHash: string, personId: number, now: Date, expiresAt: Date): void {
    this.run(
      'INSERT INTO session (id_hash, person_id, created_at, expires_at) VALUES (?, ?, ?, ?)',
      idHash,
      personId,
      now.toISOString(),
      expiresAt.toISOString(),
    );
  }

  /** The person of a live session; an expired one is removed on the way. */
  sessionPerson(idHash: string, now: Date): number | null {
    this.run('DELETE FROM session WHERE expires_at <= ?', now.toISOString());
    const row = this.rows('SELECT person_id FROM session WHERE id_hash = ?', idHash)[0];
    return row ? num(row.person_id) : null;
  }

  endSession(idHash: string): void {
    this.run('DELETE FROM session WHERE id_hash = ?', idHash);
  }

  /** Ends every session of the person a forge account belongs to: they revoked the App. */
  endSessionsOf(githubId: number): void {
    this.run('DELETE FROM session WHERE person_id = (SELECT person_id FROM account WHERE github_id = ?)', githubId);
  }
}
