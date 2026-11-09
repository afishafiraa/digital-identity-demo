import { BodyLimitError, readBytes } from './body.ts';
import { AppError } from './errors.ts';

// Do not trust Host, X-Forwarded-Host, or a browser-provided service/wallet URL.
export async function requireMutation(request: Request, expectedOrigin: string, timeoutMs = 3000): Promise<void> {
  if (request.headers.get('origin') !== expectedOrigin) throw new AppError('FORBIDDEN', 403);
  const site = request.headers.get('sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') throw new AppError('FORBIDDEN', 403);
  if (request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
    throw new AppError('INVALID_REQUEST', 415);
  }
  // These foundation endpoints accept exactly {}. Bound the stream, not just Content-Length.
  const signal = AbortSignal.timeout(timeoutMs);
  let data: unknown;
  try {
    const bytes = await readBytes(request.body, 256, signal);
    data = JSON.parse(bytes.toString('utf8'));
  } catch (error) {
    throw new AppError('INVALID_REQUEST', signal.aborted ? 408 : error instanceof BodyLimitError ? 413 : 400);
  }
  if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length !== 0) {
    throw new AppError('INVALID_REQUEST', 400);
  }
}
