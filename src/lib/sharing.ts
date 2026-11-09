import { parseCredentials, type StoredCredentialView } from './credentials.ts';

export type SharedClaim = string | number | { jwk: Record<string, string> };
export interface SharingReview {
  reviewId: string;
  attemptId: string;
  expiresAt: string;
  credential: StoredCredentialView;
  claims: Record<string, SharedClaim>;
}
export type SharingSnapshot = { state: 'none' | 'expired' | 'cancelled' | 'presentation-started' } | { state: 'reviewing' | 'approved'; review: SharingReview };
function record(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value); }
export function sharingClaims(value: unknown): Record<string, SharedClaim> {
  if (!record(value)) throw new Error('Invalid credential claims');
  const result: Record<string, SharedClaim> = {};
  const texts = ['id', 'iss', 'vct', 'holder_name', 'issuer_name', 'course', 'completion_date', '_sd_alg'];
  for (const [key, field] of Object.entries(value)) {
    if (texts.includes(key) && typeof field === 'string' && field.length > 0 && field.length <= 2048) result[key] = field;
    else if (['iat', 'nbf', 'exp'].includes(key) && typeof field === 'number' && Number.isSafeInteger(field)) result[key] = field;
    else if (key === 'cnf' && record(field) && Object.keys(field).length === 1 && record(field['jwk'])) {
      const jwk = field['jwk'];
      if (Object.keys(jwk).some(name => !['kty', 'crv', 'x', 'y', 'kid', 'alg', 'use'].includes(name)) || jwk['kty'] !== 'EC' || jwk['crv'] !== 'P-256' || typeof jwk['x'] !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(jwk['x']) || typeof jwk['y'] !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(jwk['y'])) throw new Error('Invalid holder public key');
      // Only the proved public P-256 binding is supported by this demo.
      const publicJwk: Record<string, string> = { kty: 'EC', crv: 'P-256', x: jwk['x'], y: jwk['y'] };
      for (const name of ['kid', 'alg', 'use']) {
        const annotation = jwk[name];
        if (annotation === undefined) continue;
        if (typeof annotation !== 'string' || !annotation || annotation.length > 256) throw new Error('Invalid public key annotation');
        publicJwk[name] = annotation;
      }
      result[key] = { jwk: publicJwk };
    } else throw new Error('Unsupported disclosure scope');
  }
  if (result['vct'] !== 'urn:diw:training:1' || typeof result['iss'] !== 'string' || typeof result['holder_name'] !== 'string' || typeof result['course'] !== 'string' || typeof result['completion_date'] !== 'string' || typeof result['issuer_name'] !== 'string' || !result['cnf']) throw new Error('Incomplete disclosure scope');
  return result;
}
export function parseSharing(value: unknown): SharingSnapshot {
  if (!record(value)) throw new Error('Unexpected sharing response');
  if (value['state'] === 'none' || value['state'] === 'expired' || value['state'] === 'cancelled' || value['state'] === 'presentation-started') return { state: value['state'] };
  if ((value['state'] !== 'reviewing' && value['state'] !== 'approved') || !record(value['review'])) throw new Error('Unexpected sharing response');
  const review = value['review'];
  const reviewId = review['reviewId']; const attemptId = review['attemptId']; const expiresAt = review['expiresAt'];
  if (typeof reviewId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(reviewId) || typeof attemptId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(attemptId) || typeof expiresAt !== 'string' || !Number.isFinite(Date.parse(expiresAt))) throw new Error('Invalid review reference');
  const [credential] = parseCredentials([review['credential']]);
  if (!credential) throw new Error('Missing reviewed credential');
  return { state: value['state'], review: { reviewId, attemptId, expiresAt, credential, claims: sharingClaims(review['claims']) } };
}
