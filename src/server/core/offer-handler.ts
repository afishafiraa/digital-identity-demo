import type { Config } from './config.ts';
import { AppError, errorResponse, json } from './errors.ts';
import { requireMutation } from './request.ts';
import { readSessionCookie, type OfferReference, type SessionStore } from './session.ts';
import { serviceClient } from './transport.ts';
import { isRecord } from './validation.ts';
import { parseOfferSnapshot } from '../../lib/offer.ts';
import type { OfferSnapshot } from '../../lib/offer.ts';

function object(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new AppError('UPSTREAM_RESPONSE', 502);
  return value;
}

// One fixed scenario, one current offer per wallet. Never return the issuer's raw session/key material.
export function offerHandler(config: Config, store: SessionStore, fetcher: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    try {
      if (request.method !== 'GET') await requireMutation(request, config.origin);
      if (new URL(request.url).search) throw new AppError('INVALID_REQUEST', 400);
      const cookie = readSessionCookie(request, config);
      if (cookie.state !== 'present') throw new AppError('FORBIDDEN', 403);
      const token = cookie.token;
      let reference = store.offer(token);
      const decision = store.decision(token);
      if (decision && (request.method === 'GET' || decision.state === 'accepting')) return json({ state: decision.state });
      const service = config.services.issuer;
      if (!service) throw new AppError('SERVICE_UNAVAILABLE', 503);
      const signal = AbortSignal.timeout(10000);
      const call = serviceClient(service, fetcher);

      async function review(current: OfferReference): Promise<OfferSnapshot> {
        if (current.expiresAt <= Date.now()) return { state: 'expired' };
        const session = await call({ path: `/issuer2/sessions/${current.id}`, decode: object, signal, notFound: () => null });
        if (session === null) return { state: 'pending' };
        if (session['sessionId'] !== current.id || session['credentialConfigurationId'] !== 'training') throw new AppError('UPSTREAM_RESPONSE', 502);
        const expiry = typeof session['expiresAt'] === 'string' ? Date.parse(session['expiresAt']) : Number.NaN;
        if (!Number.isFinite(expiry)) throw new AppError('UPSTREAM_RESPONSE', 502);
        if (expiry <= Date.now()) { store.expireOffer(token, current.id); return { state: 'expired' }; }
        const claims = object(session['credentialData']);
        // Recheck ownership/current attempt after the network response (including reset/expiry races).
        const latest = store.offer(token);
        if (latest?.id !== current.id) throw new AppError('OFFER_EXPIRED', 409);
        if (latest.expiresAt <= Date.now()) return { state: 'expired' };
        try {
          return parseOfferSnapshot({ state: 'ready', offer: {
            reviewId: current.id, expiresAt: new Date(Math.min(expiry, current.expiresAt)).toISOString(),
            issuer: claims['issuer_name'], credential: 'Training Certificate', holderName: claims['holder_name'],
            course: claims['course'], completionDate: claims['completion_date'],
          } });
        } catch { throw new AppError('UPSTREAM_RESPONSE', 502); }
      }

      if (request.method === 'POST' && (!reference || reference.expiresAt <= Date.now() || decision)) {
        // Probe before reserving: an already-offline issuer should leave no unconfirmed offer behind.
        await call({ path: '/.well-known/openid-credential-issuer/openid4vci', decode: object, signal });
        const reserved = store.reserveOffer(token);
        reference = reserved.reference;
        if (reserved.created) {
          const receipt = await call({ path: '/issuer2/credential-offers', method: 'POST', body: {
            profileId: 'training', authMethod: 'PRE_AUTHORIZED', sessionId: reference.id, expiresInSeconds: 300,
          }, decode: object, signal });
          if (receipt['offerId'] !== reference.id || receipt['profileId'] !== 'training') throw new AppError('UPSTREAM_RESPONSE', 502);
        }
      }
      const result = reference ? await review(reference) : { state: 'none' };
      return json(result, result.state === 'pending' ? 202 : 200);
    } catch (error) { return errorResponse(error); }
  };
}
