export type PresentationState = 'none' | 'pending' | 'verified' | 'failed' | 'unavailable' | 'expired';
export type PresentationSnapshot = { state: 'none' } | { state: Exclude<PresentationState, 'none'>; attemptId: string };
export function parsePresentation(value: unknown): PresentationSnapshot {
  if (typeof value !== 'object' || value === null || !('state' in value)) throw new Error('Unexpected presentation response');
  if (value.state === 'none') return { state: 'none' };
  if (value.state !== 'pending' && value.state !== 'verified' && value.state !== 'failed' && value.state !== 'unavailable' && value.state !== 'expired') throw new Error('Unexpected presentation response');
  if (!('attemptId' in value) || typeof value.attemptId !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/.test(value.attemptId)) throw new Error('Invalid presentation reference');
  return { state: value.state, attemptId: value.attemptId };
}
