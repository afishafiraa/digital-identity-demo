import type { Config } from './config.ts';
import { AppError, errorResponse, json } from './errors.ts';
import { requireMutation } from './request.ts';
import { readSessionCookie, type SessionStore } from './session.ts';
import { readSharingMaterial, stable } from './sharing-handler.ts';
import { serviceClient } from './transport.ts';
import { isRecord } from './validation.ts';
import type { PresentationSnapshot } from '../../lib/presentation.ts';

function object(value: unknown): Record<string, unknown> { if (!isRecord(value)) throw new AppError('UPSTREAM_RESPONSE', 502); return value; }
function token(value: unknown): string {
  if (typeof value !== 'string' || !value || value.length > 512000) throw new AppError('UPSTREAM_RESPONSE', 502);
  const parsed: unknown = JSON.parse(value); const grouped = object(parsed);
  if (Object.keys(grouped).length !== 1 || !Array.isArray(grouped['training']) || grouped['training'].length !== 1 || typeof grouped['training'][0] !== 'string' || !grouped['training'][0]) throw new AppError('UPSTREAM_RESPONSE', 502);
  return value;
}

export function presentationHandler(config: Config, store: SessionStore, fetcher: typeof fetch = fetch) {
  return async (request: Request): Promise<Response> => {
    try {
      if (!['GET', 'POST'].includes(request.method) || new URL(request.url).search) throw new AppError('INVALID_REQUEST', 400);
      if (request.method === 'POST') await requireMutation(request, config.origin);
      const cookie = readSessionCookie(request, config);
      if (cookie.state !== 'present') throw new AppError('FORBIDDEN', 403);
      const visitor = cookie.token;
      const current = store.verification(visitor); const review = store.sharing(visitor);
      if (request.method === 'POST' && (!current || !review || review.state !== 'approved' || request.headers.get('X-Demo-Review') !== review.reviewId)) throw new AppError('FORBIDDEN', 403);
      if (!current) return json({ state: 'none' });
      const signal = AbortSignal.timeout(30000);
      const verifier = config.services.verifier;
      if (!verifier) throw new AppError('SERVICE_UNAVAILABLE', 503);
      const result = async (): Promise<PresentationSnapshot> => {
        const submission = store.presentation(visitor);
        if (!submission) return { state: 'none' };
        if (store.verification(visitor)?.attemptId !== current?.attemptId || store.sharing(visitor)?.reviewId !== submission.reviewId) throw new AppError('VERIFICATION_EXPIRED', 409);
        if (current.expiresAt <= Date.now()) return { state: 'expired', attemptId: current.attemptId };
        try {
          const info = await serviceClient(verifier, fetcher)({ path: `/verification-session/${current.requestId}/info`, decode: object, signal, notFound: () => null });
          if (store.verification(visitor)?.attemptId !== current.attemptId || store.sharing(visitor)?.reviewId !== submission.reviewId) throw new AppError('VERIFICATION_EXPIRED', 409);
          if (!info) return { state: 'expired', attemptId: current.attemptId };
          if (info['id'] !== current.requestId || info['bootstrapAuthorizationRequestUrl'] !== current.requestUrl) throw new AppError('UPSTREAM_RESPONSE', 502);
          if (info['status'] === 'SUCCESSFUL' && info['attempted'] === true && object(info['policy_results'])['overallSuccess'] === true) {
            const material = await readSharingMaterial(config, store, visitor, current, fetcher, signal, true, true);
            const approved = store.sharing(visitor);
            const confirmed = material.info;
            if (confirmed['status'] !== 'SUCCESSFUL' || confirmed['attempted'] !== true || object(confirmed['policy_results'])['overallSuccess'] !== true) throw new AppError('UPSTREAM_RESPONSE', 502);
            const presented = object(confirmed['presented_credentials'])['training'];
            if (approved?.state !== 'approved' || approved.reviewId !== submission.reviewId || approved.digest !== material.digest || !Array.isArray(presented) || presented.length !== 1 || stable(object(presented[0])['credentialData']) !== stable(material.claims)) throw new AppError('UPSTREAM_RESPONSE', 502);
            if (store.verification(visitor)?.attemptId !== current.attemptId || current.expiresAt <= Date.now()) throw new AppError('VERIFICATION_EXPIRED', 409);
            return { state: 'verified', attemptId: current.attemptId };
          }
          if (info['status'] === 'FAILED' && info['attempted'] === true) return { state: 'failed', attemptId: current.attemptId };
          return { state: submission.state === 'unavailable' || Date.now() - submission.startedAt >= 30000 ? 'unavailable' : 'pending', attemptId: current.attemptId };
        } catch (error) {
          if (error instanceof AppError && (error.code === 'VERIFICATION_EXPIRED' || error.code === 'SESSION_EXPIRED')) throw error;
          return { state: 'unavailable', attemptId: current.attemptId };
        }
      };
      if (request.method === 'GET' || store.presentation(visitor)) return json(await result());
      if (!review || !current.requestId || !current.requestUrl || current.expiresAt <= Date.now()) throw new AppError('VERIFICATION_EXPIRED', 409);
      const wallet = config.services.wallet;
      if (!wallet) throw new AppError('SERVICE_UNAVAILABLE', 503);
      const material = await readSharingMaterial(config, store, visitor, current, fetcher, signal);
      if (review.digest !== material.digest) { store.expireVerification(visitor, current.attemptId); throw new AppError('VERIFICATION_EXPIRED', 409); }
      if (!store.claimPresentation(visitor, current.attemptId, review.reviewId, material.digest)) return json(await result());
      try {
        const call = serviceClient(wallet, fetcher);
        const built = await call({ path: `/wallet/${current.walletId}/credentials/present/build-vp-token`, method: 'POST', body: { requestUrl: current.requestUrl, selectedCredentialIds: { training: [current.credentialId] } }, decode: object, signal });
        const vpToken = token(built['vpToken']);
        // Recheck the reviewed credential/request immediately before transmission, after proof building.
        const latest = await readSharingMaterial(config, store, visitor, current, fetcher, signal, true);
        if (latest.digest !== material.digest || store.sharing(visitor)?.reviewId !== review.reviewId || store.sharing(visitor)?.state !== 'approved' || store.verification(visitor)?.attemptId !== current.attemptId || (store.verification(visitor)?.expiresAt ?? 0) <= Date.now()) throw new AppError('VERIFICATION_EXPIRED', 409);
        const sent = await call({ path: `/wallet/${current.walletId}/credentials/present/send-response`, method: 'POST', body: { requestUrl: current.requestUrl, vpToken }, decode: object, signal });
        if (sent['transmission_success'] !== true) throw new AppError('UPSTREAM_RESPONSE', 502);
      } catch (error) {
        store.presentationUnavailable(visitor, current.attemptId);
        if (error instanceof AppError && (error.code === 'VERIFICATION_EXPIRED' || error.code === 'SESSION_EXPIRED')) throw error;
        // A send may have completed. Only inspect this request's result; never blindly resend it.
      }
      return json(await result());
    } catch (error) { return errorResponse(error); }
  };
}
