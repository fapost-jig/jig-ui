import { describe, expect, it } from 'vitest';
import { Secrets } from './auth.js';
import { TeamStore } from './db.js';
import { setupLine } from './main.js';

describe('setupLine', () => {
  it('prints the setup code at a start until the server has an admin, an App without one included', () => {
    const store = TeamStore.memory();
    const secrets = new Secrets();
    const url = new URL('https://board.test');
    const now = new Date();
    expect(setupLine(store, secrets, url)).toBe(`Not set up yet. Open https://board.test/ and enter the setup code: ${secrets.setupCode}`);
    store.saveApp({ id: 1, slug: 'jig-ui-x', clientId: 'Iv1', clientSecret: 's', webhookSecret: null, pem: 'pem' }, now);
    expect(setupLine(store, secrets, url)).toContain(secrets.setupCode);
    store.createPerson({ githubId: 1, login: 'admin' }, true, now);
    expect(setupLine(store, secrets, url)).toBeNull();
  });
});
