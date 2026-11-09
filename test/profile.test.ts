import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from '../src/server/core/config.ts';
import { SessionStore } from '../src/server/core/session.ts';
import { profileHandler } from '../src/server/core/profile-handler.ts';
import { parseProfile } from '../src/lib/profile.ts';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'diw-profile-'));
  const config = readConfig({ DEMO_DATA_DIR: dir, WALT_WALLET_URL: 'http://wallet.test' });
  const store = new SessionStore(config);
  function visitor(id: string) { const { token } = store.start(null); store.allocateWallet(token); store.claimWalletCreation(token); store.completeWallet(token, id); return token; }
  const a = visitor('a'); const b = visitor('b');
  const key = { kty: 'EC', crv: 'P-256', x: 'a'.repeat(43), y: 'b'.repeat(43) };
  const did = `did:jwk:${Buffer.from(JSON.stringify(key)).toString('base64url')}`;
  const faults = { offline: false, privateKey: false, wrongDid: false, malformed: false, expire: false };
  const paths: string[] = [];
  const fetcher: typeof fetch = async input => {
    const url = new URL(input instanceof Request ? input.url : input.toString());
    assert.equal(url.origin, 'http://wallet.test'); paths.push(url.pathname);
    if (faults.offline) throw new Error('private-service-secret');
    if (url.pathname === '/wallet/a' || url.pathname === '/wallet/b') return Response.json({ walletId: url.pathname.endsWith('/a') ? 'a' : 'b', hasDidStore: false, hasStaticDid: false, secret: 'private-metadata' });
    if (url.pathname.endsWith('/keys')) return Response.json(url.pathname.includes('/a/') ? [{ keyId: 'public-key-reference', keyType: faults.malformed ? 42 : 'secp256r1', privateJwk: { d: 'private-key-sentinel' } }] : []);
    if (url.pathname.endsWith('/credentials')) return Response.json(url.pathname.includes('/a/') ? [{ id: 'stored', format: 'dc+sd-jwt' }] : []);
    assert.equal(url.pathname, '/wallet/a/credentials/stored');
    if (faults.expire) store.get = () => null;
    return Response.json({ id: 'stored', holderKeyBinding: 'private-binding', credential: { format: 'dc+sd-jwt', signed: 'raw-token', credentialData: {
      iss: faults.wrongDid ? `did:jwk:${Buffer.from(JSON.stringify({ ...key, d: 'private-issuer-sentinel' })).toString('base64url')}` : did,
      vct: 'urn:diw:training:1', issuer_name: 'Northstar Learning', holder_name: 'Alex Morgan', course: 'Cloud Foundations', completion_date: '2026-10-15',
      cnf: { jwk: { ...key, ...(faults.privateKey ? { d: 'private-holder-sentinel' } : {}) } },
    } } });
  };
  const handle = profileHandler(config, store, fetcher);
  function request(token = a, query = '', method = 'GET') { return new Request(`${config.origin}/api/profile${query}`, { method, headers: { cookie: token ? `diw-session=${token}` : '' } }); }
  return { store, a, b, key, did, faults, paths, handle, request, close: () => { store.close(); rmSync(dir, { recursive: true, force: true }); } };
}

await test('identity profile exposes only owned wallet references and whitelisted public key data', async () => {
  const f = fixture();
  try {
    const response = await f.handle(f.request()); assert.equal(response.status, 200); assert.equal(response.headers.get('cache-control'), 'no-store, private');
    const raw = await response.text();
    for (const secret of ['private-key-sentinel', 'private-binding', 'raw-token', 'private-metadata', 'privateJwk']) assert.equal(raw.includes(secret), false);
    const value: unknown = JSON.parse(raw); const profile = parseProfile(value);
    assert.equal(profile.walletId, 'a'); assert.equal(profile.issuerDid, f.did); assert.deepEqual(profile.holderPublicKey, f.key); assert.deepEqual(profile.issuerPublicKey, f.key);
    assert.equal(profile.holderThumbprint?.length, 43); assert.deepEqual(profile.keys, [{ id: 'public-key-reference', type: 'secp256r1' }]);
    assert.ok(f.paths.every(path => !path.includes('export') && !path.includes('generate')));
  } finally { f.close(); }
});
await test('identity profile separates empty visitor from unavailable data and rejects foreign selectors', async () => {
  const f = fixture();
  try {
    const response = await f.handle(f.request(f.b)); const value: unknown = await response.json(); const profile = parseProfile(value);
    assert.equal(profile.walletId, 'b'); assert.deepEqual(profile.keys, []); assert.equal(profile.holderPublicKey, null); assert.equal(profile.issuerDid, null);
    const count = f.paths.length;
    assert.equal((await f.handle(f.request(''))).status, 403);
    assert.equal((await f.handle(f.request(f.b, '?walletId=a'))).status, 400);
    assert.equal((await f.handle(f.request(f.a, '', 'POST'))).status, 400);
    assert.equal(f.paths.length, count);
    f.faults.offline = true; const failed = await f.handle(f.request()); assert.equal(failed.status, 502); assert.equal((await failed.text()).includes('private-service-secret'), false);
  } finally { f.close(); }
});
await test('identity profile rejects malformed or private key data and session expiry during upstream reads', async () => {
  const f = fixture();
  try {
    for (const fault of ['malformed', 'privateKey', 'wrongDid'] as const) { f.faults[fault] = true; assert.equal((await f.handle(f.request())).status, 502); f.faults[fault] = false; }
    f.faults.expire = true; assert.equal((await f.handle(f.request())).status, 409);
  } finally { f.close(); }
});
