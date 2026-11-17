import { describe, expect, it } from 'vitest';
import { teamConfig } from './config.js';

describe('teamConfig', () => {
  it('reads the public address and the defaults', () => {
    const config = teamConfig({ JIG_UI_PUBLIC_URL: 'https://board.example.com' }, 4870);
    expect('error' in config).toBe(false);
    if ('error' in config) return;
    expect(config.publicUrl.origin).toBe('https://board.example.com');
    expect(config).toMatchObject({
      dataDir: '/data',
      host: '0.0.0.0',
      port: 4870,
      github: { web: 'https://github.com', api: 'https://api.github.com' },
    });
  });

  it('takes the data folder, the address to listen on and GitHub from the environment', () => {
    const config = teamConfig(
      {
        JIG_UI_PUBLIC_URL: 'http://localhost:4870',
        JIG_UI_DATA: '/tmp/team',
        JIG_UI_HOST: '127.0.0.1',
        GITHUB_URL: 'http://127.0.0.1:9000/',
        GITHUB_API_URL: 'http://127.0.0.1:9001',
      },
      4870,
    );
    expect(config).toMatchObject({
      dataDir: '/tmp/team',
      host: '127.0.0.1',
      github: { web: 'http://127.0.0.1:9000', api: 'http://127.0.0.1:9001' },
    });
  });

  it('refuses to start without a public address, and says what to give', () => {
    expect(teamConfig({}, 4870)).toEqual({ error: expect.stringContaining('JIG_UI_PUBLIC_URL is not set') });
    expect(teamConfig({ JIG_UI_PUBLIC_URL: 'board' }, 4870)).toEqual({ error: expect.stringContaining('not an address') });
  });

  it('refuses plain http anywhere but on this machine', () => {
    expect(teamConfig({ JIG_UI_PUBLIC_URL: 'http://board.example.com' }, 4870)).toEqual({ error: expect.stringContaining('https') });
    expect('error' in teamConfig({ JIG_UI_PUBLIC_URL: 'http://127.0.0.1:4870' }, 4870)).toBe(false);
  });

  it('refuses an address with a path, a query or credentials', () => {
    for (const value of ['https://example.com/board', 'https://example.com/?a=1', 'https://me:pw@example.com']) {
      expect(teamConfig({ JIG_UI_PUBLIC_URL: value }, 4870)).toEqual({ error: expect.stringContaining('origin only') });
    }
  });
});
