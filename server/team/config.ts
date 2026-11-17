/** The team server's settings, read from its environment once at start. */
export interface TeamConfig {
  /** The address people open, as the reverse proxy serves it; `Host`, `Origin` and every URL given to GitHub come from it. */
  publicUrl: URL;
  /** Where `team.db` lives: the container's volume. */
  dataDir: string;
  /** The address to listen on. Not only 127.0.0.1: here the guard is a person's session, not the local token. */
  host: string;
  port: number;
  /** github.com and its API; a test points them at a fake. */
  github: {
    web: string;
    api: string;
  };
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Whether the public address is this machine: then plain http is allowed and GitHub cannot reach a webhook. */
export const isLocal = (url: URL): boolean => LOCAL_HOSTS.has(url.hostname);

function publicUrlOf(value: string | undefined): URL | string {
  if (!value) return 'JIG_UI_PUBLIC_URL is not set: give the address people open, such as https://board.example.com.';
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return `JIG_UI_PUBLIC_URL is not an address: ${value}`;
  }
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && isLocal(url))) {
    return `JIG_UI_PUBLIC_URL must be https, or http on localhost: ${value}`;
  }
  if (url.pathname !== '/' || url.search || url.hash || url.username || url.password) {
    return `JIG_UI_PUBLIC_URL must be an origin only, with no path, query or credentials: ${value}`;
  }
  return url;
}

/** Reads the settings, or says what is missing. Pure: it never exits or prints. */
export function teamConfig(env: NodeJS.ProcessEnv, port: number): TeamConfig | { error: string } {
  const publicUrl = publicUrlOf(env.JIG_UI_PUBLIC_URL);
  if (typeof publicUrl === 'string') return { error: publicUrl };
  return {
    publicUrl,
    dataDir: env.JIG_UI_DATA || '/data',
    host: env.JIG_UI_HOST || '0.0.0.0',
    port,
    github: {
      web: (env.GITHUB_URL || 'https://github.com').replace(/\/$/, ''),
      api: (env.GITHUB_API_URL || 'https://api.github.com').replace(/\/$/, ''),
    },
  };
}
