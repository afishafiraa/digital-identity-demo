'use client';

import { useEffect, useRef, useState } from 'react';
import { parsePresentation, type PresentationSnapshot } from '../lib/presentation';

export function usePresentation() {
  const [snapshot, setSnapshot] = useState<PresentationSnapshot>({ state: 'none' });
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const sequence = useRef(0);
  const inFlight = useRef(false);
  const status = useRef<HTMLDivElement>(null);
  const state = snapshot.state;
  const attemptId = snapshot.state === 'none' ? null : snapshot.attemptId;

  async function call(reviewId?: string): Promise<PresentationSnapshot | null> {
    const abort = controller.current;
    if (!abort || abort.signal.aborted || (reviewId && inFlight.current)) return null;
    const currentSequence = ++sequence.current;
    if (reviewId) inFlight.current = true;
    setBusy(true);
    try {
      const response = await fetch('/api/presentation', { method: reviewId ? 'POST' : 'GET', credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(reviewId ? 35000 : 15000)]),
        ...(reviewId ? { headers: { 'Content-Type': 'application/json', 'X-Demo-Review': reviewId }, body: '{}' } : {}) });
      if (!response.ok) throw new Error('Presentation result unavailable');
      const value: unknown = await response.json(); const next = parsePresentation(value);
      if (!abort.signal.aborted && sequence.current === currentSequence) { setSnapshot(next); return next; }
    } catch {
      if (!abort.signal.aborted && sequence.current === currentSequence) { const next: PresentationSnapshot = { state: 'unavailable', attemptId: attemptId ?? 'unconfirmed' }; setSnapshot(next); return next; }
    } finally {
      if (!abort.signal.aborted && sequence.current === currentSequence) { inFlight.current = false; setBusy(false); if (reviewId) setSending(false); if (reviewId) status.current?.focus(); }
    }
    return null;
  }
  useEffect(() => {
    controller.current = new AbortController(); void call();
    return () => controller.current?.abort();
  }, []);
  useEffect(() => {
    if (state !== 'pending' || sending || !attemptId) return;
    const abort = new AbortController();
    async function poll(): Promise<void> {
      for (let count = 0; count < 10 && !abort.signal.aborted; count++) {
        await new Promise<void>(resolve => { const timer = setTimeout(resolve, 1000); abort.signal.addEventListener('abort', () => { clearTimeout(timer); resolve(); }, { once: true }); });
        if (!abort.signal.aborted) { const next = await call(); if (!next || next.state !== 'pending') return; }
      }
      if (!abort.signal.aborted) setSnapshot({ state: 'unavailable', attemptId: attemptId ?? 'unconfirmed' });
    }
    void poll(); return () => abort.abort();
  }, [state, attemptId, sending]);

  function clear() {
    controller.current?.abort(); controller.current = new AbortController(); sequence.current++;
    inFlight.current = false; setBusy(false); setSending(false); setSnapshot({ state: 'none' });
  }
  async function submit(reviewId: string) { if (inFlight.current) return; setSending(true); setSnapshot({ state: 'pending', attemptId: 'unconfirmed' }); await call(reviewId); }
  const panel = state === 'none' ? null : <section className={`offer-panel presentation-result result-${state}`} aria-labelledby="presentation-heading" aria-busy={busy}>
    <p className="eyebrow accent">Harbor Works · verifier result</p>
    <h2 id="presentation-heading">{state === 'verified' ? 'Verified' : state === 'failed' ? 'Verification failed' : state === 'expired' ? 'Request no longer available' : state === 'unavailable' ? 'Result not confirmed' : 'Verification pending'}</h2>
    <div role="status" aria-live="polite" tabIndex={-1} ref={status}><p className="small">{state === 'verified' ? 'Harbor Works confirmed this presentation passed its verification policies. The received claims match the credential you approved.' : state === 'failed' ? 'Harbor Works rejected the presentation. It did not satisfy the request or its credential and holder-proof checks.' : state === 'expired' ? 'This request expired or was lost. Open Verifier to start a new request and review sharing again.' : state === 'unavailable' ? 'The service is unavailable or the outcome is still inconclusive. Check this attempt’s result before starting a new verification; this action does not resend your credential.' : 'The presentation is being prepared or the verifier is processing it. Delivery alone does not confirm verification.'}</p></div>
    {state !== 'verified' && state !== 'failed' && state !== 'expired' && <button type="button" className="secondary" disabled={busy} onClick={() => { void call(); }}>{busy ? 'Checking…' : 'Check verification result'}</button>}
    {state === 'verified' && <p className="small">Signature, holder binding and request checks were performed by walt.id. This demo does not establish real-world issuer accreditation.</p>}
  </section>;
  return { panel, started: state !== 'none', submit, clear };
}
