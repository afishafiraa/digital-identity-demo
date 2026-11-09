import type { ServiceConfig } from './config.ts';
import { AppError } from './errors.ts';
import { serviceClient } from './transport.ts';
import { isRecord } from './validation.ts';

export interface WalletGateway {
  ensureStores(storeId: string): Promise<void>;
  create(storeId: string): Promise<string>;
  find(storeId: string): Promise<string | null>;
  inspect(walletId: string, storeId: string): Promise<void>;
}
function record(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new AppError('UPSTREAM_RESPONSE', 502);
  return value;
}
function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) throw new AppError('UPSTREAM_RESPONSE', 502);
  return value;
}
function identifiers(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 1000) throw new AppError('UPSTREAM_RESPONSE', 502);
  return value.map((entry: unknown) => identifier(entry));
}
function matches(info: Record<string, unknown>, storeId: string): boolean {
  const keys = identifiers(info['keyStoreIds']);
  const credentials = identifiers(info['credentialStoreIds']);
  return keys.length === 1 && keys[0] === `${storeId}-keys` && credentials.length === 1 && credentials[0] === `${storeId}-credentials` && info['hasDidStore'] === false;
}

// Management API stays private. Correlation uses persisted exact store identities, never a list diff.
export function walletGateway(config: ServiceConfig, signal: AbortSignal, fetcher: typeof fetch = fetch): WalletGateway {
  const call = serviceClient(config, fetcher);
  return {
    async ensureStores(storeId) {
      for (const kind of ['keys', 'credentials'] as const) {
        const id = `${storeId}-${kind}`;
        const path = `/stores/${kind}`;
        const known = await call({ path, decode: identifiers, signal });
        if (known.includes(id)) continue;
        try {
          const created = await call({ path: `${path}/${id}`, method: 'POST', decode: record, signal });
          if (created['storeId'] !== id) throw new AppError('UPSTREAM_RESPONSE', 502);
        } catch (error) {
          // A concurrent create or a lost response can be reconciled by the same named store.
          const actual = await call({ path, decode: identifiers, signal });
          if (!actual.includes(id)) throw error;
        }
      }
    },
    async create(storeId) {
      const created = await call({ path: '/wallet', method: 'POST', body: { keyStoreIds: [`${storeId}-keys`], credentialStoreIds: [`${storeId}-credentials`], noDidStore: true }, decode: record, signal });
      return identifier(created['walletId']);
    },
    async find(storeId) {
      const ids = await call({ path: '/wallet', decode: identifiers, signal });
      let match: string | null = null;
      for (const id of ids) {
        const info = await call({ path: `/wallet/${id}`, decode: record, signal });
        if (matches(info, storeId)) {
          if (match !== null) throw new AppError('UPSTREAM_RESPONSE', 502);
          match = id;
        }
      }
      return match;
    },
    async inspect(walletId, storeId) {
      const info = await call({ path: `/wallet/${identifier(walletId)}`, decode: record, signal });
      if (info['walletId'] !== walletId || !matches(info, storeId)) throw new AppError('UPSTREAM_RESPONSE', 502);
    },
  };
}
