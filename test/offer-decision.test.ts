import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from '../src/server/core/config.ts';
import { SessionStore } from '../src/server/core/session.ts';
import { offerDecisionHandler } from '../src/server/core/offer-decision-handler.ts';
import { parseOfferSnapshot } from '../src/lib/offer.ts';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'diw-decision-'));
  const config = readConfig({ DEMO_DATA_DIR: dir, WALT_WALLET_URL: 'http://wallet.test', WALT_ISSUER_URL: 'http://issuer.test' });
  const store = new SessionStore(config);
  function visitor() {
    const { token } = store.start(null);
    store.allocateWallet(token); store.claimWalletCreation(token); store.completeWallet(token, `wallet-${token}`);
    return token;
  }
  const token = visitor(); const foreign = visitor();
  const offer = store.reserveOffer(token).reference;
  let receives = 0;
  const credentials = ['earlier-credential'];
  const faults = { lost: false, beforeStore: false, offline: false, supersede: false, malformed: false };
  const fetcher: typeof fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    if (faults.offline) throw new Error('private-secret');
    if (url.hostname === 'issuer.test') return Response.json({ sessionId: offer.id, credentialConfigurationId: 'training', expiresAt: new Date(Date.now() + 300000).toISOString(), credentialOffer: { credential_issuer: 'http://issuer.test', grants: {} } });
    assert.equal(url.pathname.startsWith(`/wallet/${offer.walletId}/`), true);
    if (url.pathname.endsWith('/credentials')) return Response.json(credentials.map(id => ({ id })));
    if (url.pathname.endsWith('/keys')) return Response.json(['holder-key']);
    if (url.pathname.endsWith('/receive')) {
      assert.equal(init?.method, 'POST'); receives++;
      if (faults.beforeStore) throw new Error('private-secret');
      credentials.push('received-credential');
      if (faults.supersede) {
        store.confirmReceipt(token, offer.id);
        store.reserveOffer(token);
      }
      if (faults.lost) throw new Error('private-secret');
      return Response.json({ credentialIds: faults.malformed ? [] : ['received-credential'] });
    }
    throw new Error('Unexpected endpoint');
  };
  const handle = offerDecisionHandler(config, store, fetcher);
  function request(method = 'POST', owner = token, id = offer.id, origin = config.origin) {
    return new Request(`${config.origin}/api/offer/decision`, { method, headers: { origin, cookie: `diw-session=${owner}`, 'content-type': 'application/json', 'X-Demo-Offer': id }, ...(method === 'GET' ? {} : { body: '{}' }) });
  }
  async function snapshot(method = 'GET') {
    const response = await handle(request(method));
    const value: unknown = await response.json();
    return parseOfferSnapshot(value);
  }
  return { config, store, token, foreign, offer, faults, credentials, handle, request, snapshot, receives: () => receives, close: () => { store.close(); rmSync(dir, { recursive: true, force: true }); } };
}

await test('F3 concurrent and repeated acceptance stores once; receipt survives reopening', async () => {
  const f = fixture();
  try {
    await Promise.all([f.handle(f.request()), f.handle(f.request()), f.handle(f.request())]);
    const state = f.store.decision(f.token)?.state;
    assert.equal(state, 'accepted');
    if (state === 'accepted') {
      assert.equal(f.receives(), 1);
      assert.deepEqual(await f.snapshot('POST'), { state: 'accepted' });
      assert.equal(f.receives(), 1);
    } else { assert.equal(f.receives(), 0); }
    const reopened = new SessionStore(f.config);
    try { assert.equal(reopened.decision(f.token)?.state, state); } finally { reopened.close(); }
  } finally { f.close(); }
});

await test('F3 decline stores nothing and cannot later accept the same offer', async () => {
  const f = fixture();
  try {
    assert.deepEqual(await f.snapshot('DELETE'), { state: 'declined' });
    assert.deepEqual(await f.snapshot('POST'), { state: 'declined' });
    assert.deepEqual(f.credentials, ['earlier-credential']);
    assert.equal(f.receives(), 0);
  } finally { f.close(); }
});

await test('F3 lost receive response reconciles storage without repeating receive', async () => {
  const f = fixture();
  try {
    f.faults.lost = true;
    assert.equal((await f.handle(f.request())).status, 502);
    assert.equal(f.store.decision(f.token)?.state, 'accepting');
    const reopened = new SessionStore(f.config);
    try {
      const response = await offerDecisionHandler(f.config, reopened, async () => Response.json(f.credentials.map(id => ({ id }))))(f.request('GET'));
      const value: unknown = await response.json();
      assert.deepEqual(parseOfferSnapshot(value), { state: 'accepted' });
    } finally { reopened.close(); }
    assert.deepEqual(await f.snapshot('POST'), { state: 'accepted' });
    assert.equal(f.receives(), 1);
  } finally { f.close(); }
});

await test('F3 ambiguous failure remains checkable even after expiry, with no blind retry or replacement', async () => {
  const f = fixture();
  try {
    f.faults.beforeStore = true;
    const failed = await f.handle(f.request());
    assert.equal(failed.status, 502);
    assert.equal((await failed.text()).includes('private-secret'), false);
    f.store.expireOffer(f.token, f.offer.id);
    assert.equal(f.store.reserveOffer(f.token).reference.id, f.offer.id);
    assert.deepEqual(await f.snapshot(), { state: 'accepting' });
    assert.deepEqual(await f.snapshot('POST'), { state: 'accepting' });
    assert.deepEqual(await f.snapshot('DELETE'), { state: 'accepting' });
    assert.equal(f.receives(), 1);
  } finally { f.close(); }
});

await test('F3 unavailable service before dispatch is retryable; malformed receive never claims success', async () => {
  const f = fixture();
  try {
    f.faults.offline = true;
    assert.equal((await f.handle(f.request())).status, 502);
    assert.equal(f.store.decision(f.token), null);
    f.faults.offline = false; f.faults.malformed = true;
    assert.equal((await f.handle(f.request())).status, 502);
    assert.equal(f.store.decision(f.token)?.state, 'accepting');
    assert.deepEqual(await f.snapshot(), { state: 'accepted' });
    assert.equal(f.receives(), 1);
  } finally { f.close(); }
});

await test('F3 rejects foreign/stale references and cross-origin mutation; stale success cannot update a newer offer', async () => {
  const f = fixture();
  try {
    assert.equal((await f.handle(f.request('POST', f.foreign))).status, 409);
    assert.equal((await f.handle(f.request('POST', f.token, 'stale'))).status, 409);
    assert.equal((await f.handle(f.request('POST', f.token, f.offer.id, 'https://foreign.test'))).status, 403);
    f.faults.supersede = true;
    assert.equal((await f.handle(f.request())).status, 409);
    assert.equal(f.store.decision(f.token), null);
    assert.notEqual(f.store.offer(f.token)?.id, f.offer.id);
  } finally { f.close(); }
});
