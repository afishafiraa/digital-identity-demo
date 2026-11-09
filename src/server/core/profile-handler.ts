import { createHash } from 'node:crypto';
import type { Config } from './config.ts';
import { readStoredCredentials } from './credentials-handler.ts';
import { AppError, errorResponse, json } from './errors.ts';
import { readSessionCookie, type SessionStore } from './session.ts';
import { serviceClient } from './transport.ts';
import { isRecord } from './validation.ts';
import { parseProfile, publicKey, type PublicKeyView } from '../../lib/profile.ts';

function object(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new AppError('UPSTREAM_RESPONSE', 502);
  return value;
}
export function profileHandler(config: Config, store: SessionStore, fetcher: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    try {
      if (request.method !== 'GET' || new URL(request.url).search) throw new AppError('INVALID_REQUEST', 400);
      const cookie = readSessionCookie(request, config);
      if (cookie.state !== 'present') throw new AppError('FORBIDDEN', 403);
      const token = cookie.token;
      const binding = store.binding(token);
      if (binding?.phase !== 'ready' || !binding.walletId) throw new AppError('FORBIDDEN', 403);
      const service = config.services.wallet;
      if (!service) throw new AppError('SERVICE_UNAVAILABLE', 503);
      const signal = AbortSignal.timeout(12000);
      const call = serviceClient(service, fetcher);
      const path = `/wallet/${binding.walletId}`;
      const info = await call({ path, decode: object, signal });
      // This app provisions key/credential stores with no holder DID or static identity.
      if (info['walletId'] !== binding.walletId || info['hasDidStore'] !== false || info['hasStaticDid'] !== false) throw new AppError('UPSTREAM_RESPONSE', 502);
      const keys = await call({ path: `${path}/keys`, decode: value => {
        if (!Array.isArray(value) || value.length > 100) throw new AppError('UPSTREAM_RESPONSE', 502);
        return value.map((entry: unknown) => { const key = object(entry); return { id: key['keyId'], type: key['keyType'] }; });
      }, signal });
      const [credential] = await readStoredCredentials(config, store, token, fetcher, signal);
      let issuerPublicKey: PublicKeyView | null = null;
      let holderPublicKey: PublicKeyView | null = null;
      if (credential) {
        if (!credential.issuerId.startsWith('did:jwk:')) throw new AppError('UPSTREAM_RESPONSE', 502);
        const encoded = credential.issuerId.slice('did:jwk:'.length);
        if (!/^[A-Za-z0-9_-]+$/.test(encoded)) throw new AppError('UPSTREAM_RESPONSE', 502);
        const decoded: unknown = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
        if (Object.keys(object(decoded)).some(key => !['kty', 'crv', 'x', 'y'].includes(key))) throw new AppError('UPSTREAM_RESPONSE', 502);
        issuerPublicKey = publicKey(decoded);
        const stored = await call({ path: `${path}/credentials/${credential.id}`, decode: object, signal });
        if (stored['id'] !== credential.id) throw new AppError('UPSTREAM_RESPONSE', 502);
        const claims = object(object(stored['credential'])['credentialData']);
        if (claims['iss'] !== credential.issuerId || claims['vct'] !== 'urn:diw:training:1') throw new AppError('UPSTREAM_RESPONSE', 502);
        holderPublicKey = publicKey(object(claims['cnf'])['jwk']);
      }
      const current = store.binding(token);
      if (current?.phase !== 'ready' || current.walletId !== binding.walletId) throw new AppError('FORBIDDEN', 403);
      // RFC 7638 canonical member order for this profile's EC key.
      const holderThumbprint = holderPublicKey ? createHash('sha256').update(JSON.stringify({ crv: holderPublicKey.crv, kty: holderPublicKey.kty, x: holderPublicKey.x, y: holderPublicKey.y })).digest('base64url') : null;
      return json(parseProfile({ walletId: binding.walletId, keys, credentialId: credential?.id ?? null,
        issuerDid: credential?.issuerId ?? null, issuerPublicKey, holderPublicKey, holderThumbprint }));
    } catch (error) {
      return errorResponse(error instanceof AppError ? error : new AppError('UPSTREAM_RESPONSE', 502));
    }
  };
}
