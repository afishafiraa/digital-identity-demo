'use client';

import { useEffect, useRef, useState } from 'react';
import { parseOfferSnapshot } from '../lib/offer';
import type { OfferSnapshot } from '../lib/offer';

export function useCredentialOffer({ onReceived }: { onReceived: () => void }) {
  const [snapshot, setSnapshot] = useState<OfferSnapshot>({ state: 'none' });
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const receive = useRef<HTMLButtonElement>(null);
  const wasOpened = useRef(false);
  const decisionAttempt = useRef(false);

  async function load(method: 'GET' | 'POST', signal: AbortSignal): Promise<OfferSnapshot> {
    const response = await fetch('/api/offer', {
      method, signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]),
      credentials: 'same-origin', cache: 'no-store', redirect: 'error',
      ...(method === 'POST' ? { headers: { 'Content-Type': 'application/json' }, body: '{}' } : {}),
    });
    if (!response.ok) throw new Error('Offer unavailable');
    const value: unknown = await response.json();
    return parseOfferSnapshot(value);
  }

  useEffect(() => {
    const abort = new AbortController();
    controller.current = abort;
    async function restore(): Promise<void> {
      try {
        const next = await load('GET', abort.signal);
        if (!abort.signal.aborted) { setSnapshot(next); setOpen(!['none', 'accepted', 'declined'].includes(next.state)); }
      } catch {
        if (!abort.signal.aborted) { setError(true); setOpen(true); }
      } finally { if (!abort.signal.aborted) setBusy(false); }
    }
    void restore();
    return () => abort.abort();
  }, []);

  useEffect(() => {
    if (open) { wasOpened.current = true; heading.current?.focus(); }
    else if (wasOpened.current) receive.current?.focus();
  }, [open]);
  useEffect(() => {
    if (snapshot.state !== 'ready') return;
    const timer = setTimeout(() => setSnapshot({ state: 'expired' }), Math.max(0, Date.parse(snapshot.offer.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [snapshot]);

  async function decide(method: 'GET' | 'POST' | 'DELETE'): Promise<void> {
    const abort = controller.current;
    if (inFlight.current || !abort || abort.signal.aborted) return;
    if (method !== 'GET' && snapshot.state !== 'ready') return;
    inFlight.current = true; decisionAttempt.current = true;
    setBusy(true); setError(false); setOpen(true);
    try {
      const response = await fetch('/api/offer/decision', {
        method, signal: AbortSignal.any([abort.signal, AbortSignal.timeout(45000)]),
        credentials: 'same-origin', cache: 'no-store', redirect: 'error',
        ...(method !== 'GET' && snapshot.state === 'ready' ? {
          headers: { 'Content-Type': 'application/json', 'X-Demo-Offer': snapshot.offer.reviewId }, body: '{}',
        } : {}),
      });
      if (!response.ok) throw new Error('Receipt unconfirmed');
      const value: unknown = await response.json();
      let next = parseOfferSnapshot(value);
      if (next.state === 'none') { decisionAttempt.current = false; next = await load('GET', abort.signal); }
      if (!abort.signal.aborted) {
        setSnapshot(next);
        if (next.state === 'accepted') onReceived();
        if (next.state === 'accepted' || next.state === 'declined') { setOpen(false); decisionAttempt.current = false; }
      }
    } catch { if (!abort.signal.aborted) setError(true); }
    finally { inFlight.current = false; if (!abort.signal.aborted) setBusy(false); }
  }

  async function requestOffer(method: 'GET' | 'POST'): Promise<void> {
    if (decisionAttempt.current || snapshot.state === 'accepting') { await decide('GET'); return; }
    const abort = controller.current;
    if (inFlight.current || !abort || abort.signal.aborted) return;
    inFlight.current = true;
    setOpen(true); setBusy(true); setError(false);
    try {
      const next = await load(method, abort.signal);
      if (!abort.signal.aborted) setSnapshot(next);
    } catch { if (!abort.signal.aborted) setError(true); }
    finally { inFlight.current = false; if (!abort.signal.aborted) setBusy(false); }
  }

  const walletContent = <div className="receive">
    {!open && <div className="receipt-message" role="status" aria-live="polite">{snapshot.state === 'accepted' ? <p>Training Certificate received. Storage in your wallet is confirmed.</p> : snapshot.state === 'declined' ? <p>Offer declined. No credential was received from this offer.</p> : null}</div>}
    <button ref={receive} type="button" className="primary receive-button" disabled={busy || open} onClick={() => { void requestOffer('POST'); }}>Receive sample credential <span aria-hidden="true">↗</span></button>
    {open && <section className="offer-panel" aria-labelledby="offer-heading" aria-busy={busy}>
      <p className="eyebrow accent">Wallet (User) · review an issuer offer</p>
      <h2 id="offer-heading" ref={heading} tabIndex={-1}>Review credential offer</h2>
      <div role="status" aria-live="polite">
        {busy ? <p>Checking your credential offer…</p> : error ? <p>{decisionAttempt.current ? 'Receipt could not be confirmed. Check the earlier operation before continuing; acceptance will not be repeated.' : 'The offer could not be confirmed. Your wallet is unchanged. Check or retry the same request.'}</p> : snapshot.state === 'ready' ? <>
          <article className="credential-preview" aria-label="Training Certificate offer preview">
            <header className="credential-masthead">
              <span className="issuer-monogram" aria-hidden="true">NL</span>
              <div><span className="credential-label">Fictional issuer</span><p className="offer-issuer">Offered by {snapshot.offer.issuer}</p></div>
            </header>
            <div className="credential-document">
              <span className="credential-label">Digital training credential</span>
              <h3>{snapshot.offer.credential}</h3>
              <dl>
                <div><dt>Holder</dt><dd>{snapshot.offer.holderName}</dd></div>
                <div><dt>Course</dt><dd>{snapshot.offer.course}</dd></div>
                <div><dt>Completed</dt><dd>{snapshot.offer.completionDate}</dd></div>
              </dl>
              <div className="credential-footer"><span>SD-JWT VC · dc+sd-jwt</span><span className="offer-badge">Offer · not issued</span></div>
            </div>
          </article>
          <details className="credential-json">
            <summary>View offered credential data (JSON)</summary>
            <p className="small" id="json-note">These are the offered claims. A signed VC is created after acceptance; this preview contains no signature or holder proof.</p>
            <pre tabIndex={0} aria-label="Offered credential claims in JSON" aria-describedby="json-note"><code>{JSON.stringify({
              issuer_name: snapshot.offer.issuer,
              holder_name: snapshot.offer.holderName,
              completion_date: snapshot.offer.completionDate,
              course: snapshot.offer.course,
            }, null, 2)}</code></pre>
          </details>
          <p className="small">Offer expires at <time dateTime={snapshot.offer.expiresAt}>{new Date(snapshot.offer.expiresAt).toLocaleTimeString('en-GB')}</time>. This offer has not added a credential to your wallet.</p>
          <p className="small">Accept to store this credential in your wallet, or decline to receive nothing.</p>
        </> : snapshot.state === 'accepting' ? <p>Receipt is not confirmed. The earlier operation may still be pending or may have failed. Check your wallet; acceptance will not be repeated.</p> : snapshot.state === 'pending' ? <p>The earlier request is not confirmed yet. Check again to look up the same offer. If it cannot be found, you can request a fresh offer after five minutes.</p> : snapshot.state === 'expired' ? <p>This offer has expired. Request a fresh offer to continue.</p> : <p>No current offer. Request a sample credential to review it.</p>}
      </div>
      <div className="offer-actions">
        {!busy && !error && snapshot.state === 'ready' && <>
          <button type="button" className="primary" onClick={() => { void decide('POST'); }}>Accept credential</button>
          <button type="button" className="secondary" onClick={() => { void decide('DELETE'); }}>Decline offer</button>
        </>}
        {!busy && (error || snapshot.state !== 'ready') && <button type="button" className="primary" onClick={() => { void requestOffer(snapshot.state === 'pending' && !error ? 'GET' : 'POST'); }}>{decisionAttempt.current || snapshot.state === 'accepting' ? 'Check receipt' : error ? 'Check or retry offer' : snapshot.state === 'pending' ? 'Check offer' : 'Request fresh offer'}</button>}
        <button type="button" className="secondary" disabled={busy} onClick={() => { setOpen(false); }}>Back to wallet</button>
      </div>
    </section>}
  </div>;
  return { walletContent, busy, requestFromIssuer: () => requestOffer('POST') };
}
