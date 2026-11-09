import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from '../src/server/core/config.ts';
import { SessionStore } from '../src/server/core/session.ts';
import { AppError } from '../src/server/core/errors.ts';
import { provisionWallet } from '../src/server/core/wallet-session.ts';
import { walletHandler } from '../src/server/core/wallet-handler.ts';
import type { WalletGateway } from '../src/server/core/wallet-gateway.ts';

function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'diw-provision-test-'));
  const config = readConfig({ DEMO_DATA_DIR: dir });
  const store = new SessionStore(config);
  const a = store.start(null); const b = store.start(null);
  const wallets = new Map<string, string>();
  let creates = 0;
  let loseResponse = false;
  let rejectStores = false;
  const gateway: WalletGateway = {
    async ensureStores() { if (rejectStores) throw new AppError('SERVICE_UNAVAILABLE', 503); },
    async create(id) {
      creates++;
      const wallet = `wallet-${creates}`;
      wallets.set(id, wallet);
      if (loseResponse) throw new AppError('UPSTREAM_TIMEOUT', 504);
      return wallet;
    },
    async find(id) { return wallets.get(id) ?? null; },
    async inspect(wallet, id) { if (wallets.get(id) !== wallet) throw new Error('Wrong ownership'); },
  };
  return {
    config, dir, store, a, b, gateway, wallets,
    creates: () => creates,
    setLoseResponse: () => { loseResponse = true; },
    setStoreFailure: (value: boolean) => { rejectStores = value; },
    close: () => { store.close(); rmSync(dir, { recursive: true, force: true }); },
  };
}

await test('F1 repeated and concurrent starts create once and keep independent ownership', async () => {
  const f = fixture();
  try {
    await Promise.all([provisionWallet(f.store, f.a.token, f.gateway), provisionWallet(f.store, f.a.token, f.gateway)]);
    assert.equal(f.creates(), 1);
    assert.equal((await provisionWallet(f.store, f.a.token, f.gateway)).state, 'active');
    const original = f.store.binding(f.a.token);
    await provisionWallet(f.store, f.b.token, f.gateway);
    assert.equal(f.creates(), 2);
    assert.notEqual(original?.walletId, f.store.binding(f.b.token)?.walletId);
    assert.notEqual(original?.storeId, f.store.binding(f.b.token)?.storeId);
    assert.deepEqual(f.store.binding(f.a.token), original);
  } finally { f.close(); }
});

await test('F1 lost create response reconciles the exact stored identity without a second create', async () => {
  const f = fixture();
  try {
    f.setLoseResponse();
    await assert.rejects(provisionWallet(f.store, f.a.token, f.gateway), (error: unknown) => error instanceof AppError && error.code === 'UPSTREAM_TIMEOUT');
    assert.equal(f.store.binding(f.a.token)?.phase, 'creating');
    assert.equal((await provisionWallet(f.store, f.a.token, f.gateway)).state, 'active');
    assert.equal(f.creates(), 1);
  } finally { f.close(); }
});

await test('F1 ambiguous creation stays pending if no match is found, rather than reissuing creation', async () => {
  const f = fixture();
  try {
    f.store.allocateWallet(f.a.token);
    assert.equal(f.store.claimWalletCreation(f.a.token), true);
    assert.equal((await provisionWallet(f.store, f.a.token, f.gateway)).state, 'provisioning');
    assert.equal(f.creates(), 0);
  } finally { f.close(); }
});

await test('F1 a failure before wallet creation can retry the same allocation safely', async () => {
  const f = fixture();
  try {
    f.setStoreFailure(true);
    await assert.rejects(provisionWallet(f.store, f.a.token, f.gateway));
    const original = f.store.binding(f.a.token)?.storeId;
    assert.equal(f.creates(), 0);
    f.setStoreFailure(false);
    await provisionWallet(f.store, f.a.token, f.gateway);
    assert.equal(f.store.binding(f.a.token)?.storeId, original);
    assert.equal(f.creates(), 1);
  } finally { f.close(); }
});

await test('F1 binding persists across restart and cannot be discarded by metadata-only revoke', async () => {
  const f = fixture();
  let reopened: SessionStore | null = null;
  try {
    await provisionWallet(f.store, f.a.token, f.gateway);
    reopened = new SessionStore(f.config);
    assert.deepEqual(reopened.binding(f.a.token), f.store.binding(f.a.token));
    assert.equal((await provisionWallet(reopened, f.a.token, f.gateway)).state, 'active');
    assert.equal(f.creates(), 1);
    assert.throws(() => f.store.revoke(f.a.token), (error: unknown) => error instanceof AppError && error.code === 'RESET_UNAVAILABLE');
  } finally { reopened?.close(); f.close(); }
});

await test('F1 provisioning API rejects anonymous, foreign-ID and cross-origin mutations', async () => {
  const f = fixture();
  try {
    const handle = walletHandler(f.config, f.store, f.gateway);
    function request(body: string, cookie = `diw-session=${f.b.token}`, origin = f.config.origin) {
      return new Request(`${f.config.origin}/api/session/wallet`, { method: 'POST', headers: { origin, 'content-type': 'application/json', cookie }, body });
    }
    assert.equal((await handle(request('{}', ''))).status, 403);
    assert.equal((await handle(request('{"walletId":"foreign"}'))).status, 400);
    assert.equal((await handle(request('{}', undefined, 'https://foreign.example'))).status, 403);
    assert.equal(f.creates(), 0);
    const response = await handle(request('{}'));
    assert.equal(response.status, 200);
    assert.equal(f.store.binding(f.a.token), null);
    const raw = await response.text();
    assert.equal(raw.includes('wallet-'), false);
    assert.equal(raw.includes(f.b.token), false);
  } finally { f.close(); }
});
