import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from '../src/server/core/config.ts';
import { SessionStore } from '../src/server/core/session.ts';
import { resetHandler } from '../src/server/core/reset-handler.ts';

await test('F9 reset retires only its owner, survives restart, rejects old work and repeats safely', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'diw-reset-'));
  const config = readConfig({ DEMO_DATA_DIR: dir, MAX_ACTIVE_SESSIONS: '2' });
  let store = new SessionStore(config);
  try {
    const a = store.start(null); const b = store.start(null);
    for (const [token, wallet] of [[a.token, 'wallet-a'], [b.token, 'wallet-b']]) {
      assert.ok(token && wallet);
      store.allocateWallet(token); store.claimWalletCreation(token); store.completeWallet(token, wallet);
      store.reserveOffer(token);
    }
    const beforeB = store.offer(b.token);
    const handle = resetHandler(config, store);
    const request = (body = '{}', origin = config.origin, query = '') => new Request(`${config.origin}/api/session/reset${query}`, {
      method: 'POST', headers: { origin, 'content-type': 'application/json', cookie: `diw-session=${a.token}` }, body,
    });
    assert.equal((await handle(request('{}', 'https://foreign.example'))).status, 403);
    assert.equal((await handle(request('{"walletId":"wallet-b"}'))).status, 400);
    assert.equal((await handle(request('{}', config.origin, '?walletId=wallet-b'))).status, 400);
    assert.ok(store.get(a.token));
    const result = await handle(request());
    assert.equal(result.status, 200);
    assert.ok(result.headers.get('set-cookie')?.includes('Max-Age=0'));
    assert.equal(store.get(a.token), null);
    assert.equal((await handle(request())).status, 200);
    assert.deepEqual(store.offer(b.token), beforeB);
    assert.throws(() => store.offer(a.token));
    assert.throws(() => store.completeWallet(a.token, 'late-wallet'));
    assert.throws(() => store.reserveVerification(a.token, 'late-credential'));
    store.close(); store = new SessionStore(config);
    assert.equal(store.get(a.token), null);
    const fresh = store.start(null);
    assert.notEqual(fresh.token, a.token);
    assert.equal(store.binding(fresh.token), null);
    assert.equal(store.binding(b.token)?.walletId, 'wallet-b');
  } finally { store.close(); rmSync(dir, { recursive: true, force: true }); }
});
