'use client';

import { useEffect, useRef, useState } from 'react';
import { parseVerification, type VerificationSnapshot } from '../lib/verification';

export function VerificationRequest({ onReceive, onReview, onNewRequest, presentationStarted }: { onReceive: () => void; onReview: (attemptId: string) => void; onNewRequest: () => void; presentationStarted: boolean }) {
  const [snapshot, setSnapshot] = useState<VerificationSnapshot>({ state: 'none' });
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const status = useRef<HTMLDivElement>(null);

  async function load(signal: AbortSignal, method: 'GET' | 'POST'): Promise<void> {
    try {
      const response = await fetch('/api/verification', {
        method, credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
        ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}),
      });
      if (!response.ok) throw new Error('Verification request unavailable');
      const value: unknown = await response.json();
      const next = parseVerification(value);
      if (!signal.aborted) { setSnapshot(next); setError(false); if (method === 'POST' && next.state === 'ready') onNewRequest(); }
    } catch { if (!signal.aborted) { setSnapshot({ state: 'none' }); setError(true); } }
    finally { if (!signal.aborted) setBusy(false); }
  }
  useEffect(() => {
    const abort = new AbortController(); controller.current = abort;
    void load(abort.signal, 'GET');
    return () => abort.abort();
  }, []);
  useEffect(() => { if (presentationStarted) setSnapshot({ state: 'presentation-started' }); }, [presentationStarted]);
  useEffect(() => {
    if (snapshot.state !== 'ready') return;
    const timer = setTimeout(() => setSnapshot({ state: 'expired' }), Math.max(0, Date.parse(snapshot.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [snapshot]);

  async function create(): Promise<void> {
    const abort = controller.current;
    if (inFlight.current || !abort || abort.signal.aborted) return;
    inFlight.current = true; setBusy(true); setError(false);
    if (presentationStarted || snapshot.state === 'presentation-started') onNewRequest();
    try { await load(abort.signal, 'POST'); }
    finally { inFlight.current = false; if (!abort.signal.aborted) status.current?.focus(); }
  }
  return <section className="offer-panel" aria-labelledby="verification-heading" aria-busy={busy}>
    <p className="eyebrow accent">Verifier · create a request</p>
    <h2 id="verification-heading">Try verification</h2>
    <p className="small">Harbor Works requests a Training Certificate as evidence of your training.</p>
    <div role="status" aria-live="polite" tabIndex={-1} ref={status}>
      <p className="small">{busy ? 'Checking the verification request…' : error ? 'The verification request could not be prepared. Your credential stays in your wallet. Retry to check or create the current request.' : snapshot.state === 'ready' ? 'Request prepared for Harbor Works. No credential has been sent. Open Wallet (User) to review what would be shared and choose whether to approve.' : snapshot.state === 'presentation-started' ? 'This request has a presentation attempt. Open Wallet (User) to check its result, or start a new verification and review.' : snapshot.state === 'missing-credential' ? 'Open Wallet (User), choose Receive sample credential, then accept it before trying verification.' : snapshot.state === 'pending' ? 'A request is being prepared. Check again shortly; if it cannot be confirmed, a new attempt becomes available after 30 seconds.' : snapshot.state === 'expired' ? 'This request is no longer available. Try verification again to prepare a new request.' : 'Prepare a request to explore how credential verification begins. Nothing is shared at this step.'}</p>
      {snapshot.state === 'ready' && <p className="small">Request available until <time dateTime={snapshot.expiresAt}>{new Date(snapshot.expiresAt).toLocaleTimeString('en-GB', { timeZone: 'UTC' })} UTC</time>.</p>}
    </div>
    {snapshot.state === 'ready' && <button type="button" className="primary" onClick={() => onReview(snapshot.attemptId)}>Review sharing in Wallet</button>}
    {snapshot.state === 'missing-credential' && <button type="button" className="secondary" onClick={onReceive}>Go to Wallet (User)</button>}
    <button type="button" className="secondary" disabled={busy || snapshot.state === 'ready'} onClick={() => { void create(); }}>{busy ? 'Preparing request…' : error ? 'Retry verification request' : snapshot.state === 'ready' ? 'Request prepared' : snapshot.state === 'presentation-started' ? 'Start new verification' : snapshot.state === 'pending' ? 'Check verification request' : 'Try verification'}</button>
  </section>;
}
