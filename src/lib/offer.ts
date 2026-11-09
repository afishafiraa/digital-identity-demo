export interface OfferReview {
  reviewId: string;
  expiresAt: string;
  issuer: string;
  credential: string;
  holderName: string;
  course: string;
  completionDate: string;
}
export type OfferSnapshot = { state: 'none' | 'pending' | 'expired' | 'accepting' | 'accepted' | 'declined' } | { state: 'ready'; offer: OfferReview };

export function parseOfferSnapshot(value: unknown): OfferSnapshot {
  if (typeof value !== 'object' || value === null || !('state' in value)) throw new Error('Unexpected offer response. Please try again.');
  if (value.state === 'none' || value.state === 'pending' || value.state === 'expired' || value.state === 'accepting' || value.state === 'accepted' || value.state === 'declined') return { state: value.state };
  if (value.state !== 'ready' || !('offer' in value) || typeof value.offer !== 'object' || value.offer === null) throw new Error('Unexpected offer response. Please try again.');
  const offer = value.offer;
  function text(key: keyof OfferReview): string {
    if (!(key in offer)) throw new Error('Incomplete offer response. Please try again.');
    const field: unknown = Reflect.get(offer, key);
    if (typeof field !== 'string' || !field || field.length > 256) throw new Error('Invalid offer response. Please try again.');
    return field;
  }
  const expiresAt = text('expiresAt');
  if (!Number.isFinite(Date.parse(expiresAt))) throw new Error('Invalid offer expiry. Please try again.');
  return { state: 'ready', offer: {
    reviewId: text('reviewId'), expiresAt, issuer: text('issuer'), credential: text('credential'),
    holderName: text('holderName'), course: text('course'), completionDate: text('completionDate'),
  } };
}
