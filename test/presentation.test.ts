import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from '../src/server/core/config.ts';
import { SessionStore } from '../src/server/core/session.ts';
import { sharingHandler } from '../src/server/core/sharing-handler.ts';
import { presentationHandler } from '../src/server/core/presentation-handler.ts';
import { parsePresentation } from '../src/lib/presentation.ts';

async function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'diw-presentation-'));
  const config = readConfig({ DEMO_DATA_DIR: dir, WALT_WALLET_URL: 'http://wallet.test', WALT_VERIFIER_URL: 'http://verifier.test' });
  const store = new SessionStore(config);
  function visitor(id: string) { const { token } = store.start(null); store.allocateWallet(token); store.claimWalletCreation(token); store.completeWallet(token, id); return token; }
  const a = visitor('a'); const b = visitor('b');
  const ref = store.reserveVerification(a, 'stored').reference;
  const requestUrl = 'openid4vp://authorize?request_uri=http://verifier.test/request'; store.completeVerification(a, ref.attemptId, 'request', requestUrl);
  const claims = { iss: 'did:jwk:fictional', vct: 'urn:diw:training:1', issuer_name: 'Northstar Learning', holder_name: 'Alex Morgan', course: 'Cloud Foundations', completion_date: '2026-10-15', cnf: { jwk: { kty: 'EC', crv: 'P-256', x: 'a'.repeat(43), y: 'b'.repeat(43) } } };
  const faults = { offline: false, lostSend: false, build: false, foreign: false, changed: false, wrongClaims: false, replaced: false };
  let status = 'UNUSED'; let attempted = false; let overall = true;
  let builds = 0; let sends = 0;
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (url.pathname === '/wallet/a/credentials') return Response.json([{ id: 'stored', format: 'dc+sd-jwt' }]);
    if (url.pathname === '/wallet/a/credentials/stored') return Response.json({ id: 'stored', credential: { format: 'dc+sd-jwt', signed: faults.changed ? 'changed-private-token' : 'private-signed-token', credentialData: claims } });
    if (url.pathname === '/wallet/a/credentials/present/build-vp-token') {
      builds++; assert.equal(init?.method, 'POST');
      const body: unknown = JSON.parse(typeof init.body === 'string' ? init.body : 'null');
      assert.deepEqual(body, { requestUrl, selectedCredentialIds: { training: ['stored'] } });
      if (faults.build) throw new Error('private-build-failure');
      status = 'IN_USE'; return Response.json({ vpToken: JSON.stringify({ training: ['private-holder-proof'] }) });
    }
    if (url.pathname === '/wallet/a/credentials/present/send-response') {
      sends++; assert.equal(init?.method, 'POST');
      const body: unknown = JSON.parse(typeof init.body === 'string' ? init.body : 'null');
      assert.deepEqual(body, { requestUrl, vpToken: JSON.stringify({ training: ['private-holder-proof'] }) });
      if (faults.lostSend) { status = 'SUCCESSFUL'; attempted = true; throw new Error('lost-private-response'); }
      attempted = true; if (status === 'IN_USE') status = 'SUCCESSFUL';
      return Response.json({ transmission_success: true });
    }
    assert.equal(url.pathname, '/verification-session/request/info');
    if (faults.offline) throw new Error('private-service-secret');
    if (faults.replaced) { faults.replaced = false; store.expireVerification(a, ref.attemptId); store.reserveVerification(a, 'stored'); }
    return Response.json({ id: faults.foreign ? 'foreign' : 'request', bootstrapAuthorizationRequestUrl: requestUrl, status, attempted,
      policy_results: { overallSuccess: overall }, presented_credentials: { training: [{ credentialData: faults.wrongClaims ? { ...claims, course: 'foreign-credential' } : claims }] },
      authorizationRequest: { client_metadata: { client_name: 'Harbor Works' }, client_id: 'redirect_uri:http://verifier.test/response', response_mode: 'direct_post', response_type: 'vp_token', nonce: 'same-nonce', dcql_query: { credentials: [{ id: 'training', format: 'dc+sd-jwt', meta: { vct_values: ['urn:diw:training:1'] } }] } } });
  };
  function request(method = 'POST', token = a, header?: string, query = '', body = '{}', origin = config.origin) { return new Request(`${config.origin}/api/presentation${query}`, { method, headers: { cookie: token ? `diw-session=${token}` : '', origin, 'content-type': 'application/json', 'X-Demo-Review': header ?? store.sharing(a)?.reviewId ?? 'missing' }, ...(method === 'GET' ? {} : { body }) }); }
  const reviewRequest = new Request(`${config.origin}/api/sharing`, { method: 'POST', headers: { cookie: `diw-session=${a}`, origin: config.origin, 'content-type': 'application/json', 'X-Demo-Verification': ref.attemptId }, body: '{}' });
  assert.equal((await sharingHandler(config, store, fetcher)(reviewRequest)).status, 200);
  const review = store.sharing(a); assert.ok(review); store.decideSharing(a, ref.attemptId, review.reviewId, review.digest, 'approved');
  const handle = presentationHandler(config, store, fetcher);
  async function read(request: Request) { const response = await handle(request); assert.ok(response.ok, await response.clone().text()); const value: unknown = await response.json(); return parsePresentation(value); }
  return { store, config, a, b, ref, faults, request, handle, read, setResult: (next: string, success = true, tried = true) => { status = next; overall = success; attempted = tried; }, counts: () => ({ builds, sends }), close: () => { store.close(); rmSync(dir, { recursive: true, force: true }); } };
}

await test('F7 builds only the approved credential, sends once and trusts only a correlated real-shaped successful verdict', async () => {
  const f = await fixture();
  try {
    assert.deepEqual(await f.read(f.request('GET')), { state: 'none' });
    const results = await Promise.all([f.read(f.request()), f.read(f.request())]);
    assert.ok(results.some(result => result.state === 'verified')); assert.deepEqual(f.counts(), { builds: 1, sends: 1 });
    assert.equal((await f.read(f.request())).state, 'verified'); assert.deepEqual(f.counts(), { builds: 1, sends: 1 });
    const raw = await (await f.handle(f.request('GET'))).text();
    for (const secret of ['private', 'openid4vp', 'nonce', 'wallet', 'vpToken']) assert.equal(raw.includes(secret), false);
    const reopened = new SessionStore(f.config); try { assert.ok(reopened.presentation(f.a)); } finally { reopened.close(); }
  } finally { f.close(); }
});
await test('F7 pending, failed, inconclusive and unavailable are distinct; status alone cannot produce Verified', async () => {
  const f = await fixture();
  try {
    await f.read(f.request());
    f.setResult('PROCESSING'); assert.equal((await f.read(f.request('GET'))).state, 'pending');
    f.setResult('FAILED', false); assert.equal((await f.read(f.request('GET'))).state, 'failed');
    f.setResult('SUCCESSFUL', false); assert.notEqual((await f.read(f.request('GET'))).state, 'verified');
    f.setResult('SUCCESSFUL', true); f.faults.wrongClaims = true; assert.equal((await f.read(f.request('GET'))).state, 'unavailable'); f.faults.wrongClaims = false;
    f.faults.offline = true; assert.equal((await f.read(f.request('GET'))).state, 'unavailable');
    f.faults.offline = false; assert.equal((await f.read(f.request('GET'))).state, 'verified');
  } finally { f.close(); }
});
await test('F7 a lost send response reconciles verification without resending; failed preparation never blindly retries', async () => {
  const f = await fixture();
  try { f.faults.lostSend = true; assert.equal((await f.read(f.request())).state, 'verified'); await f.read(f.request()); assert.deepEqual(f.counts(), { builds: 1, sends: 1 }); } finally { f.close(); }
  const broken = await fixture();
  try { broken.faults.build = true; assert.equal((await broken.read(broken.request())).state, 'unavailable'); await broken.read(broken.request()); assert.deepEqual(broken.counts(), { builds: 1, sends: 0 }); } finally { broken.close(); }
});
await test('F7 rejects foreign/unapproved/changed/expired attempts and suppresses foreign or replaced results', async () => {
  const f = await fixture();
  try {
    for (const request of [f.request('POST', ''), f.request('POST', f.b), f.request('POST', f.a, 'foreign'), f.request('GET', f.a, undefined, '?requestId=foreign'), f.request('POST', f.a, undefined, '', '{"credentialId":"foreign"}'), f.request('POST', f.a, undefined, '', '{}', 'http://foreign.test')]) assert.ok((await f.handle(request)).status >= 400);
    assert.deepEqual(await f.read(f.request('GET', f.b)), { state: 'none' }); assert.deepEqual(f.counts(), { builds: 0, sends: 0 });
    f.faults.changed = true; assert.equal((await f.handle(f.request())).status, 409); assert.deepEqual(f.counts(), { builds: 0, sends: 0 });
  } finally { f.close(); }
  const unapproved = await fixture();
  try {
    unapproved.store.reviewSharing(unapproved.a, unapproved.ref.attemptId, 'changed-review');
    assert.equal((await unapproved.handle(unapproved.request())).status, 403);
    assert.deepEqual(unapproved.counts(), { builds: 0, sends: 0 });
    const review = unapproved.store.sharing(unapproved.a); assert.ok(review);
    unapproved.store.decideSharing(unapproved.a, unapproved.ref.attemptId, review.reviewId, review.digest, 'cancelled');
    assert.equal((await unapproved.handle(unapproved.request())).status, 403);
  } finally { unapproved.close(); }
  const expired = await fixture();
  try { expired.store.expireVerification(expired.a, expired.ref.attemptId); assert.equal((await expired.handle(expired.request())).status, 409); assert.deepEqual(expired.counts(), { builds: 0, sends: 0 }); } finally { expired.close(); }
  const stale = await fixture();
  try { await stale.read(stale.request()); stale.faults.foreign = true; assert.equal((await stale.read(stale.request('GET'))).state, 'unavailable'); stale.faults.foreign = false; stale.faults.replaced = true; assert.equal((await stale.handle(stale.request('GET'))).status, 409); } finally { stale.close(); }
});
