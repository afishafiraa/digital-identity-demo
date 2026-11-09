'use client';

import { useEffect, useState } from 'react';
import { parseProfile, type IdentityProfile } from '../lib/profile';

type ProfileState = { state: 'loading' | 'error' } | { state: 'ready'; profile: IdentityProfile };
export function useIdentityProfile(revision: number) {
  const [result, setResult] = useState<ProfileState>({ state: 'loading' });
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    async function read(): Promise<void> {
      setResult({ state: 'loading' });
      try {
        const response = await fetch('/api/profile', { credentials: 'same-origin', cache: 'no-store', redirect: 'error', signal: AbortSignal.any([abort.signal, AbortSignal.timeout(15000)]) });
        if (!response.ok) throw new Error('Profile unavailable');
        const value: unknown = await response.json();
        const profile = parseProfile(value);
        if (!abort.signal.aborted) setResult({ state: 'ready', profile });
      } catch { if (!abort.signal.aborted) setResult({ state: 'error' }); }
    }
    void read(); return () => abort.abort();
  }, [revision, retry]);
  return { result, retry: () => setRetry(value => value + 1) };
}

export function IdentityDetails({ role, result, retry }: { role: 'wallet' | 'issuer' | 'verifier'; result: ProfileState; retry: () => void }) {
  const profile = result.state === 'ready' ? result.profile : null;
  return <section className="identity-profile" aria-label={`${role} identity profile`}>
    <div className="identity-profile-title"><h3>Identity profile</h3><span>{role === 'verifier' ? 'Configured demo flow' : 'Current session · read only'}</span></div>
    {role === 'verifier' ? <>
      <dl className="identity-fields">
        <div><dt>Identity</dt><dd>Harbor Works · verifier</dd></div>
        <div><dt>DID</dt><dd>No verifier DID used in this flow</dd></div>
        <div><dt>Client ID</dt><dd><code>redirect_uri:&lt;response URI&gt;</code><small>Each request identifies where its presentation response must be sent. This is the identifier pattern, not an active request link.</small></dd></div>
        <div><dt>Signing key</dt><dd>No request-signing key used<small>The current request is unsigned and the response is not encrypted. A verifier does not need a DID/key pair for this request mode.</small></dd></div>
        <div><dt>Needs to verify</dt><dd>Issuer public key + holder public key<small>Also the requested credential type, audience, nonce and verification policies. A name or DID alone is not proof.</small></dd></div>
      </dl>
      <p className="small">The verifier checks the issuer’s credential signature and the holder’s proof. A successful result is available only after presentation; send your approved presentation from Wallet (User) to see the real result.</p>
    </> : <>
      <div role="status" aria-live="polite">{result.state === 'loading' ? <p className="small">Reading current identity references…</p> : result.state === 'error' ? <p className="small">Identity references are unavailable. This does not mean the wallet has no keys or credentials.</p> : null}</div>
      {result.state === 'error' && <button type="button" className="secondary" onClick={retry}>Retry identity profile</button>}
      {profile && (role === 'wallet' ? <>
        <dl className="identity-fields">
          <div><dt>Wallet ID</dt><dd><code>{profile.walletId}</code><small>A storage container for this visitor’s keys and credentials. It is not a DID or a login credential.</small></dd></div>
          <div><dt>Holder DID</dt><dd>No holder DID configured<small>This SD-JWT flow binds the credential to a public key instead of a holder DID.</small></dd></div>
          <div><dt>Wallet keys</dt><dd>{profile.keys.length ? profile.keys.map(key => <div className="identity-key" key={key.id}><code>{key.id}</code><small>{key.type} · P-256 · key reference, not private key material</small></div>) : <>Not generated yet<small>The wallet generates a holder key when accepting its first credential.</small></>}</dd></div>
          <div><dt>Credential binding</dt><dd>{profile.holderThumbprint ? <><code>{profile.holderThumbprint}</code><small>SHA-256 public-key thumbprint from the stored credential’s <code>cnf.jwk</code>. This identifies the key the holder must prove control of.</small></> : 'Available after a credential is received'}</dd></div>
          <div><dt>Key custody</dt><dd>walt.id Wallet2 · server-side<small>The wallet service keeps the private key and uses it to sign proofs. It is not stored in this browser.</small></dd></div>
        </dl>
        {profile.holderPublicKey && <details className="identity-json"><summary>View holder public key (JWK)</summary><pre>{JSON.stringify(profile.holderPublicKey, null, 2)}</pre><p className="small">Public verification data from the first stored Training Certificate. The private key is not included.</p></details>}
      </> : <>
        <dl className="identity-fields">
          <div><dt>Issuer DID</dt><dd>{profile.issuerDid ? <code>{profile.issuerDid}</code> : 'Available from the credential after acceptance'}<small>The issued credential’s <code>iss</code> identifies its signer. In this demo, <code>did:jwk</code> carries the issuer’s public key.</small></dd></div>
          <div><dt>Signing key</dt><dd>ES256 · P-256<small>The issuer keeps its private signing key server-side. Its public key lets a verifier check the credential signature.</small></dd></div>
          <div><dt>Credential type</dt><dd><code>urn:diw:training:1</code><small>The <code>vct</code> is the type requested by Harbor Works; the credential format is <code>dc+sd-jwt</code>.</small></dd></div>
          <div><dt>Trust</dt><dd>Fictional local issuer<small>A valid signature shows key control, not real-world accreditation. This demo has no external trust registry.</small></dd></div>
        </dl>
        {profile.issuerPublicKey && <details className="identity-json"><summary>View issuer public key (JWK)</summary><pre>{JSON.stringify(profile.issuerPublicKey, null, 2)}</pre><p className="small">Decoded from the issuer DID in your stored credential; no issuer private configuration is read.</p></details>}
      </>)}
    </>}
  </section>;
}

export function IdentityExchange() {
  return <details className="identity-exchange"><summary>How these identities communicate</summary>
    <ol>
      <li><strong>Issuer → Wallet · OID4VCI</strong><p>The user accepts an offer. The wallet proves control of its holder key; the issuer signs the training claims and binds the credential to that public key (<code>cnf.jwk</code>).</p></li>
      <li><strong>Verifier → Wallet · OID4VP request</strong><p>Harbor Works requests <code>urn:diw:training:1</code> using DCQL. The request includes a client ID/audience, response URI and a fresh nonce to tie a response to this request.</p></li>
      <li><strong>Wallet → Verifier · presentation</strong><p>After user approval, the wallet signs a key-binding proof for that audience and nonce, and send the credential with the proof. The verifier checks issuer signature, holder binding, dates and request correlation.</p><span className="later-label">Presentation follows your approval</span></li>
    </ol>
    <p className="small">Names explain the scenario. Identifiers locate participants or keys. Public keys verify signatures; private keys create them. A DID is one way to identify a signer, not a requirement for every participant.</p>
    <p className="small">Your browser calls this app; its server calls the existing walt.id services. The session cookie authorizes your wallet access separately from credential cryptography.</p>
    <a className="small" href="https://openid.net/specs/openid-4-verifiable-presentations-1_0.html" target="_blank" rel="noreferrer">Read the OpenID4VP client identifier rules ↗</a>
  </details>;
}
