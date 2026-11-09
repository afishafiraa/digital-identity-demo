'use client';

import { useEffect, useRef, useState } from 'react';
import { parseSharing, type SharingSnapshot } from '../lib/sharing';

export function useSharingReview(onPresent: (reviewId: string) => void, presentationStarted: boolean) {
  const [snapshot, setSnapshot] = useState<SharingSnapshot>({ state: 'none' });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const sequence = useRef(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const status = useRef<HTMLDivElement>(null);

  async function call(method: 'GET' | 'POST' | 'DELETE', attemptId?: string): Promise<void> {
    const abort = controller.current;
    if (!abort || abort.signal.aborted || (method !== 'GET' && inFlight.current)) return;
    if (method !== 'GET') inFlight.current = true;
    const currentSequence = ++sequence.current;
    setBusy(true); setError(false);
    const decision = method === 'DELETE' || (method === 'POST' && !attemptId);
    const reviewId = snapshot.state === 'reviewing' || snapshot.state === 'approved' ? snapshot.review.reviewId : null;
    try {
      const response = await fetch(decision ? '/api/sharing/decision' : '/api/sharing', {
        method, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]), credentials: 'same-origin', cache: 'no-store', redirect: 'error',
        ...(method === 'GET' ? {} : { headers: { 'Content-Type': 'application/json', ...(attemptId ? { 'X-Demo-Verification': attemptId } : {}), ...(decision && reviewId ? { 'X-Demo-Review': reviewId } : {}) }, body: '{}' }),
      });
      if (!response.ok) {
        if (response.status === 409) { if (!abort.signal.aborted && sequence.current === currentSequence) { setSnapshot({ state: 'expired' }); setOpen(true); } return; }
        throw new Error('Sharing review unavailable');
      }
      const value: unknown = await response.json(); const next = parseSharing(value);
      if (!abort.signal.aborted && sequence.current === currentSequence) { setSnapshot(next); setOpen(next.state === 'reviewing' || next.state === 'approved' || next.state === 'expired'); }
    } catch { if (!abort.signal.aborted && sequence.current === currentSequence) { setError(true); setOpen(true); } }
    finally { if (method !== 'GET' && sequence.current === currentSequence) inFlight.current = false; if (!abort.signal.aborted && sequence.current === currentSequence) { setBusy(false); if (decision) status.current?.focus(); } }
  }
  useEffect(() => {
    const abort = new AbortController(); controller.current = abort;
    void call('GET'); return () => controller.current?.abort();
  }, []);
  useEffect(() => { if (open) heading.current?.focus(); }, [open]);
  useEffect(() => {
    if (snapshot.state !== 'reviewing' && snapshot.state !== 'approved') return;
    const timer = setTimeout(() => setSnapshot({ state: 'expired' }), Math.max(0, Date.parse(snapshot.review.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [snapshot]);

  const panel = <>
    {!open && snapshot.state === 'cancelled' && <p className="receipt-message small" role="status">Sharing cancelled. No presentation was sent.</p>}
    {open && <section className="offer-panel sharing-review" aria-labelledby="sharing-heading" aria-busy={busy}>
      <p className="eyebrow accent">Wallet (User) · your sharing decision</p>
      <h2 id="sharing-heading" ref={heading} tabIndex={-1}>Review sharing</h2>
      <div role="status" aria-live="polite" tabIndex={-1} ref={status}>
        {busy ? <p className="small">Checking the current request and credential…</p> : error ? <p className="small">Sharing could not be confirmed. Check the current review before continuing; no presentation is sent by this step.</p> : snapshot.state === 'approved' ? <p className="small">{presentationStarted ? 'This approval belongs to the presentation shown below.' : 'Sharing approved for this request. Send the presentation when you are ready.'}</p> : snapshot.state === 'expired' ? <p className="small">This sharing review is no longer current. Open Verifier and prepare a fresh request and review before approving.</p> : null}
      </div>
      {!error && (snapshot.state === 'reviewing' || snapshot.state === 'approved') && <>
        <dl className="participant-facts"><div><dt>To</dt><dd>Harbor Works · verifier</dd></div><div><dt>Purpose</dt><dd>Provide evidence of completed training</dd></div><div><dt>Credential</dt><dd>Training Certificate · {snapshot.review.credential.issuer}</dd></div></dl>
        <div className="disclosure-notice"><strong>The whole credential will be shared.</strong><p>All its claims, issuer identity, dates, credential identifiers, holder public-key binding and issuer signature are included. There is no claim selection in this demo. Your wallet’s private key and session cookie are never shared.</p></div>
        <dl className="participant-facts"><div><dt>Holder</dt><dd>{snapshot.review.credential.holderName}</dd></div><div><dt>Course</dt><dd>{snapshot.review.credential.course}</dd></div><div><dt>Completed</dt><dd>{snapshot.review.credential.completionDate}</dd></div></dl>
        <details className="identity-json"><summary>View all credential claims to be shared</summary><pre>{JSON.stringify(snapshot.review.claims, null, 2)}</pre><p className="small">Actual decoded claims from this stored credential. The signed credential and a fresh holder proof accompany these claims during presentation.</p></details>
        <p className="small">Approval applies only to this request and this credential. Review expires at <time dateTime={snapshot.review.expiresAt}>{new Date(snapshot.review.expiresAt).toLocaleTimeString('en-GB', { timeZone: 'UTC' })} UTC</time>.</p>
      </>}
      <div className="offer-actions">
        {!busy && !error && snapshot.state === 'reviewing' && <><button type="button" className="primary" onClick={() => { void call('POST'); }}>Approve sharing</button><button type="button" className="secondary" onClick={() => { void call('DELETE'); }}>Cancel sharing</button></>}
        {!busy && !error && snapshot.state === 'approved' && !presentationStarted && <button type="button" className="primary" onClick={() => onPresent(snapshot.review.reviewId)}>Send presentation</button>}
        {!busy && error && <button type="button" className="secondary" onClick={() => { void call('GET'); }}>Check sharing review</button>}
        {!busy && (snapshot.state === 'expired' || snapshot.state === 'approved' || snapshot.state === 'none') && <button type="button" className="secondary" onClick={() => setOpen(false)}>Back to wallet</button>}
      </div>
    </section>}
  </>;
  function clear() { controller.current?.abort(); controller.current = new AbortController(); sequence.current++; inFlight.current = false; setSnapshot({ state: 'none' }); setOpen(false); setBusy(false); setError(false); }
  return { panel, clear, reviewRequest: async (attemptId: string) => { setOpen(true); await call('POST', attemptId); } };
}
