'use client';

import { useEffect, useRef, useState } from 'react';
import { WalletContents } from './stored-credentials';

type State = 'checking' | 'not-started' | 'expired' | 'awaiting-integration' | 'provisioning' | 'active';
function stateFrom(value: unknown): Exclude<State, 'checking'> {
  if (typeof value !== 'object' || value === null || !('state' in value)) throw new Error('The server returned an unexpected response. Please retry.');
  const state = value.state;
  if (state !== 'not-started' && state !== 'expired' && state !== 'awaiting-integration' && state !== 'provisioning' && state !== 'active') throw new Error('The server returned an unexpected response. Please retry.');
  return state;
}
class SessionError extends Error {
  readonly code: string;
  constructor(message: string, code: string) { super(message); this.code = code; }
}
async function call(path: string, signal: AbortSignal, method = 'GET', fresh = false): Promise<Exclude<State, 'checking'>> {
  const response = await fetch(path, {
    method, signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]), credentials: 'same-origin', cache: 'no-store', redirect: 'error',
    ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json', ...(fresh ? { 'X-Demo-New-Session': 'true' } : {}) }, body: '{}' } : {}),
  });
  const value: unknown = await response.json();
  if (!response.ok) {
    if (typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'object' && value.error !== null && 'message' in value.error && typeof value.error.message === 'string') {
      const code = 'code' in value.error && typeof value.error.code === 'string' ? value.error.code : 'UNKNOWN';
      throw new SessionError(value.error.message, code);
    }
    throw new Error('The wallet could not be reached. Please retry.');
  }
  return stateFrom(value);
}

export function DemoSession() {
  const [state, setState] = useState<State>('checking');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetState, setResetState] = useState<'idle' | 'sending' | 'uncertain'>('idle');
  const [resetDone, setResetDone] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const statusRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    async function resume(): Promise<void> {
      try {
        let next = await call('/api/session', abort.signal);
        if (next === 'active') next = await call('/api/session/wallet', abort.signal, 'POST');
        if (!abort.signal.aborted) setState(next);
      } catch {
        if (!abort.signal.aborted) { setState('not-started'); setError('We could not resume your wallet. Retry to check the same session.'); }
      }
    }
    void resume();
    return () => abort.abort();
  }, []);

  async function start(): Promise<void> {
    const abort = controller.current;
    if (inFlight.current || !abort || abort.signal.aborted) return;
    inFlight.current = true;
    setBusy(true); setError(null);
    setResetDone(false);
    try {
      await call('/api/session', abort.signal, 'POST', state === 'expired');
      const next = await call('/api/session/wallet', abort.signal, 'POST');
      if (!abort.signal.aborted) setState(next);
    } catch (failure) {
      if (!abort.signal.aborted) {
        if (failure instanceof SessionError && failure.code === 'SESSION_EXPIRED') setState('expired');
        setError(failure instanceof Error ? failure.message : 'The wallet could not be reached. Please retry.');
      }
    } finally {
      inFlight.current = false;
      if (!abort.signal.aborted) { setBusy(false); statusRef.current?.focus(); }
    }
  }
  async function reset(checkOnly = false): Promise<void> {
    const abort = controller.current;
    if (inFlight.current || !abort || abort.signal.aborted) return;
    inFlight.current = true;
    setResetState('sending'); setError(null);
    // Unmount the wallet before awaiting reset: old effects cannot restore its UI.
    try {
      const next = checkOnly
        ? await call('/api/session', abort.signal)
        : await call('/api/session/reset', abort.signal, 'POST');
      if (abort.signal.aborted) return;
      if (next !== 'not-started' && next !== 'expired') throw new Error('Reset has not been confirmed. Check its status again before continuing.');
      setState(next); setResetState('idle'); setResetDone(true);
    } catch (failure) {
      if (!abort.signal.aborted) {
        setResetState('uncertain');
        setError(failure instanceof Error ? failure.message : 'Reset could not be confirmed. Check its status before continuing.');
      }
    } finally {
      inFlight.current = false;
      if (!abort.signal.aborted) statusRef.current?.focus();
    }
  }
  const active = state === 'active';
  const resetting = resetState !== 'idle';
  const pending = state === 'provisioning';
  return <section className="intro" aria-labelledby="wallet-title">
    <div className="workspace-heading"><span className="eyebrow">Wallet (User)</span><span className="workspace-badge">Alex Morgan · Demo</span></div>
    
    <h1 id="wallet-title">{active ? <>Your wallet<span className="title-dot">.</span></> : <>Good things.<br />Yours to keep<span className="title-dot">.</span></>}</h1>
    <p className="lede">{active ? 'You are Alex Morgan, the credential holder. Explore the issuer and verifier using the tabs below.' : 'Receive a credential, understand what it says, and choose when to share it.'}</p>
    <div className="notice" role="status" aria-live="polite" tabIndex={-1} ref={statusRef}>
      <span className={`status-dot${active ? ' is-active' : ''}`} aria-hidden="true" />
      <div><strong>{resetState === 'sending' ? 'Resetting your demo…' : resetState === 'uncertain' ? 'Reset not confirmed' : resetDone ? 'Demo reset' : error ? 'Wallet setup needs attention' : busy ? 'Preparing your wallet…' : state === 'checking' ? 'Checking your session…' : active ? 'Wallet connected' : pending ? 'Checking an earlier request' : state === 'expired' ? 'Your previous session is unavailable' : 'A wallet just for this demo'}</strong>
      <p>{error ?? (resetting ? 'Waiting for confirmation. Your earlier wallet is hidden while reset is checked.' : resetDone ? 'Your previous scenario is no longer accessible from this session. Start demo to create a fresh, empty wallet.' : active ? 'A place for your Training Certificate. Request a sample offer to review its issuer and claims.' : pending ? 'The earlier request may still be completing. Check again to reconcile it; a second wallet will not be created.' : state === 'expired' ? 'Start a new session explicitly. This does not recover an expired wallet.' : 'Fictional data only. Sessions expire after 24 hours. Signing keys and credentials stay with the server-side wallet service.')}</p></div>
    </div>
    {!active && !resetting && <button type="button" onClick={() => { void start(); }} disabled={busy || state === 'checking'} className="primary">{busy ? 'Preparing…' : pending ? 'Check wallet' : state === 'expired' && !resetDone ? 'Start a new session' : error ? 'Retry wallet setup' : state === 'awaiting-integration' ? 'Continue wallet setup' : 'Start demo'} <span aria-hidden="true">↗</span></button>}
    {resetting && <button type="button" className="primary" disabled={resetState === 'sending'} onClick={() => { void reset(true); }}>{resetState === 'sending' ? 'Checking…' : 'Check reset status'}</button>}
    {active && !resetting && <>
      <WalletContents />
      <div className="reset-demo">
        <button type="button" className="secondary" onClick={() => { void reset(); }}>Reset demo</button>
        <p className="small">Start again with an empty wallet. Only this browser’s demo is reset; other visitors are unaffected.</p>
      </div>
    </>}
    <p id="start-note" className="small">{active ? 'Fictional data · Server-side wallet' : 'Independent demo · Not for personal documents'}</p>
  </section>;
}
