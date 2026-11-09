import 'server-only';
import { resetHandler } from './core/reset-handler.ts';
import { presentationHandler } from './core/presentation-handler.ts';
import { sharingHandler } from './core/sharing-handler.ts';
import { profileHandler } from './core/profile-handler.ts';
import { verificationHandler } from './core/verification-handler.ts';
import { credentialsHandler } from './core/credentials-handler.ts';
import { readConfig } from './core/config.ts';
import { SessionStore } from './core/session.ts';
import { sessionHandler } from './core/session-handler.ts';
import { walletHandler } from './core/wallet-handler.ts';
import { offerDecisionHandler } from './core/offer-decision-handler.ts';
import { offerHandler } from './core/offer-handler.ts';

// One lazily opened handle per Next.js process; preserve it across development reloads.
interface Runtime { config: ReturnType<typeof readConfig>; store: SessionStore }
declare global {
  // `var` declares the actual process-global property used during development reloads.
  var diwRuntime: Runtime | undefined;
}
function runtime(): Runtime {
  if (!globalThis.diwRuntime) {
    const config = readConfig();
    globalThis.diwRuntime = { config, store: new SessionStore(config) };
  }
  return globalThis.diwRuntime;
}
export function handleSession(request: Request): Promise<Response> {
  const { config, store } = runtime();
  return sessionHandler(config, store)(request);
}
export function handleReset(request: Request): Promise<Response> {
  const { config, store } = runtime();
  return resetHandler(config, store)(request);
}
export function handleWallet(request: Request): Promise<Response> {
  const { config, store } = runtime();
  return walletHandler(config, store)(request);
}
export function handleOffer(request: Request): Promise<Response> {
  const { config, store } = runtime();
  return offerHandler(config, store)(request);
}
export { errorResponse, json } from './core/errors.ts';

export function handleOfferDecision(request: Request): Promise<Response> {
  const { config, store } = runtime();
  return offerDecisionHandler(config, store)(request);
}

export function handleCredentials(request: Request): Promise<Response> {
  const { config, store } = runtime();
  return credentialsHandler(config, store)(request);
}

export function handleVerification(request: Request): Promise<Response> {
  const { config, store } = runtime();
  return verificationHandler(config, store)(request);
}

export function handleProfile(request: Request): Promise<Response> {
  const { config, store } = runtime();
  return profileHandler(config, store)(request);
}

export function handleSharing(request: Request): Promise<Response> {
  const { config, store } = runtime();
  return sharingHandler(config, store)(request);
}
export function handleSharingDecision(request: Request): Promise<Response> {
  const { config, store } = runtime();
  return sharingHandler(config, store, fetch, true)(request);
}

export function handlePresentation(request: Request): Promise<Response> {
  const { config, store } = runtime();
  return presentationHandler(config, store)(request);
}
