'use client';

import { useEffect, useRef, useState } from 'react';
import { parseCredentials } from '../lib/credentials';
import type { StoredCredentialView } from '../lib/credentials';
import { usePresentation } from './presentation-result';
import { useSharingReview } from './sharing-review';
import { VerificationRequest } from './verification-request';
import { IdentityDetails, IdentityExchange, useIdentityProfile } from './identity-profile';
import { useCredentialOffer } from './credential-offer';

type ReadState = { state: 'loading' } | { state: 'error' } | { state: 'ready'; credentials: StoredCredentialView[] };

function StoredCredentials({ revision }: { revision: number }) {
  const [result, setResult] = useState<ReadState>({ state: 'loading' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    async function read(): Promise<void> {
      setResult({ state: 'loading' });
      try {
        const response = await fetch('/api/credentials', { signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]), credentials: 'same-origin', cache: 'no-store', redirect: 'error' });
        if (!response.ok) throw new Error('Wallet read unavailable');
        const value: unknown = await response.json();
        const credentials = parseCredentials(value);
        if (!abort.signal.aborted) setResult({ state: 'ready', credentials });
      } catch { if (!abort.signal.aborted) setResult({ state: 'error' }); }
    }
    void read();
    return () => abort.abort();
  }, [revision, retry]);

  function date(value: string | null) {
    return value ? <time dateTime={value}>{new Date(value).toLocaleString('en-GB', { timeZone: 'UTC' })} UTC</time> : 'Not provided';
  }

  return <section className="stored-credentials" aria-labelledby="stored-heading" aria-busy={result.state === 'loading'}>
    <div className="collection-heading"><div><p className="eyebrow accent">Your collection</p><h2 id="stored-heading">Your credentials</h2></div><span className="collection-symbol" aria-hidden="true">▦</span></div>
    <div role="status" aria-live="polite">
      {result.state === 'loading' ? <p className="small">Reading your stored credentials…</p> : result.state === 'error' ? <p className="small">Your credentials could not be read. Wallet contents and validity are unavailable. Retry to check the same wallet.</p> : result.credentials.length === 0 ? <p className="small">No credentials received yet. Choose Receive sample credential above, review the offer, then accept to keep it here.</p> : <p className="small">{result.credentials.length} stored {result.credentials.length === 1 ? 'credential' : 'credentials'}. Open a card to inspect its claims and dates.</p>}
    </div>
    {result.state === 'error' && <button type="button" className="secondary" onClick={() => setRetry(value => value + 1)}>Retry wallet read</button>}
    {result.state === 'ready' && result.credentials.map(credential => <details key={credential.id} className="stored-card credential-preview">
      <summary>
        <span className="card-topline"><span className="credential-label">{credential.issuer} · Training Certificate</span><span className="card-mark" aria-hidden="true">✳</span></span>
        <span className="card-chip" aria-hidden="true" />
        <span className="credential-label received-label">Received · Training Certificate</span>
        <span className="stored-title">{credential.course}</span>
        <span className="card-holder">{credential.holderName}</span>
        <span className="card-bottomline"><span>{credential.issuer}</span><span className="details-toggle"><span className="details-open-label">View details</span><span className="details-close-label">Close details</span><span className="card-chevron" aria-hidden="true">↗</span></span></span>
      </summary>
      <div className="credential-document">
        <h3>Training Certificate</h3>
        <dl>
          <div><dt>Issuer</dt><dd>{credential.issuer}</dd></div>
          <div><dt>Holder</dt><dd>{credential.holderName}</dd></div>
          <div><dt>Course</dt><dd>{credential.course}</dd></div>
          <div><dt>Completed</dt><dd>{credential.completionDate}</dd></div>
          <div><dt>Received</dt><dd>{date(credential.addedAt)}</dd></div>
          <div><dt>Issued</dt><dd>{date(credential.issuedAt)}</dd></div>
          <div><dt>Not before</dt><dd>{date(credential.notBefore)}</dd></div>
          <div><dt>Expires</dt><dd>{date(credential.expiresAt)}</dd></div>
        </dl>
        <p className="small">Dates come from the stored credential and wallet receipt record. Signature validity and revocation status have not been checked in this view.</p>
        <p className="small">Issuer identifier: <span className="issuer-id">{credential.issuerId}</span></p>
        <div className="credential-footer"><span>SD-JWT VC · dc+sd-jwt</span><span className="offer-badge">Stored in wallet</span></div>
      </div>
    </details>)}
  </section>;
}

const roles = [
  { id: 'wallet', label: 'Wallet (User)', name: 'Alex Morgan', symbol: '01' },
  { id: 'issuer', label: 'Issuer', name: 'Northstar Learning', symbol: '02' },
  { id: 'verifier', label: 'Verifier', name: 'Harbor Works', symbol: '03' },
] as const;
type DemoRole = typeof roles[number]['id'];

export function WalletContents() {
  const [revision, setRevision] = useState(0);
  const presentation = usePresentation();
  const sharing = useSharingReview(reviewId => { void presentation.submit(reviewId); }, presentation.started);
  const identity = useIdentityProfile(revision);
  const [role, setRole] = useState<DemoRole>('wallet');
  const tabList = useRef<HTMLDivElement>(null);
  const { walletContent, busy, requestFromIssuer } = useCredentialOffer({ onReceived: () => setRevision(value => value + 1) });

  function select(next: DemoRole) {
    setRole(next);
    tabList.current?.querySelector<HTMLButtonElement>(`#role-tab-${next}`)?.focus();
  }
  return <div className="demo-roles">
    <div className="role-tabs" role="tablist" aria-label="Demo participants" ref={tabList}>
      {roles.map((entry, index) => <button type="button" role="tab" id={`role-tab-${entry.id}`} key={entry.id}
        aria-controls={`role-panel-${entry.id}`} aria-selected={role === entry.id} tabIndex={role === entry.id ? 0 : -1}
        onClick={() => setRole(entry.id)} onKeyDown={event => {
          let next;
          if (event.key === 'ArrowRight') next = roles[(index + 1) % roles.length];
          else if (event.key === 'ArrowLeft') next = roles[(index + roles.length - 1) % roles.length];
          else if (event.key === 'Home') next = roles[0];
          else if (event.key === 'End') next = roles[roles.length - 1];
          if (next) { event.preventDefault(); select(next.id); }
        }}>
        <span className="role-tab-number" aria-hidden="true">{entry.symbol}</span>
        <span>{entry.label}<span className="role-tab-name">{entry.name}</span></span>
      </button>)}
    </div>
    <div role="tabpanel" id="role-panel-wallet" aria-labelledby="role-tab-wallet" hidden={role !== 'wallet'} tabIndex={0}>
      <div className="participant-heading"><span className="participant-mark" aria-hidden="true">AM</span><div><p className="eyebrow accent">Wallet (User) · credential holder</p><h2>Alex Morgan<span className="participant-you">You in this demo</span></h2></div></div>
      <p className="small participant-description">This is your wallet. Northstar Learning offers your certificate; you decide whether to accept it. Harbor Works can request it for verification.</p>
      <IdentityDetails role="wallet" result={identity.result} retry={identity.retry} />
      {sharing.panel}
      {presentation.panel}
      {walletContent}
      <StoredCredentials revision={revision} />
      <div className="participant-next"><p className="small">Ready to explore who requests your credential?</p><button className="secondary" type="button" onClick={() => select('verifier')}>Go to Verifier <span aria-hidden="true">↗</span></button></div>
    </div>
    <div role="tabpanel" id="role-panel-issuer" aria-labelledby="role-tab-issuer" hidden={role !== 'issuer'} tabIndex={0}>
      <div className="participant-heading"><span className="participant-mark" aria-hidden="true">NL</span><div><p className="eyebrow accent">Issuer · offers the credential</p><h2>Northstar Learning</h2></div></div>
      <p className="small participant-description">The fictional training provider confirms Alex Morgan completed Cloud Foundations. It offers a Training Certificate for Alex to review in the wallet.</p>
      <IdentityDetails role="issuer" result={identity.result} retry={identity.retry} />
      <dl className="participant-facts"><div><dt>Offers</dt><dd>Training Certificate</dd></div><div><dt>To</dt><dd>Alex Morgan · Wallet (User)</dd></div><div><dt>Course</dt><dd>Cloud Foundations</dd></div></dl>
      <p className="small">Creating an offer opens the Wallet (User) tab. Only the user can accept or decline it; creating an offer does not add a credential to the wallet.</p>
      <button className="primary" type="button" disabled={busy} onClick={() => { select('wallet'); void requestFromIssuer(); }}>Create sample offer <span aria-hidden="true">↗</span></button>
    </div>
    <div role="tabpanel" id="role-panel-verifier" aria-labelledby="role-tab-verifier" hidden={role !== 'verifier'} tabIndex={0}>
      <div className="participant-heading"><span className="participant-mark" aria-hidden="true">HW</span><div><p className="eyebrow accent">Verifier · requests evidence</p><h2>Harbor Works</h2></div></div>
      <p className="small participant-description">The fictional verifier asks Alex Morgan for a Training Certificate as evidence of training. The request comes from Harbor Works; approval belongs to the wallet user.</p>
      <IdentityDetails role="verifier" result={identity.result} retry={identity.retry} />
      <VerificationRequest presentationStarted={presentation.started} onNewRequest={() => { presentation.clear(); sharing.clear(); }} onReceive={() => select('wallet')} onReview={attemptId => { select('wallet'); void sharing.reviewRequest(attemptId); }} />
    </div>
    <IdentityExchange />
  </div>;
}
