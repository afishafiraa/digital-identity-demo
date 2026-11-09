import type { Config } from './config.ts';
import { readStoredCredentials } from './credentials-handler.ts';
import { AppError, errorResponse, json } from './errors.ts';
import { requireMutation } from './request.ts';
import { readSessionCookie, type SessionStore, type VerificationReference } from './session.ts';
import { serviceClient } from './transport.ts';
import { isRecord } from './validation.ts';
import type { VerificationSnapshot } from '../../lib/verification.ts';

function object(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new AppError('UPSTREAM_RESPONSE', 502);
  return value;
}
function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value)) throw new AppError('UPSTREAM_RESPONSE', 502);
  return value;
}
function protocolUrl(value: unknown): string {
  if (typeof value !== 'string' || value.length > 16000) throw new AppError('UPSTREAM_RESPONSE', 502);
  const url = new URL(value);
  if (url.protocol !== 'openid4vp:' || url.hostname !== 'authorize' || !url.searchParams.get('request_uri')) throw new AppError('UPSTREAM_RESPONSE', 502);
  return value;
}

// F5 prepares one owned request only. No presentation endpoint is called here.
export function verificationHandler(config: Config, store: SessionStore, fetcher: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    try {
      if ((request.method !== 'GET' && request.method !== 'POST') || new URL(request.url).search) throw new AppError('INVALID_REQUEST', 400);
      if (request.method === 'POST') await requireMutation(request, config.origin);
      const cookie = readSessionCookie(request, config);
      if (cookie.state !== 'present') throw new AppError('FORBIDDEN', 403);
      const token = cookie.token;
      let current = store.verification(token);
      const signal = AbortSignal.timeout(12000);
      const service = config.services.verifier;
      if (!service) throw new AppError('SERVICE_UNAVAILABLE', 503);
      const call = serviceClient(service, fetcher);
      async function review(reference: VerificationReference): Promise<VerificationSnapshot> {
        if (store.presentation(token)) return { state: 'presentation-started' };
        if (reference.expiresAt <= Date.now()) return { state: 'expired' };
        if (!reference.requestId) return { state: 'pending' };
        const info = await call({ path: `/verification-session/${identifier(reference.requestId)}/info`, decode: object, signal, notFound: () => null });
        const latest = store.verification(token);
        if (latest?.attemptId !== reference.attemptId) throw new AppError('VERIFICATION_EXPIRED', 409);
        if (latest.expiresAt <= Date.now()) return { state: 'expired' };
        if (!info || info['status'] !== 'UNUSED' || info['attempted'] !== false) {
          store.expireVerification(token, reference.attemptId);
          return { state: 'expired' };
        }
        if (info['id'] !== reference.requestId || info['bootstrapAuthorizationRequestUrl'] !== reference.requestUrl) throw new AppError('UPSTREAM_RESPONSE', 502);
        return { state: 'ready', attemptId: reference.attemptId, expiresAt: new Date(latest.expiresAt).toISOString() };
      }
      if (request.method === 'POST' && store.presentation(token) && current) { store.expireVerification(token, current.attemptId); current = store.verification(token); }
      if (request.method === 'GET') return json(current ? await review(current) : { state: 'none' });
      const credentials = await readStoredCredentials(config, store, token, fetcher, signal);
      const credential = credentials[0];
      if (!credential) {
        if (current) store.expireVerification(token, current.attemptId);
        return json({ state: 'missing-credential' });
      }
      if (current && current.expiresAt > Date.now()) {
        if (!credentials.some(entry => entry.id === current?.credentialId)) store.expireVerification(token, current.attemptId);
        else {
          const snapshot = await review(current);
          if (snapshot.state !== 'expired') return json(snapshot, snapshot.state === 'pending' ? 202 : 200);
        }
      }
      const reserved = store.reserveVerification(token, credential.id);
      current = reserved.reference;
      if (!reserved.created) return json(await review(current), 202);
      try {
        const created = await call({ path: '/verification-session/create', method: 'POST', body: {
          flow_type: 'cross_device', core_flow: {
            dcql_query: { credentials: [{ id: 'training', format: 'dc+sd-jwt', meta: { vct_values: ['urn:diw:training:1'] } }] },
            policies: { vc_policies: [{ policy: 'signature' }] },
          },
        }, decode: object, signal });
        store.completeVerification(token, current.attemptId, identifier(created['sessionId']), protocolUrl(created['bootstrapAuthorizationRequestUrl']));
      } catch (error) {
        // A lost response can leave an unused upstream session, but it is never authorized or presented.
        store.expireVerification(token, current.attemptId);
        throw error;
      }
      const completed = store.verification(token);
      if (!completed || completed.attemptId !== current.attemptId) throw new AppError('VERIFICATION_EXPIRED', 409);
      return json(await review(completed));
    } catch (error) { return errorResponse(error); }
  };
}
