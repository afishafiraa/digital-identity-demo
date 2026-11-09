import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from '../src/server/core/config.ts';
import { SessionStore } from '../src/server/core/session.ts';
import { verificationHandler } from '../src/server/core/verification-handler.ts';
import { parseVerification } from '../src/lib/verification.ts';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'diw-f5-'));
  const config = readConfig({ DEMO_DATA_DIR: dir, WALT_WALLET_URL: 'http://wallet.test', WALT_VERIFIER_URL: 'http://verifier.test' });
  const store = new SessionStore(config);
  function visitor(id: string) {
    const { token } = store.start(null); store.allocateWallet(token); store.claimWalletCreation(token); store.completeWallet(token, id); return token;
  }
  const a = visitor('a'); const b = visitor('b');
  const faults = { offline: false, lost: false, malformed: false, used: false, replace: false, empty: false, ambiguous: false };
  let creates = 0;
  const paths: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString()); paths.push(url.pathname);
    if (url.hostname === 'wallet.test') {
      if (url.pathname.endsWith('/credentials')) return Response.json(url.pathname.includes('/b/') || faults.empty ? [] : [{ id: 'stored', format: 'dc+sd-jwt' }]);
      return Response.json({ id: 'stored', credential: { format: 'dc+sd-jwt', credentialData: { vct: 'urn:diw:training:1', issuer_name: 'Northstar Learning', iss: 'did:jwk:fictional', holder_name: 'Alex Morgan', course: 'Cloud Foundations', completion_date: '2026-10-15' } } });
    }
    assert.equal(url.hostname, 'verifier.test');
    if (faults.offline) throw new Error('private-secret');
    if (url.pathname === '/verification-session/create') {
      creates++;
      assert.equal(init?.method, 'POST');
      const body: unknown = JSON.parse(typeof init.body === 'string' ? init.body : 'null');
      assert.deepEqual(body, { flow_type: 'cross_device', core_flow: { dcql_query: { credentials: [{ id: 'training', format: 'dc+sd-jwt', meta: { vct_values: ['urn:diw:training:1'] } }] }, policies: { vc_policies: [{ policy: 'signature' }] } } });
      if (faults.ambiguous) throw new Error('lost response');
      return Response.json({ sessionId: `request-${creates}`, bootstrapAuthorizationRequestUrl: `openid4vp://authorize?request_uri=http://verifier.test/request-${creates}` });
    }
    const id = url.pathname.split('/')[2];
    if (faults.lost) return new Response(null, { status: 404 });
    if (faults.replace) {
      faults.replace = false;
      const previous = store.verification(a); assert.ok(previous);
      store.expireVerification(a, previous.attemptId); store.reserveVerification(a, 'stored');
    }
    return Response.json({ id: faults.malformed ? 'foreign' : id, status: faults.used ? 'SUCCESSFUL' : 'UNUSED', attempted: faults.used, bootstrapAuthorizationRequestUrl: `openid4vp://authorize?request_uri=http://verifier.test/${id}` });
  };
  const handle = verificationHandler(config, store, fetcher);
  function request(token = a, method = 'POST', body = '{}', query = '', origin = config.origin) {
    return new Request(`${config.origin}/api/verification${query}`, { method, headers: { cookie: token ? `diw-session=${token}` : '', origin, 'content-type': 'application/json' }, ...(method === 'GET' ? {} : { body }) });
  }
  async function read(token = a, method = 'POST') {
    const response = await handle(request(token, method)); assert.ok(response.ok, await response.clone().text());
    const value: unknown = await response.json(); return parseVerification(value);
  }
  return { store, a, b, faults, handle, request, read, paths, creates: () => creates, close: () => { store.close(); rmSync(dir, { recursive: true, force: true }); } };
}

await test('F5 creates only the fixed owned request, deduplicates concurrent clicks and resumes without disclosing protocol material', async () => {
  const f = fixture();
  try {
    assert.deepEqual(await f.read(f.a, 'GET'), { state: 'none' });
    const results = await Promise.all([f.read(), f.read()]);
    assert.ok(results.some(result => result.state === 'ready'));
    assert.equal(f.creates(), 1);
    const ready = await f.read(f.a, 'GET'); assert.equal(ready.state, 'ready');
    assert.deepEqual(await f.read(), ready); assert.equal(f.creates(), 1);
    const raw = await (await f.handle(f.request(f.a, 'GET'))).text();
    for (const secret of ['openid4vp', 'request_uri', 'request-1', 'stored', 'walletId']) assert.equal(raw.includes(secret), false);
    assert.ok(f.paths.every(path => !path.endsWith('/present')));
  } finally { f.close(); }
});

await test('F5 missing credential and foreign/browser-selected requests cannot create or read another visitor request', async () => {
  const f = fixture();
  try {
    await f.read();
    assert.deepEqual(await f.read(f.b), { state: 'missing-credential' });
    assert.deepEqual(await f.read(f.b, 'GET'), { state: 'none' });
    const count = f.paths.length;
    for (const request of [f.request(''), f.request(f.b, 'POST', '{"requestId":"request-1"}'), f.request(f.b, 'GET', '{}', '?attemptId=foreign'), f.request(f.a, 'POST', '{}', '', 'http://foreign.test')]) assert.ok((await f.handle(request)).status >= 400);
    assert.equal(f.paths.length, count); assert.equal(f.creates(), 1);
  } finally { f.close(); }
});

await test('F5 service failure and uncertain create preserve storage and permit explicit retry without presentation', async () => {
  const f = fixture();
  try {
    for (const fault of ['offline', 'ambiguous'] as const) {
      f.faults[fault] = true;
      const response = await f.handle(f.request()); assert.equal(response.status, 502);
      assert.equal((await response.text()).includes('private-secret'), false);
      f.faults[fault] = false;
    }
    assert.equal((await f.read()).state, 'ready');
    assert.ok(f.paths.every(path => !path.endsWith('/present')));
  } finally { f.close(); }
});

await test('F5 expired, lost, used, malformed and replaced attempts never remain authorized; pending reservation is bounded', async () => {
  const f = fixture();
  try {
    await f.read();
    f.faults.malformed = true; assert.equal((await f.handle(f.request(f.a, 'GET'))).status, 502); f.faults.malformed = false;
    for (const fault of ['lost', 'used'] as const) {
      f.faults[fault] = true; assert.deepEqual(await f.read(f.a, 'GET'), { state: 'expired' }); f.faults[fault] = false;
      assert.equal((await f.read()).state, 'ready');
    }
    f.faults.replace = true; assert.equal((await f.handle(f.request(f.a, 'GET'))).status, 409);
    assert.deepEqual(await f.read(), { state: 'pending' });
    const pending = f.store.verification(f.a); assert.ok(pending);
    assert.throws(() => f.store.completeVerification(f.b, pending.attemptId, 'foreign', 'openid4vp://authorize'), /no longer current/);
    f.store.expireVerification(f.a, pending.attemptId);
    assert.deepEqual(await f.read(f.a, 'GET'), { state: 'expired' });
    assert.equal((await f.read()).state, 'ready');
    assert.throws(() => f.store.completeVerification(f.a, pending.attemptId, 'stale', 'openid4vp://authorize'), /no longer current/);
    f.faults.empty = true; assert.deepEqual(await f.read(), { state: 'missing-credential' });
    assert.deepEqual(await f.read(f.a, 'GET'), { state: 'expired' });
  } finally { f.close(); }
});
