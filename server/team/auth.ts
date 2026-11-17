import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { TeamStore } from './db.js';
import { pkce } from './github.js';

const TEN_MINUTES = 10 * 60_000;
/** OAuth rounds open at once: anyone may start one, so the oldest goes when a flood reaches this. */
const MAX_ROUNDS = 1000;
const THIRTY_DAYS = 30 * 24 * 60 * 60_000;

const random = (bytes: number): string => randomBytes(bytes).toString('base64url');
const hash = (value: string): string => createHash('sha256').update(value).digest('hex');

function same(given: string, expected: string): boolean {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** What an OAuth round is for: a plain sign-in, linking another account to the person signed in, or the admin's first. */
export type Purpose =
  | { kind: 'sign-in' }
  | {
      kind: 'link';
      personId: number;
    }
  | {
      kind: 'admin';
      setup: string;
    };

/**
 * The secrets of a sign-in that live in this process only, never on disk: the setup code printed in the log, the
 * setups it opened, and OAuth rounds under way. A restart forgets them all, which ends nothing but rounds in flight;
 * a server not set up prints a new code.
 */
export class Secrets {
  /** 128 random bits in hex, in four groups to read off a log. */
  readonly setupCode = (randomBytes(16).toString('hex').match(/.{8}/g) ?? []).join('-');
  private setupSpent = false;
  private readonly setups = new Map<
    string,
    {
      until: number;
      state: string | null;
    }
  >();
  private readonly rounds = new Map<
    string,
    {
      until: number;
      verifier: string;
      purpose: Purpose;
    }
  >();

  constructor(private readonly now: () => number = Date.now) {}

  /**
   * A correct setup code opens a setup for ten minutes; its id goes in a cookie. The code works until the admin signs
   * in, so a setup whose admin sign-in did not finish is taken up again with the same code.
   */
  openSetup(code: string): string | null {
    if (this.setupSpent || !same(code.trim(), this.setupCode)) return null;
    const id = random(32);
    this.setups.set(id, { until: this.now() + TEN_MINUTES, state: null });
    return id;
  }

  private setup(id: string | undefined) {
    const setup = id === undefined ? undefined : this.setups.get(id);
    if (!setup || setup.until <= this.now()) return undefined;
    return setup;
  }

  hasSetup(id: string | undefined): boolean {
    return this.setup(id) !== undefined;
  }

  /** The state the manifest form carries to GitHub and back, bound to the setup that sent it. */
  manifestState(id: string): string | null {
    const setup = this.setup(id);
    if (!setup) return null;
    setup.state = random(24);
    return setup.state;
  }

  /** Whether GitHub came back to the setup that sent the form; once only. */
  takeManifestState(id: string | undefined, state: string): boolean {
    const setup = this.setup(id);
    if (!setup?.state || !same(state, setup.state)) return false;
    setup.state = null;
    return true;
  }

  /** Whether this setup may make its person the admin; once only, and the code is spent with it. */
  takeAdmin(id: string): boolean {
    if (!this.setup(id)) return false;
    this.setups.delete(id);
    this.setupSpent = true;
    return true;
  }

  /**
   * Starts an OAuth round: the state for GitHub's redirect and the PKCE challenge; the verifier stays here. The state
   * also goes in a cookie of the browser that started the round, so GitHub's answer is taken in that browser only.
   */
  startRound(purpose: Purpose): {
    state: string;
    challenge: string;
  } {
    // Rounds are kept in the order they started, so the expired ones and the oldest are first.
    // ponytail: a flood still crowds out a real sign-in in flight; a rate limit at the proxy stops it.
    for (const [key, round] of this.rounds) {
      if (round.until > this.now() && this.rounds.size < MAX_ROUNDS) break;
      this.rounds.delete(key);
    }
    const { verifier, challenge } = pkce();
    const state = random(24);
    this.rounds.set(state, { until: this.now() + TEN_MINUTES, verifier, purpose });
    return { state, challenge };
  }

  /** How many OAuth rounds are open. */
  get openRounds(): number {
    return this.rounds.size;
  }

  /** The round GitHub came back from, in the browser that started it, once only, while it is fresh. */
  takeRound(
    state: string,
    browser: string | undefined,
  ): {
    verifier: string;
    purpose: Purpose;
  } | null {
    if (browser === undefined || !same(browser, state)) return null;
    const round = this.rounds.get(state);
    this.rounds.delete(state);
    if (!round || round.until <= this.now()) return null;
    return { verifier: round.verifier, purpose: round.purpose };
  }
}

/** Sessions: a random id in the person's cookie, only its hash in the database, so a stolen database opens none. */
export const sessions = {
  open(
    store: TeamStore,
    personId: number,
    now: Date,
  ): {
    id: string;
    expires: Date;
  } {
    const id = random(32);
    const expires = new Date(now.getTime() + THIRTY_DAYS);
    store.createSession(hash(id), personId, now, expires);
    return { id, expires };
  },
  person(store: TeamStore, id: string | undefined, now: Date): number | null {
    return id ? store.sessionPerson(hash(id), now) : null;
  },
  end(store: TeamStore, id: string | undefined): void {
    if (id) store.endSession(hash(id));
  },
};
