export type ErrorCode = 'INVALID_REQUEST' | 'FORBIDDEN' | 'SESSION_LIMIT' | 'SESSION_EXPIRED' | 'RESET_UNAVAILABLE' | 'OFFER_EXPIRED' | 'VERIFICATION_EXPIRED' | 'SERVICE_UNAVAILABLE' | 'UPSTREAM_TIMEOUT' | 'UPSTREAM_RESPONSE' | 'INTERNAL_ERROR';

const messages: Record<ErrorCode, string> = {
  INVALID_REQUEST: 'The request is not supported.',
  FORBIDDEN: 'This request could not be authorized. Reload the page and try again.',
  SESSION_LIMIT: 'The demo is at capacity. Please try again later.',
  VERIFICATION_EXPIRED: 'This verification request is no longer current. Try verification again.',
  OFFER_EXPIRED: 'This offer is no longer current. Request a new offer to continue.',
  RESET_UNAVAILABLE: 'Wallet reset is not available in this feature yet.',
  SESSION_EXPIRED: 'This session is no longer available. Start a new session explicitly to continue.',
  SERVICE_UNAVAILABLE: 'The credential service is not available. Please try again later.',
  UPSTREAM_TIMEOUT: 'The service did not respond in time. Its operation may still be pending.',
  UPSTREAM_RESPONSE: 'The credential service returned an unexpected response.',
  INTERNAL_ERROR: 'The operation could not be completed. Please try again later.',
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  constructor(code: ErrorCode, status: number) {
    super(messages[code]);
    this.name = 'AppError'; this.code = code; this.status = status;
  }
}

export function errorResponse(error: unknown): Response {
  const safe = error instanceof AppError ? error : new AppError('INTERNAL_ERROR', 500);
  return json({ error: { code: safe.code, message: safe.message } }, safe.status);
}

export function json(value: unknown, status = 200): Response {
  return Response.json(value, { status, headers: {
    'Cache-Control': 'no-store, private',
    'Pragma': 'no-cache',
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Cookie',
  } });
}
