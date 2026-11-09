import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from '../src/server/core/config.ts';
import { SessionStore } from '../src/server/core/session.ts';
import { offerHandler } from '../src/server/core/offer-handler.ts';
import { AppError } from '../src/server/core/errors.ts';
import { isRecord } from '../src/server/core/validation.ts';
import { parseOfferSnapshot } from '../src/lib/offer.ts';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'diw-offer-test-'));
  const config = readConfig({ DEMO_DATA_DIR: dir, WALT_ISSUER_URL: 'http://issuer.test' });
  const store = new SessionStore(config);
  function visitor() {
    const session = store.start(null);
    const allocation = store.allocateWallet(session.token);
    store.claimWalletCreation(session.token);
    store.completeWallet(session.token, `wallet-${allocation.storeId}`);
    return session.token;
  }
  const a = visitor(); const b = visitor();
  const issued = new Set<string>();
  let creates = 0;
  const faults = { offline: false, lostResponse: false, missing: false, malformed: false, expired: false };
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    assert.equal(url.origin, 'http://issuer.test');
    if (faults.offline) throw new Error('private-service-secret');
    if (url.pathname === '/.well-known/openid-credential-issuer/openid4vci') return Response.json({ credential_issuer: url.origin });
    if (url.pathname === '/issuer2/credential-offers') {
      assert.equal(init?.method, 'POST');
      assert.equal(typeof init.body, 'string');
      assert.ok(typeof init.body === 'string');
      const body: unknown = JSON.parse(init.body);
      assert.ok(isRecord(body));
      assert.equal(body['profileId'], 'training');
      assert.equal(body['authMethod'], 'PRE_AUTHORIZED');
      assert.equal(body['expiresInSeconds'], 300);
      const id = body['sessionId'];
      assert.ok(typeof id === 'string');
      creates++;
      issued.add(id);
      if (faults.lostResponse) throw new AppError('UPSTREAM_TIMEOUT', 504);
      return Response.json({ offerId: id, profileId: 'training', credentialOffer: 'private-preauthorized-code' });
    }
    const id = url.pathname.split('/').at(-1);
    if (!id || !issued.has(id) || faults.missing) return new Response(null, { status: 404 });
    return Response.json({
      sessionId: id, credentialConfigurationId: 'training',
      expiresAt: new Date(Date.now() + (faults.expired ? -1000 : 300000)).toISOString(),
      issuerKey: { private: 'private-key-material' }, credentialOffer: 'private-preauthorized-code',
      credentialData: { issuer_name: 'Northstar Learning', holder_name: 'Alex Morgan', course: faults.malformed ? null : 'Cloud Foundations', completion_date: '2026-10-15' },
    });
  };
  const handle = offerHandler(config, store, fetcher);
  function request(method = 'POST', token = a, body = '{}', origin = config.origin, search = '') {
    return new Request(`${config.origin}/api/offer${search}`, {
      method, headers: { origin, 'content-type': 'application/json', cookie: token ? `diw-session=${token}` : '' },
      ...(method === 'GET' ? {} : { body }),
    });
  }
  async function snapshot(response: Response) {
    const value: unknown = await response.json();
    return parseOfferSnapshot(value);
  }
  return { config, store, a, b, handle, request, snapshot, faults, creates: () => creates,
    close: () => { store.close(); rmSync(dir, { recursive: true, force: true }); } };
}

await test('F2 real-shaped offer review creates once, whitelists claims and never writes wallet credentials', async () => {
  const f = fixture();
  try {
    const binding = f.store.binding(f.a);
    assert.deepEqual(await f.snapshot(await f.handle(f.request('GET'))), { state: 'none' });
    assert.equal(f.creates(), 0);
    const results = await Promise.all([f.handle(f.request()), f.handle(f.request())]);
    assert.equal(f.creates(), 1);
    for (const response of results) assert.ok([200, 202].includes(response.status));
    const response = await f.handle(f.request());
    assert.equal(response.headers.get('cache-control'), 'no-store, private');
    const raw = await response.text();
    for (const secret of ['private-key-material', 'private-preauthorized-code', 'issuerKey', 'credentialOffer', f.a, binding?.walletId ?? 'wallet-']) assert.equal(raw.includes(secret), false);
    const value: unknown = JSON.parse(raw);
    const snapshot = parseOfferSnapshot(value);
    assert.equal(snapshot.state, 'ready');
    if (snapshot.state !== 'ready') throw new Error('Expected ready');
    assert.equal(snapshot.offer.issuer, 'Northstar Learning');
    assert.equal(snapshot.offer.holderName, 'Alex Morgan');
    assert.equal(snapshot.offer.course, 'Cloud Foundations');
    assert.deepEqual(f.store.binding(f.a), binding);
    assert.equal(f.creates(), 1);
    const reopened = new SessionStore(f.config);
    try { assert.deepEqual(reopened.offer(f.a), f.store.offer(f.a)); }
    finally { reopened.close(); }
  } finally { f.close(); }
});

await test('F2 lost creation response checks the same upstream session before any retry', async () => {
  const f = fixture();
  try {
    f.faults.lostResponse = true;
    assert.equal((await f.handle(f.request())).status, 504);
    const original = f.store.offer(f.a)?.id;
    assert.ok(original);
    assert.equal((await f.snapshot(await f.handle(f.request()))).state, 'ready');
    assert.equal(f.store.offer(f.a)?.id, original);
    assert.equal(f.creates(), 1);
    f.faults.missing = true;
    const missing = await f.handle(f.request());
    assert.equal(missing.status, 202);
    assert.deepEqual(await f.snapshot(missing), { state: 'pending' });
    assert.equal(f.creates(), 1);
  } finally { f.close(); }
});

await test('F2 offline issuer preserves wallet, redacts errors and permits a safe retry', async () => {
  const f = fixture();
  try {
    const before = f.store.binding(f.a);
    f.faults.offline = true;
    const failed = await f.handle(f.request());
    assert.equal(failed.status, 502);
    assert.equal((await failed.text()).includes('private-service-secret'), false);
    assert.equal(f.store.offer(f.a), null);
    assert.deepEqual(f.store.binding(f.a), before);
    f.faults.offline = false;
    assert.equal((await f.snapshot(await f.handle(f.request()))).state, 'ready');
    assert.equal(f.creates(), 1);
  } finally { f.close(); }
});

await test('F2 expired and superseded offers cannot be current; fresh request has a new reference', async () => {
  const f = fixture();
  try {
    await f.handle(f.request());
    const original = f.store.offer(f.a);
    assert.ok(original);
    f.faults.expired = true;
    assert.deepEqual(await f.snapshot(await f.handle(f.request('GET'))), { state: 'expired' });
    f.faults.expired = false;
    assert.equal((await f.snapshot(await f.handle(f.request()))).state, 'ready');
    const current = f.store.offer(f.a);
    assert.ok(current);
    assert.notEqual(current.id, original.id);
    assert.throws(() => f.store.expireOffer(f.a, original.id));
    assert.equal(f.store.offer(f.a)?.id, current.id);
    f.store.expireOffer(f.a, current.id);
    assert.deepEqual(await f.snapshot(await f.handle(f.request('GET'))), { state: 'expired' });
    assert.equal(f.creates(), 2);
  } finally { f.close(); }
});

await test('F2 checks ownership and rejects arbitrary references, bodies and cross-origin submissions', async () => {
  const f = fixture();
  try {
    await f.handle(f.request());
    assert.deepEqual(await f.snapshot(await f.handle(f.request('GET', f.b))), { state: 'none' });
    assert.equal((await f.handle(f.request('GET', ''))).status, 403);
    assert.equal((await f.handle(f.request('POST', f.b, '{}', 'https://foreign.example'))).status, 403);
    assert.equal((await f.handle(f.request('POST', f.b, '{"offerId":"foreign"}'))).status, 400);
    assert.equal((await f.handle(f.request('GET', f.b, '{}', f.config.origin, `?offerId=${f.store.offer(f.a)?.id}`))).status, 400);
    assert.equal(f.creates(), 1);
    assert.equal((await f.snapshot(await f.handle(f.request('POST', f.b)))).state, 'ready');
    assert.notEqual(f.store.offer(f.a)?.id, f.store.offer(f.b)?.id);
  } finally { f.close(); }
});

await test('F2 malformed upstream claims are not rendered or reported as a successful review', async () => {
  const f = fixture();
  try {
    f.faults.malformed = true;
    assert.equal((await f.handle(f.request())).status, 502);
    f.faults.malformed = false;
    assert.equal((await f.snapshot(await f.handle(f.request()))).state, 'ready');
    assert.equal(f.creates(), 1);
  } finally { f.close(); }
});
