import { createHmac } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { same, sessions } from './auth.js';
import type { Secrets } from './auth.js';
import type { TeamStore } from './db.js';

/** The session cookie: `__Host-` makes the browser refuse it unless it is Secure, for this host only, on `/`. */
export const SESSION_COOKIE = '__Host-jig-ui-team';
/** The setup a correct code opened, for ten minutes. */
export const SETUP_COOKIE = '__Host-jig-ui-setup';
/** The OAuth round this browser started, for ten minutes: GitHub's answer is taken in that browser only. */
export const ROUND_COOKIE = '__Host-jig-ui-round';

export interface TeamVariables {
  personId: number;
  webhookBody: string;
}

const jsonRefusal = (status: 401 | 403 | 404, code: string, message: string) => Response.json({ error: { code, message } }, { status });

/** Refuses a request whose `Host` is not the public address's, and one whose `Origin` is another's; a write must name it. */
export function publicOnly(publicUrl: URL): MiddlewareHandler {
  const host = publicUrl.host.toLowerCase();
  return async (c, next) => {
    if (c.req.header('host')?.toLowerCase() !== host) return c.text('Forbidden', 403);
    const origin = c.req.header('origin');
    if (origin !== undefined && origin.toLowerCase() !== publicUrl.origin) return c.text('Forbidden', 403);
    // A browser names its origin on every write; GitHub's webhook names none and is held to its signature instead.
    const write = c.req.method !== 'GET' && c.req.method !== 'HEAD';
    if (write && origin === undefined && c.req.path !== '/webhook/github') return c.text('Forbidden', 403);
    await next();
  };
}

export function setSession(c: Parameters<MiddlewareHandler>[0], id: string, expires: Date): void {
  setCookie(c, SESSION_COOKIE, id, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', expires });
}

export function clearSession(c: Parameters<MiddlewareHandler>[0]): void {
  deleteCookie(c, SESSION_COOKIE, { path: '/', secure: true });
}

export function setSetup(c: Parameters<MiddlewareHandler>[0], id: string): void {
  setCookie(c, SETUP_COOKIE, id, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 600 });
}

export function setRound(c: Parameters<MiddlewareHandler>[0], state: string): void {
  setCookie(c, ROUND_COOKIE, state, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: 600 });
}

export function clearRound(c: Parameters<MiddlewareHandler>[0]): void {
  deleteCookie(c, ROUND_COOKIE, { path: '/', secure: true });
}

/** What the guard reads: the server's store, its secrets and the clock. */
export interface AccessDeps {
  store: TeamStore;
  secrets: Secrets;
  now: () => Date;
}

/**
 * Who may reach what, decided here and nowhere else (convention-access-guard): the setup only while the server has no
 * admin, the App's creation only while it has no App, and either only with the setup cookie past its first step;
 * sign-in only once there is an App, the admin's only with the setup cookie while there is no admin; `/api/team/*`
 * with a live session, the admin's routes with the admin's; GitHub's webhook with its signature. What a sign-in or the
 * App's creation proves is its route's to check — `/auth/callback`'s round this browser started, the person a link
 * began with and the setup that makes the admin; `/setup/done`'s manifest state of this browser's setup —: those check a
 * credential's round, not who may reach a route.
 */
export function teamAccess({ store, secrets, now }: AccessDeps): MiddlewareHandler<{ Variables: TeamVariables }> {
  return async (c, next) => {
    const path = c.req.path;
    const app = store.app();
    // A page the browser navigates to — a sign-in link, GitHub's answer — goes back to the page, which says why in words
    // (`problems` in web/team/api.ts, one for each code); the API answers in its own form.
    const navigation = c.req.method === 'GET' && (path === '/setup/done' || path.startsWith('/auth/'));
    const refuse = (status: 401 | 403 | 404, code: string, message: string) =>
      navigation ? c.redirect(`/?problem=${code}`, 302) : jsonRefusal(status, code, message);
    if (path === '/webhook/github') {
      if (!app?.webhookSecret) return refuse(404, 'no-webhook', 'This server takes no webhook.');
      const body = await c.req.text();
      const expected = `sha256=${createHmac('sha256', app.webhookSecret).update(body).digest('hex')}`;
      if (!same(c.req.header('x-hub-signature-256') ?? '', expected)) return refuse(401, 'bad-signature', 'The signature does not match.');
      c.set('webhookBody', body);
      return next();
    }
    if (path === '/api/team/setup' || path === '/api/team/setup/manifest' || path === '/setup/done') {
      if (store.hasAdmin()) return refuse(404, 'set-up', 'This server is set up already.');
      if (app && path !== '/api/team/setup') return refuse(404, 'app-exists', 'The App exists already: its admin signs in next.');
      if (path !== '/api/team/setup' && !secrets.hasSetup(getCookie(c, SETUP_COOKIE))) {
        // GitHub's answer after the setup's ten minutes is the one /setup/done refuses for a state not this browser's.
        return refuse(403, navigation ? 'bad-state' : 'no-setup', 'Enter the setup code from the server’s log first.');
      }
      return next();
    }
    if (path.startsWith('/auth/')) {
      if (!app) return refuse(404, 'not-set-up', 'This server is not set up yet.');
      const as = path === '/auth/sign-in' ? c.req.query('as') : undefined;
      if (as === 'admin' && store.hasAdmin()) return refuse(403, 'set-up', 'This server has its admin already.');
      if (as === 'admin' && !secrets.hasSetup(getCookie(c, SETUP_COOKIE))) {
        return refuse(403, 'no-setup', 'Only a setup opened with the code signs the admin in, and only the first.');
      }
      if (as === 'link') {
        const personId = sessions.person(store, getCookie(c, SESSION_COOKIE), now());
        if (personId === null) return refuse(401, 'unauthorized', 'Sign in first, then link another account.');
        c.set('personId', personId);
      }
      return next();
    }
    if (path === '/api/team/state') return next();
    if (path === '/api/team' || path.startsWith('/api/team/')) {
      if (!app) return refuse(404, 'not-set-up', 'This server is not set up yet.');
      const personId = sessions.person(store, getCookie(c, SESSION_COOKIE), now());
      const person = personId === null ? null : store.person(personId);
      if (!person) return refuse(401, 'unauthorized', 'Sign in first.');
      if (path.startsWith('/api/team/admin/') && !person.isAdmin) return refuse(403, 'not-admin', 'Only the server’s admin may do this.');
      c.set('personId', person.id);
      return next();
    }
    return next();
  };
}
