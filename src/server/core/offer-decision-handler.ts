import type { Config } from './config.ts';
import { AppError, errorResponse, json } from './errors.ts';
import { requireMutation } from './request.ts';
import { readSessionCookie, type SessionStore } from './session.ts';
import { serviceClient } from './transport.ts';
import { isRecord } from './validation.ts';

function object(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new AppError('UPSTREAM_RESPONSE', 502);
  return value;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new AppError('UPSTREAM_RESPONSE', 502);
  return value;
}
function credentialIds(value: unknown): string[] {
  return list(value).map((entry: unknown) => {
    const id = object(entry)['id'];
    if (typeof id !== 'string' || !id) throw new AppError('UPSTREAM_RESPONSE', 502);
    return id;
  });
}

export function offerDecisionHandler(config: Config, store: SessionStore, fetcher: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    try {
      if (request.method !== 'GET') await requireMutation(request, config.origin);
      if (new URL(request.url).search) throw new AppError('INVALID_REQUEST', 400);
      const cookie = readSessionCookie(request, config);
      if (cookie.state !== 'present') throw new AppError('FORBIDDEN', 403);
      const token = cookie.token;
      const offer = store.offer(token);
      if (!offer || (request.method !== 'GET' && request.headers.get('X-Demo-Offer') !== offer.id)) throw new AppError('OFFER_EXPIRED', 409);
      const decision = store.decision(token);
      if (decision?.state === 'accepted' || decision?.state === 'declined') return json({ state: decision.state });
      if (request.method === 'DELETE' && !decision) {
        store.decide(token, offer.id, 'declined');
        return json({ state: store.decision(token)?.state });
      }
      const service = config.services.wallet;
      if (!service) throw new AppError('SERVICE_UNAVAILABLE', 503);
      const call = serviceClient(service, fetcher);
      const signal = AbortSignal.timeout(40000);
      const path = `/wallet/${offer.walletId}`;
      async function stored(): Promise<string[]> {
        const ids = await call({ path: `${path}/credentials`, decode: credentialIds, signal });
        if (store.offer(token)?.id !== offer?.id) throw new AppError('OFFER_EXPIRED', 409);
        return ids;
      }
      if (decision) {
        // The only app credential write for this wallet is this one reserved receive.
        // Never dispatch receive again, even when the wallet remains empty or after restart.
        const added = (await stored()).filter(id => !decision.baseline.includes(id));
        if (added.length === 1) store.confirmReceipt(token, offer.id);
        return json({ state: added.length === 1 ? 'accepted' : 'accepting' }, added.length === 1 ? 200 : 202);
      }
      if (request.method === 'GET') return json({ state: 'none' });
      if (offer.expiresAt <= Date.now()) throw new AppError('OFFER_EXPIRED', 409);
      const issuer = config.services.issuer;
      if (!issuer) throw new AppError('SERVICE_UNAVAILABLE', 503);
      const session = await serviceClient(issuer, fetcher)({ path: `/issuer2/sessions/${offer.id}`, decode: object, signal });
      if (session['sessionId'] !== offer.id || session['credentialConfigurationId'] !== 'training' || typeof session['expiresAt'] !== 'string' || !(Date.parse(session['expiresAt']) > Date.now())) throw new AppError('OFFER_EXPIRED', 409);
      const baseline = await stored();
      if (!store.decide(token, offer.id, 'accepting', baseline)) return json({ state: store.decision(token)?.state }, 202);
      // Mark before any mutation: interrupted calls are checked, never blindly repeated.
      const keys = await call({ path: `${path}/keys`, decode: list, signal });
      if (keys.length === 0) await call({ path: `${path}/keys/generate`, method: 'POST', body: { backend: 'jwk', keyType: 'secp256r1' }, decode: object, signal });
      const credentialOffer = object(session['credentialOffer']);
      const offerUrl = `openid-credential-offer://?credential_offer=${encodeURIComponent(JSON.stringify(credentialOffer))}`;
      const received = await call({ path: `${path}/credentials/receive`, method: 'POST', body: { offerUrl }, decode: object, signal, timeoutMs: 30000 });
      const ids = list(received['credentialIds']);
      if (ids.length !== 1 || typeof ids[0] !== 'string' || baseline.includes(ids[0])) throw new AppError('UPSTREAM_RESPONSE', 502);
      if (!(await stored()).includes(ids[0])) throw new AppError('UPSTREAM_RESPONSE', 502);
      store.confirmReceipt(token, offer.id);
      return json({ state: 'accepted' });
    } catch (error) { return errorResponse(error); }
  };
}
