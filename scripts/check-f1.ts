import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { writeFileSync, mkdirSync } from 'node:fs';
import { readConfig } from '../src/server/core/config.ts';
import { AppError } from '../src/server/core/errors.ts';
import { SessionStore } from '../src/server/core/session.ts';
import { serviceClient } from '../src/server/core/transport.ts';
import { walletGateway } from '../src/server/core/wallet-gateway.ts';
import { provisionWallet } from '../src/server/core/wallet-session.ts';
import { issueTrainingFixture, nonempty, list } from '../pocs/walt-fixture.ts';

const config = readConfig();
const store = new SessionStore(config);
const wallet = serviceClient({ url: 'http://127.0.0.1:7006' });
async function request(method: string, path: string, cookie?: string, body = '{}', origin = config.origin): Promise<Response> {
  return fetch(`${config.origin}${path}`, {
    method, headers: { origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}) },
    ...(method === 'GET' ? {} : { body }), signal: AbortSignal.timeout(15000), redirect: 'error',
  });
}
async function start() {
  const response = await request('POST', '/api/session');
  assert.equal(response.status, 201);
  const [cookie] = nonempty(response.headers.get('set-cookie')).split(';');
  assert.ok(cookie);
  const token = cookie.slice(cookie.indexOf('=') + 1);
  assert.equal((await request('POST', '/api/session/wallet', cookie)).status, 200);
  const binding = store.binding(token);
  assert.ok(binding?.walletId);
  return { cookie, token, walletId: binding.walletId };
}
const checks: Record<string, boolean> = {};
try {
  const a = await start();
  const b = await start();
  assert.notEqual(a.walletId, b.walletId);
  assert.equal((await wallet({ path: `/wallet/${a.walletId}/credentials`, decode: list })).length, 0);
  checks['F1-AC01'] = true;
  const fixture = await issueTrainingFixture(a.walletId);
  assert.equal(fixture.length, 1);
  const credentialsBefore = await wallet({ path: `/wallet/${a.walletId}/credentials`, decode: list });
  assert.equal((await request('GET', '/api/session', a.cookie)).status, 200);
  assert.equal((await request('POST', '/api/session', a.cookie)).status, 200);
  assert.equal((await request('POST', '/api/session/wallet', a.cookie)).status, 200);
  assert.equal(store.binding(a.token)?.walletId, a.walletId);
  assert.deepEqual(await wallet({ path: `/wallet/${a.walletId}/credentials`, decode: list }), credentialsBefore);
  checks['F1-AC02'] = true;
  assert.equal((await request('POST', '/api/session/wallet', b.cookie, JSON.stringify({ walletId: a.walletId }))).status, 400);
  assert.equal((await request('POST', '/api/session/wallet', undefined)).status, 403);
  assert.equal((await request('POST', '/api/session/wallet', a.cookie, '{}', 'https://other.example')).status, 403);
  assert.equal(store.binding(b.token)?.walletId, b.walletId);
  const snapshot: unknown = await (await request('GET', '/api/session', b.cookie)).json();
  assert.equal(JSON.stringify(snapshot).includes(a.walletId), false);
  checks['F1-AC03'] = true;

  const interrupted = store.start(null);
  const service = config.services.wallet;
  assert.ok(service);
  const gateway = walletGateway(service, AbortSignal.timeout(12000));
  let creates = 0;
  await assert.rejects(provisionWallet(store, interrupted.token, {
    ...gateway,
    async create(id) { creates++; await gateway.create(id); throw new AppError('UPSTREAM_TIMEOUT', 504); },
  }));
  assert.equal(store.binding(interrupted.token)?.phase, 'creating');
  assert.equal((await provisionWallet(store, interrupted.token, gateway)).state, 'active');
  assert.equal(creates, 1);
  checks['F1-AC04'] = true;

  const restart = spawnSync('docker', ['compose', 'restart', 'wallet'], { stdio: 'ignore', timeout: 30000 });
  assert.equal(restart.status, 0);
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      await wallet({ path: '/wallet', decode: list, timeoutMs: 1000 });
      ready = true; break;
    } catch { await delay(500); }
  }
  assert.ok(ready);
  assert.equal((await request('POST', '/api/session/wallet', a.cookie)).status, 200);
  assert.equal(store.binding(a.token)?.walletId, a.walletId);
  assert.deepEqual(await wallet({ path: `/wallet/${a.walletId}/credentials`, decode: list }), credentialsBefore);
  checks['wallet-restart-persistence'] = true;
  const reopened = new SessionStore(config);
  try { assert.equal(reopened.binding(a.token)?.walletId, a.walletId); }
  finally { reopened.close(); }
  checks['coordination-reopen-persistence'] = true;
  mkdirSync('.local/evidence', { recursive: true, mode: 0o700 });
  writeFileSync('.local/evidence/f1.json', JSON.stringify({ checkedAt: new Date().toISOString(), checks, fixtureCredentialCount: fixture.length }, null, 2), { mode: 0o600 });
  console.log('PASS: F1 live API, stored credential resume, isolation, interrupted-create reconciliation, and restart persistence.');
} catch (error) {
  console.error(error instanceof AppError ? error.message : error instanceof Error ? error.message : 'F1 verification failed');
  process.exitCode = 1;
} finally { store.close(); }
