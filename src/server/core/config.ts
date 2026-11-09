export type ServiceName = 'issuer' | 'wallet' | 'verifier';
export interface ServiceConfig { url: string; token?: string }
export interface Config {
  origin: string;
  dataDir: string;
  sessionTtlSeconds: number;
  maxActiveSessions: number;
  services: Partial<Record<ServiceName, ServiceConfig>>;
}

function integer(value: string | undefined, fallback: number, min: number, max: number, key: string): number {
  if (value === undefined) return fallback;
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)) || Number(value) < min || Number(value) > max) {
    throw new Error(`Invalid ${key}`);
  }
  return Number(value);
}

function parseUrl(value: string, key: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error(`Invalid ${key}`); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error(`Invalid ${key}`);
  }
  return url;
}

export function readConfig(env: Readonly<Record<string, string | undefined>> = process.env): Config {
  const production = env['NODE_ENV'] === 'production';
  if (production && !env['APP_ORIGIN']) throw new Error('APP_ORIGIN is required in production');
  const appUrl = parseUrl(env['APP_ORIGIN'] ?? 'http://localhost:47831', 'APP_ORIGIN');
  const loopback = ['127.0.0.1', 'localhost', '[::1]'].includes(appUrl.hostname);
  if (appUrl.pathname !== '/' || (appUrl.protocol !== 'https:' && (production || !loopback))) {
    throw new Error('APP_ORIGIN must use HTTPS except for loopback development');
  }
  if (env['DEMO_DATA_DIR'] !== undefined && !env['DEMO_DATA_DIR'].trim()) throw new Error('Invalid DEMO_DATA_DIR');
  const services: Config['services'] = {};
  for (const name of ['issuer', 'wallet', 'verifier'] as const) {
    const prefix = `WALT_${name.toUpperCase()}`;
    const url = env[`${prefix}_URL`];
    const token = env[`${prefix}_TOKEN`];
    if (token && (!url || /[\r\n]/.test(token))) throw new Error(`Invalid ${prefix}_TOKEN`);
    if (url) {
      const parsed = parseUrl(url, `${prefix}_URL`);
      if (parsed.pathname !== '/') throw new Error(`${prefix}_URL must be a service origin`);
      services[name] = { url: parsed.origin, ...(token ? { token } : {}) };
    }
  }
  return {
    origin: appUrl.origin,
    dataDir: env['DEMO_DATA_DIR'] ?? '.local',
    sessionTtlSeconds: integer(env['SESSION_TTL_SECONDS'], 86400, 300, 604800, 'SESSION_TTL_SECONDS'),
    maxActiveSessions: integer(env['MAX_ACTIVE_SESSIONS'], 100, 1, 10000, 'MAX_ACTIVE_SESSIONS'),
    services,
  };
}
