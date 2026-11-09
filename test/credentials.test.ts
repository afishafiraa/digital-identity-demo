import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from '../src/server/core/config.ts';
import { SessionStore } from '../src/server/core/session.ts';
import { credentialsHandler } from '../src/server/core/credentials-handler.ts';
import { parseCredentials } from '../src/lib/credentials.ts';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'diw-credentials-'));
  const config = readConfig({ DEMO_DATA_DIR: dir, WALT_WALLET_URL: 'http://wallet.test' });
  const store = new SessionStore(config);
  function visitor(name: string) {
    const { token } = store.start(null);
    store.allocateWallet(token); store.claimWalletCreation(token); store.completeWallet(token, name);
    return token;
  }
  const a = visitor('wallet-a'); const b = visitor('wallet-b');
  const faults = { offline: false, detailMissing: false, unsupported: false, malformed: false, missingDates: false, mismatch: false, duplicate: false };
  const paths: string[] = [];
  const fetcher: typeof fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    assert.equal(url.origin, 'http://wallet.test');
    paths.push(url.pathname);
    if (faults.offline) throw new Error('private-service-secret');
    if (url.pathname === '/wallet/wallet-b/credentials') return Response.json([]);
    if (url.pathname === '/wallet/wallet-a/credentials') {
      const row = { id: 'stored-a', format: faults.unsupported ? 'jwt_vc_json' : 'dc+sd-jwt' };
      return Response.json(faults.duplicate ? [row, row] : [row]);
    }
    assert.equal(url.pathname, '/wallet/wallet-a/credentials/stored-a');
    if (faults.detailMissing) return new Response(null, { status: 404 });
    return Response.json({ id: faults.mismatch ? 'foreign' : 'stored-a', addedAt: faults.missingDates ? null : '2026-11-08T10:00:00Z',
      holderKeyBinding: 'private-key-reference', metadata: { secret: 'private-metadata' },
      credential: { format: 'dc+sd-jwt', signed: 'raw-signed-token', signature: 'raw-signature', credentialData: {
        vct: 'urn:diw:training:1', issuer_name: 'Northstar Learning', iss: 'did:jwk:fictional', holder_name: 'Alex Morgan',
        course: faults.malformed ? null : 'Cloud Foundations', completion_date: '2026-10-15',
        ...(faults.missingDates ? {} : { iat: 1794096000, nbf: 1794096000, exp: 1825632000 }),
        cnf: { jwk: 'private-key-material' },
      } },
    });
  };
  const handle = credentialsHandler(config, store, fetcher);
  function request(token = a, query = '', method = 'GET') {
    return new Request(`${config.origin}/api/credentials${query}`, { method, headers: { cookie: token ? `diw-session=${token}` : '' } });
  }
  async function read(token = a) {
    const response = await handle(request(token));
    assert.equal(response.status, 200);
    const value: unknown = await response.json();
    return parseCredentials(value);
  }
  return { config, store, a, b, faults, paths, handle, request, read, close: () => { store.close(); rmSync(dir, { recursive: true, force: true }); } };
}

await test('F4 reads owned real-shaped stored claims and dates, excluding raw tokens and key material', async () => {
  const f = fixture();
  try {
    const response = await f.handle(f.request());
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store, private');
    const raw = await response.text();
    for (const secret of ['raw-signed-token', 'raw-signature', 'private-key-material', 'private-key-reference', 'private-metadata', 'cnf', 'wallet-a']) assert.equal(raw.includes(secret), false);
    const value: unknown = JSON.parse(raw);
    const [credential] = parseCredentials(value);
    assert.ok(credential);
    assert.equal(credential.issuer, 'Northstar Learning');
    assert.equal(credential.issuerId, 'did:jwk:fictional');
    assert.equal(credential.holderName, 'Alex Morgan');
    assert.equal(credential.course, 'Cloud Foundations');
    assert.equal(credential.completionDate, '2026-10-15');
    assert.equal(credential.issuedAt, new Date(1794096000 * 1000).toISOString());
    assert.equal(credential.expiresAt, new Date(1825632000 * 1000).toISOString());
    assert.equal(credential.addedAt, '2026-11-08T10:00:00Z');
    assert.deepEqual(await f.read(), [credential]);
  } finally { f.close(); }
});

await test('F4 empty and pending offers cannot become received cards, and sessions cannot select another wallet', async () => {
  const f = fixture();
  try {
    const offer = f.store.reserveOffer(f.b).reference;
    f.store.decide(f.b, offer.id, 'accepting');
    assert.deepEqual(await f.read(f.b), []);
    f.paths.length = 0;
    assert.equal((await f.handle(f.request('', ''))).status, 403);
    assert.equal((await f.handle(f.request(f.b, '?walletId=wallet-a'))).status, 400);
    assert.equal((await f.handle(f.request(f.b, '?credentialId=stored-a'))).status, 400);
    assert.equal((await f.handle(f.request(f.b, '', 'POST'))).status, 400);
    assert.deepEqual(f.paths, []);
    assert.deepEqual(await f.read(f.b), []);
    assert.deepEqual(f.paths, ['/wallet/wallet-b/credentials']);
  } finally { f.close(); }
});

await test('F4 read failures and missing detail never masquerade as an empty wallet; safe retry works', async () => {
  const f = fixture();
  try {
    f.faults.offline = true;
    const failed = await f.handle(f.request());
    assert.equal(failed.status, 502);
    assert.equal((await failed.text()).includes('private-service-secret'), false);
    f.faults.offline = false; f.faults.detailMissing = true;
    assert.equal((await f.handle(f.request())).status, 502);
    f.faults.detailMissing = false;
    assert.equal((await f.read()).length, 1);
  } finally { f.close(); }
});

await test('F4 unsupported, malformed, mismatched and duplicate records fail closed; absent dates stay unknown', async () => {
  const f = fixture();
  try {
    for (const key of ['unsupported', 'malformed', 'mismatch', 'duplicate'] as const) {
      f.faults[key] = true;
      assert.equal((await f.handle(f.request())).status, 502);
      f.faults[key] = false;
    }
    f.faults.missingDates = true;
    const [credential] = await f.read();
    assert.ok(credential);
    assert.equal(credential.issuedAt, null);
    assert.equal(credential.notBefore, null);
    assert.equal(credential.expiresAt, null);
    assert.equal(credential.addedAt, null);
    assert.throws(() => parseCredentials([{ ...credential, expiresAt: 'invalid' }]));
  } finally { f.close(); }
});
