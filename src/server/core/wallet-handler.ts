import type { Config } from './config.ts';
import { AppError, errorResponse, json } from './errors.ts';
import { requireMutation } from './request.ts';
import { readSessionCookie, type SessionStore } from './session.ts';
import { walletGateway } from './wallet-gateway.ts';
import type { WalletGateway } from './wallet-gateway.ts';
import { provisionWallet } from './wallet-session.ts';

export function walletHandler(config: Config, store: SessionStore, testGateway?: WalletGateway) {
  return async (request: Request): Promise<Response> => {
    try {
      await requireMutation(request, config.origin);
      if (new URL(request.url).search) throw new AppError('INVALID_REQUEST', 400);
      const cookie = readSessionCookie(request, config);
      if (cookie.state !== 'present') throw new AppError('FORBIDDEN', 403);
      if (!store.get(cookie.token)) throw new AppError('SESSION_EXPIRED', 409);
      const service = config.services.wallet;
      if (!service && !testGateway) throw new AppError('SERVICE_UNAVAILABLE', 503);
      const gateway = testGateway ?? (service ? walletGateway(service, AbortSignal.timeout(12000)) : null);
      if (!gateway) throw new AppError('SERVICE_UNAVAILABLE', 503);
      const result = await provisionWallet(store, cookie.token, gateway);
      return json({ state: result.state }, result.state === 'active' ? 200 : 202);
    } catch (error) { return errorResponse(error); }
  };
}
