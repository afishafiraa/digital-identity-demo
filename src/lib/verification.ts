export type VerificationSnapshot =
  | { state: 'none' | 'missing-credential' | 'pending' | 'expired' | 'presentation-started' }
  | { state: 'ready'; attemptId: string; expiresAt: string };

export function parseVerification(value: unknown): VerificationSnapshot {
  if (typeof value !== 'object' || value === null || !('state' in value)) throw new Error('Unexpected verification response');
  if (value.state === 'none' || value.state === 'missing-credential' || value.state === 'pending' || value.state === 'expired' || value.state === 'presentation-started') return { state: value.state };
  if (value.state === 'ready' && 'attemptId' in value && typeof value.attemptId === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value.attemptId) &&
      'expiresAt' in value && typeof value.expiresAt === 'string' && Number.isFinite(Date.parse(value.expiresAt))) {
    return { state: 'ready', attemptId: value.attemptId, expiresAt: value.expiresAt };
  }
  throw new Error('Unexpected verification response');
}
