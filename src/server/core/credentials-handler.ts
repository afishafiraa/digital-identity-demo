import type { Config } from './config.ts';
import { AppError, errorResponse, json } from './errors.ts';
import { readSessionCookie, type SessionStore } from './session.ts';
import { serviceClient } from './transport.ts';
import { isRecord } from './validation.ts';
import { parseCredentials } from '../../lib/credentials.ts';

function object(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new AppError('UPSTREAM_RESPONSE', 502);
  return value;
}
function metadata(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 100) throw new AppError('UPSTREAM_RESPONSE', 502);
  const ids = value.map((entry: unknown) => {
    const row = object(entry);
    if (row['format'] !== 'dc+sd-jwt' || typeof row['id'] !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(row['id'])) throw new AppError('UPSTREAM_RESPONSE', 502);
    return row['id'];
  });
  if (new Set(ids).size !== ids.length) throw new AppError('UPSTREAM_RESPONSE', 502);
  return ids;
}
function timestamp(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || !Number.isFinite(new Date(value * 1000).getTime())) throw new AppError('UPSTREAM_RESPONSE', 502);
  return new Date(value * 1000).toISOString();
}

export function credentialsHandler(config: Config, store: SessionStore, fetcher: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    try {
      if (request.method !== 'GET' || new URL(request.url).search) throw new AppError('INVALID_REQUEST', 400);
      const cookie = readSessionCookie(request, config);
      if (cookie.state !== 'present') throw new AppError('FORBIDDEN', 403);
      const token = cookie.token;
      return json(await readStoredCredentials(config, store, token, fetcher));
    } catch (error) { return errorResponse(error); }
  };
}

// Shared owned-wallet read for display and matching the fixed verification profile.
export async function readStoredCredentials(config: Config, store: SessionStore, token: string, fetcher: typeof fetch = fetch, signal = AbortSignal.timeout(12000)) {
  const binding = store.binding(token);
  if (binding?.phase !== 'ready' || !binding.walletId) throw new AppError('FORBIDDEN', 403);
  const service = config.services.wallet;
  if (!service) throw new AppError('SERVICE_UNAVAILABLE', 503);
  const call = serviceClient(service, fetcher);
  const path = `/wallet/${binding.walletId}/credentials`;
  const ids = await call({ path, decode: metadata, signal });
  const credentials = [];
  for (const id of ids) {
    const stored = await call({ path: `${path}/${id}`, decode: object, signal });
    const credential = object(stored['credential']);
    const claims = object(credential['credentialData']);
    if (stored['id'] !== id || credential['format'] !== 'dc+sd-jwt' || claims['vct'] !== 'urn:diw:training:1') throw new AppError('UPSTREAM_RESPONSE', 502);
    credentials.push({ id, issuer: claims['issuer_name'], issuerId: claims['iss'], holderName: claims['holder_name'], course: claims['course'],
      completionDate: claims['completion_date'], addedAt: stored['addedAt'] ?? null,
      issuedAt: timestamp(claims['iat']), notBefore: timestamp(claims['nbf']), expiresAt: timestamp(claims['exp']) });
  }
  // Recheck ownership after every upstream read has completed, including an empty list.
  const current = store.binding(token);
  if (current?.phase !== 'ready' || current.walletId !== binding.walletId) throw new AppError('FORBIDDEN', 403);
  try { return parseCredentials(credentials); }
  catch { throw new AppError('UPSTREAM_RESPONSE', 502); }
}
