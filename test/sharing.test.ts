import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from '../src/server/core/config.ts';
import { SessionStore } from '../src/server/core/session.ts';
import { sharingHandler } from '../src/server/core/sharing-handler.ts';
import { parseSharing } from '../src/lib/sharing.ts';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'diw-sharing-'));
  const config = readConfig({ DEMO_DATA_DIR: dir, WALT_WALLET_URL: 'http://wallet.test', WALT_VERIFIER_URL: 'http://verifier.test' });
  const store = new SessionStore(config);
  function visitor(id: string) { const { token } = store.start(null); store.allocateWallet(token); store.claimWalletCreation(token); store.completeWallet(token, id); return token; }
  const a = visitor('a'); const b = visitor('b');
  const reference = store.reserveVerification(a, 'stored').reference;
  const requestUrl = 'openid4vp://authorize?request_uri=http://verifier.test/request';
  store.completeVerification(a, reference.attemptId, 'request', requestUrl);
  const faults = { offline: false, changed: false, nonce: false, used: false, lost: false, foreign: false, extra: false, replaced: false, private: false };
  const paths: string[] = [];
  const claims = { vct: 'urn:diw:training:1', iss: 'did:jwk:fictional', issuer_name: 'Northstar Learning', holder_name: 'Alex Morgan', course: 'Cloud Foundations', completion_date: '2026-10-15', iat: 1794096000, nbf: 1794096000, exp: 1825632000, cnf: { jwk: { kty: 'EC', crv: 'P-256', kid: 'holder-public-key-id', x: 'a'.repeat(43), y: 'b'.repeat(43) } } };
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString()); paths.push(url.pathname);
    assert.equal(init?.method, 'GET');
    if (faults.offline) throw new Error('private-service-secret');
    if (url.pathname === '/wallet/a/credentials') return Response.json([{ id: 'stored', format: 'dc+sd-jwt' }]);
    if (url.pathname === '/wallet/a/credentials/stored') return Response.json({ id: 'stored', holderKeyBinding: 'private-binding', credential: { format: 'dc+sd-jwt', signed: faults.changed ? 'changed-raw-token' : 'raw-signed-token', credentialData: { ...claims, ...(faults.extra ? { unexpected: 'hidden-disclosure' } : {}), ...(faults.private ? { cnf: { jwk: { ...claims.cnf.jwk, d: 'private-key' } } } : {}) } } });
    assert.equal(url.pathname, '/verification-session/request/info');
    if (faults.lost) return new Response(null, { status: 404 });
    if (faults.replaced) { store.expireVerification(a, reference.attemptId); store.reserveVerification(a, 'stored'); }
    return Response.json({ id: faults.foreign ? 'foreign' : 'request', bootstrapAuthorizationRequestUrl: requestUrl, status: faults.used ? 'SUCCESSFUL' : 'UNUSED', attempted: faults.used,
      authorizationRequest: { client_metadata: { client_name: 'Harbor Works' }, client_id: 'redirect_uri:http://verifier.test/response', response_mode: 'direct_post', response_type: 'vp_token', nonce: faults.nonce ? 'changed' : 'original', dcql_query: { credentials: [{ id: 'training', format: 'dc+sd-jwt', meta: { vct_values: ['urn:diw:training:1'] } }] } } });
  };
  function request(method = 'POST', token = a, decision = false, header?: string, body = '{}', query = '', origin = config.origin) {
    const ref = decision ? store.sharing(a)?.reviewId : reference.attemptId;
    return new Request(`${config.origin}/api/sharing${decision ? '/decision' : ''}${query}`, { method, headers: { cookie: token ? `diw-session=${token}` : '', origin, 'content-type': 'application/json', [decision ? 'X-Demo-Review' : 'X-Demo-Verification']: header ?? ref ?? 'missing' }, ...(method === 'GET' ? {} : { body }) });
  }
  async function handle(request: Request, decision = false) { return sharingHandler(config, store, fetcher, decision)(request); }
  async function read(request: Request, decision = false) { const response = await handle(request, decision); assert.ok(response.ok, await response.clone().text()); const value: unknown = await response.json(); return parseSharing(value); }
  return { config, store, a, b, reference, faults, claims, paths, request, handle, read, close: () => { store.close(); rmSync(dir, { recursive: true, force: true }); } };
}

await test('F6 reviews real-shaped whole claims and binds idempotent approval to the exact stored credential/request', async () => {
  const f = fixture();
  try {
    assert.deepEqual(await f.read(f.request('GET')), { state: 'none' });
    const review = await f.read(f.request()); assert.equal(review.state, 'reviewing');
    if (review.state !== 'reviewing') throw new Error('Missing review');
    assert.deepEqual(review.review.claims, f.claims); assert.equal(review.review.credential.course, 'Cloud Foundations');
    const repeat = await f.read(f.request()); assert.deepEqual(repeat, review);
    const [a, b] = await Promise.all([f.read(f.request('POST', f.a, true), true), f.read(f.request('POST', f.a, true), true)]);
    assert.equal(a.state, 'approved'); assert.deepEqual(a, b);
    const reopened = new SessionStore(f.config);
    try { assert.equal(reopened.sharing(f.a)?.state, 'approved'); } finally { reopened.close(); }
    const raw = await (await f.handle(f.request('GET'))).text();
    for (const secret of ['raw-signed-token', 'private-binding', 'openid4vp', 'nonce', 'client_id']) assert.equal(raw.includes(secret), false);
    assert.ok(f.paths.every(path => !path.includes('/present')));
  } finally { f.close(); }
});
await test('F6 cancel works while services are offline, submits nothing and needs a new review reference', async () => {
  const f = fixture();
  try {
    const first = await f.read(f.request()); if (first.state !== 'reviewing') throw new Error('Missing review');
    f.faults.offline = true; f.paths.length = 0;
    assert.deepEqual(await f.read(f.request('DELETE', f.a, true), true), { state: 'cancelled' });
    assert.deepEqual(f.paths, []);
    assert.equal((await f.handle(f.request('POST', f.a, true, first.review.reviewId), true)).status, 409);
    f.faults.offline = false;
    const next = await f.read(f.request()); if (next.state !== 'reviewing') throw new Error('Missing new review');
    assert.notEqual(next.review.reviewId, first.review.reviewId);
    assert.equal((await f.handle(f.request('POST', f.a, true, first.review.reviewId), true)).status, 409);
  } finally { f.close(); }
});
await test('F6 rejects anonymous, foreign, forged and cross-origin approvals without upstream calls', async () => {
  const f = fixture();
  try {
    await f.read(f.request()); f.paths.length = 0;
    for (const request of [f.request('POST', ''), f.request('POST', f.b, true), f.request('POST', f.a, true, 'foreign'), f.request('POST', f.a, true, undefined, '{"credentialId":"foreign"}'), f.request('POST', f.a, true, undefined, '{}', '', 'http://foreign.test'), f.request('GET', f.a, false, undefined, '{}', '?walletId=foreign')]) assert.ok((await f.handle(request, request.url.includes('/decision'))).status >= 400);
    assert.deepEqual(f.paths, []);
  } finally { f.close(); }
});
await test('F6 changed claims/token/request, used/lost sessions and replacement cannot reuse consent', async () => {
  for (const fault of ['changed', 'nonce', 'used', 'lost', 'foreign', 'extra', 'private', 'replaced'] as const) {
    const f = fixture();
    try {
      await f.read(f.request()); f.faults[fault] = true;
      assert.ok((await f.handle(f.request('POST', f.a, true), true)).status >= 400, fault);
      assert.notEqual(f.store.sharing(f.a)?.state, 'approved');
    } finally { f.close(); }
  }
  const f = fixture();
  try {
    await f.read(f.request()); f.store.expireVerification(f.a, f.reference.attemptId);
    assert.equal((await f.handle(f.request('POST', f.a, true), true)).status, 409);
    assert.deepEqual(await f.read(f.request('GET')), { state: 'expired' });
  } finally { f.close(); }
});
