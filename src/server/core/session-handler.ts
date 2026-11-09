import type { Config } from './config.ts';
import { AppError, errorResponse, json } from './errors.ts';
import { requireMutation } from './request.ts';
import { readSessionCookie, sessionCookie, type SessionStore } from './session.ts';

export function sessionHandler(config: Config, store: SessionStore) {
  return async (request: Request): Promise<Response> => {
    try {
      const cookie = readSessionCookie(request, config);
      const token = cookie.state === 'present' ? cookie.token : null;
      if (request.method === 'GET') {
        const session = store.get(token);
        const binding = session && token ? store.binding(token) : null;
        const state = binding?.phase === 'ready' ? 'active' : binding ? 'provisioning' : session ? 'awaiting-integration' : cookie.state === 'missing' ? 'not-started' : 'expired';
        return json({ state, session, wallet: binding ? { state: binding.phase === 'ready' ? 'ready' : 'provisioning' } : null });
      }
      await requireMutation(request, config.origin);
      if (request.method === 'POST') {
        const fresh = request.headers.get('x-demo-new-session') === 'true';
        if (cookie.state === 'invalid' && !fresh) throw new AppError('SESSION_EXPIRED', 409);
        const result = store.start(fresh && !store.get(token) ? null : token);
        const response = json({ state: 'awaiting-integration', session: result.session, wallet: null }, result.created ? 201 : 200);
        // Do not extend a resumed session's cookie beyond its fixed server-side expiry.
        if (result.created) response.headers.set('Set-Cookie', sessionCookie(result.token, config));
        return response;
      }
      if (request.method === 'DELETE') {
        store.revoke(token);
        const response = json({ state: 'not-started', session: null, wallet: null });
        response.headers.set('Set-Cookie', sessionCookie('', config, true));
        return response;
      }
      return json({ error: { code: 'INVALID_REQUEST', message: 'Method not allowed.' } }, 405);
    } catch (error) { return errorResponse(error); }
  };
}
