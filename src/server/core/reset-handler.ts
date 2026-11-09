import type { Config } from './config.ts';
import { AppError, errorResponse, json } from './errors.ts';
import { requireMutation } from './request.ts';
import { readSessionCookie, sessionCookie, type SessionStore } from './session.ts';

export function resetHandler(config: Config, store: SessionStore) {
  return async (request: Request): Promise<Response> => {
    try {
      if (request.method !== 'POST' || new URL(request.url).search) throw new AppError('INVALID_REQUEST', 400);
      await requireMutation(request, config.origin);
      const cookie = readSessionCookie(request, config);
      if (cookie.state !== 'present') throw new AppError('FORBIDDEN', 403);
      store.reset(cookie.token);
      const response = json({ state: 'not-started' });
      response.headers.set('Set-Cookie', sessionCookie('', config, true));
      return response;
    } catch (error) { return errorResponse(error); }
  };
}
