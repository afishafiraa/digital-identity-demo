import { serviceClient } from '../src/server/core/transport.ts';
import { isRecord } from '../src/server/core/validation.ts';

export function object(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error('Expected an object from the local service');
  return value;
}
export function nonempty(value: unknown): string {
  if (typeof value !== 'string' || !value) throw new Error('Expected a local service reference');
  return value;
}
export function list(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error('Expected a service list');
  return value;
}

// Verification fixture only; this does not enable offer/acceptance product routes.
export async function issueTrainingFixture(walletId: string): Promise<string[]> {
  const wallet = serviceClient({ url: 'http://127.0.0.1:7006' });
  const issuer = serviceClient({ url: 'http://127.0.0.1:7005' });
  await wallet({ path: `/wallet/${walletId}/keys/generate`, method: 'POST', body: { backend: 'jwk', keyType: 'secp256r1' }, decode: object });
  const offer = await issuer({ path: '/issuer2/credential-offers', method: 'POST', body: { profileId: 'training', authMethod: 'PRE_AUTHORIZED' }, decode: object });
  const received = await wallet({ path: `/wallet/${walletId}/credentials/receive`, method: 'POST', body: { offerUrl: nonempty(offer['credentialOffer']) }, decode: object });
  return list(received['credentialIds']).map((id: unknown) => nonempty(id));
}
