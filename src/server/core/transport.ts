import { readBytes } from './body.ts';
import type { ServiceConfig } from './config.ts';
import { AppError } from './errors.ts';

type Decoder<T> = (value: unknown) => T;
interface RequestOptions<T> {
  path: string;
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  decode: Decoder<T>;
  timeoutMs?: number;
  signal?: AbortSignal;
  notFound?: () => T;
}

// Fixed server configuration only. No automatic mutation retries or redirect following.
export function serviceClient(config: ServiceConfig, fetcher: typeof fetch = fetch) {
  return async <T>(options: RequestOptions<T>): Promise<T> => {
    if (!/^\/(?!\/)[A-Za-z0-9_\-\/.]*$/.test(options.path) || options.path.includes('..')) {
      throw new AppError('INVALID_REQUEST', 400);
    }
    const timeout = AbortSignal.timeout(options.timeoutMs ?? 8000);
    const signal = options.signal ? AbortSignal.any([timeout, options.signal]) : timeout;
    let receivedResponse = false;
    try {
      const response = await fetcher(new URL(options.path, config.url), {
        method: options.method ?? 'GET',
        headers: {
          Accept: 'application/json',
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...(config.token ? { Authorization: `Bearer ${config.token}` } : {}),
        },
        ...(options.body === undefined ? {} : { body: JSON.stringify(options.body) }),
        redirect: 'error', cache: 'no-store', signal,
      });
      receivedResponse = true;
      if (response.status === 404 && options.notFound) {
        await response.body?.cancel();
        return options.notFound();
      }
      if (!response.ok) {
        await response.body?.cancel();
        throw new AppError(response.status >= 500 ? 'SERVICE_UNAVAILABLE' : 'UPSTREAM_RESPONSE', 502);
      }
      if (response.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') {
        await response.body?.cancel();
        throw new AppError('UPSTREAM_RESPONSE', 502);
      }
      const bytes = await readBytes(response.body, 1024 * 1024, signal);
      const value: unknown = JSON.parse(bytes.toString('utf8'));
      return options.decode(value);
    } catch (error) {
      if (error instanceof AppError) throw error;
      if (signal.aborted) throw new AppError('UPSTREAM_TIMEOUT', 504);
      // Never surface an upstream body, URL, token, stack, or schema contents.
      throw new AppError(receivedResponse ? 'UPSTREAM_RESPONSE' : 'SERVICE_UNAVAILABLE', 502);
    }
  };
}
