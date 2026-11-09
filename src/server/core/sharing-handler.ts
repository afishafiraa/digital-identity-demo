import { createHash } from 'node:crypto';
import type { Config } from './config.ts';
import { readStoredCredentials } from './credentials-handler.ts';
import { AppError, errorResponse, json } from './errors.ts';
import { requireMutation } from './request.ts';
import { readSessionCookie, type SessionStore, type VerificationReference } from './session.ts';
import { serviceClient } from './transport.ts';
import { isRecord } from './validation.ts';
import { parseSharing, sharingClaims } from '../../lib/sharing.ts';

function object(value: unknown): Record<string, unknown> { if (!isRecord(value)) throw new AppError('UPSTREAM_RESPONSE', 502); return value; }
export function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map((entry: unknown) => stable(entry)).join(',')}]`;
  if (isRecord(value)) return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return JSON.stringify(value);
  throw new AppError('UPSTREAM_RESPONSE', 502);
}

// F6 records consent only. The presentation handler owns actual dispatch.
export function sharingHandler(config: Config, store: SessionStore, fetcher: typeof fetch = fetch, decision = false) {
  return async (request: Request): Promise<Response> => {
    try {
      if (new URL(request.url).search || (decision ? !['POST', 'DELETE'].includes(request.method) : !['GET', 'POST'].includes(request.method))) throw new AppError('INVALID_REQUEST', 400);
      if (request.method !== 'GET') await requireMutation(request, config.origin);
      const cookie = readSessionCookie(request, config);
      if (cookie.state !== 'present') throw new AppError('FORBIDDEN', 403);
      const token = cookie.token;
      const current = store.verification(token);
      if (!current) {
        if (request.method !== 'GET') throw new AppError('VERIFICATION_EXPIRED', 409);
        return json({ state: 'none' });
      }
      let review = store.sharing(token);
      if (store.presentation(token)) {
        if (request.method === 'GET') return json({ state: 'presentation-started' });
        throw new AppError('VERIFICATION_EXPIRED', 409);
      }
      if (decision && (!review || request.headers.get('X-Demo-Review') !== review.reviewId)) throw new AppError('VERIFICATION_EXPIRED', 409);
      if (decision && request.method === 'POST' && review?.state === 'cancelled') throw new AppError('VERIFICATION_EXPIRED', 409);
      if (!decision && request.method === 'POST' && request.headers.get('X-Demo-Verification') !== current.attemptId) throw new AppError('VERIFICATION_EXPIRED', 409);
      if (request.method === 'GET' && !review) return json({ state: 'none' });
      if (current.expiresAt <= Date.now() || !current.requestId || !current.requestUrl) return request.method === 'GET' ? json({ state: 'expired' }) : errorResponse(new AppError('VERIFICATION_EXPIRED', 409));
      if (decision && request.method === 'DELETE' && review) {
        if (review.state === 'cancelled') return json({ state: 'cancelled' });
        if (review.state !== 'reviewing') throw new AppError('VERIFICATION_EXPIRED', 409);
        store.decideSharing(token, current.attemptId, review.reviewId, review.digest, 'cancelled');
        return json({ state: 'cancelled' });
      }
      if (request.method === 'GET' && (!review || review.state === 'cancelled')) return json({ state: review?.state ?? 'none' });
      const { credential, claims, digest } = await readSharingMaterial(config, store, token, current, fetcher, AbortSignal.timeout(12000));
      if (decision) {
        if (!review || review.digest !== digest) { store.expireVerification(token, current.attemptId); throw new AppError('VERIFICATION_EXPIRED', 409); }
        store.decideSharing(token, current.attemptId, review.reviewId, digest, 'approved');
      } else if (request.method === 'POST') review = store.reviewSharing(token, current.attemptId, digest);
      else if (review?.digest !== digest) { store.expireVerification(token, current.attemptId); return json({ state: 'expired' }); }
      const latest = store.verification(token);
      review = store.sharing(token);
      if (latest?.attemptId !== current.attemptId || latest.expiresAt <= Date.now() || !review || review.digest !== digest || review.state === 'cancelled') throw new AppError('VERIFICATION_EXPIRED', 409);
      return json(parseSharing({ state: review.state, review: { reviewId: review.reviewId, attemptId: current.attemptId, expiresAt: new Date(latest.expiresAt).toISOString(), credential, claims } }));
    } catch (error) { return errorResponse(error); }
  };
}

// Shared F6/F7 check of the exact current credential and request, without presenting.
export async function readSharingMaterial(config: Config, store: SessionStore, token: string, current: VerificationReference, fetcher: typeof fetch, signal: AbortSignal, allowInUse = false, allowResult = false) {
  const wallet = config.services.wallet; const verifier = config.services.verifier;
  if (!wallet || !verifier) throw new AppError('SERVICE_UNAVAILABLE', 503);
  const call = serviceClient(wallet, fetcher);
  const credentials = await readStoredCredentials(config, store, token, fetcher, signal);
  const credential = credentials.find(entry => entry.id === current.credentialId);
  if (!credential) { store.expireVerification(token, current.attemptId); throw new AppError('VERIFICATION_EXPIRED', 409); }
  const stored = await call({ path: `/wallet/${current.walletId}/credentials/${credential.id}`, decode: object, signal });
  const actual = object(stored['credential']);
  if (stored['id'] !== credential.id || actual['format'] !== 'dc+sd-jwt' || typeof actual['signed'] !== 'string' || !actual['signed']) throw new AppError('UPSTREAM_RESPONSE', 502);
  let claims;
  try { claims = sharingClaims(actual['credentialData']); }
  catch { throw new AppError('UPSTREAM_RESPONSE', 502); }
  const info = await serviceClient(verifier, fetcher)({ path: `/verification-session/${current.requestId}/info`, decode: object, signal, notFound: () => null });
  if (store.verification(token)?.attemptId !== current.attemptId) throw new AppError('VERIFICATION_EXPIRED', 409);
  if (!info || (!allowResult && ((info['status'] !== 'UNUSED' && !(allowInUse && info['status'] === 'IN_USE')) || info['attempted'] !== false))) { store.expireVerification(token, current.attemptId); throw new AppError('VERIFICATION_EXPIRED', 409); }
  if (info['id'] !== current.requestId || info['bootstrapAuthorizationRequestUrl'] !== current.requestUrl) throw new AppError('UPSTREAM_RESPONSE', 502);
  const auth = object(info['authorizationRequest']);
  const query = object(auth['dcql_query']); const entries = query['credentials'];
  if (!Array.isArray(entries) || entries.length !== 1) throw new AppError('UPSTREAM_RESPONSE', 502);
  const entry = object(entries[0]); const meta = object(entry['meta']); const types = meta['vct_values'];
  if (entry['id'] !== 'training' || entry['format'] !== 'dc+sd-jwt' || !Array.isArray(types) || types.length !== 1 || types[0] !== 'urn:diw:training:1' || entry['claims'] !== undefined || query['credential_sets'] !== undefined || object(auth['client_metadata'])['client_name'] !== 'Harbor Works' || typeof auth['client_id'] !== 'string' || !auth['client_id'].startsWith('redirect_uri:') || auth['response_mode'] !== 'direct_post' || auth['response_type'] !== 'vp_token' || typeof auth['nonce'] !== 'string' || !auth['nonce']) throw new AppError('UPSTREAM_RESPONSE', 502);
  const digest = createHash('sha256').update(stable({ credentialId: credential.id, signed: actual['signed'], signedWithDisclosures: typeof actual['signedWithDisclosures'] === 'string' ? actual['signedWithDisclosures'] : null, claims: actual['credentialData'], request: auth })).digest('hex');

  return { credential, claims, digest, info };
}
