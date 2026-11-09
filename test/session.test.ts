import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { readConfig } from '../src/server/core/config.ts';
import { SessionStore, cookieName, readSessionCookie, sessionCookie } from '../src/server/core/session.ts';
import { AppError } from '../src/server/core/errors.ts';

function fixture(limit = '100') {
  const dataDir = mkdtempSync(join(tmpdir(), 'diw-session-test-'));
  const config = readConfig({ DEMO_DATA_DIR: dataDir, MAX_ACTIVE_SESSIONS: limit, SESSION_TTL_SECONDS: '300' });
  return { config, dataDir, clean: () => rmSync(dataDir, { recursive: true, force: true }) };
}

await test('metadata session persists after restart and stores a hash, never its bearer token', () => {
  const { config, dataDir, clean } = fixture();
  let store = new SessionStore(config);
  try {
    const first = store.start(null);
    const resumed = store.start(first.token);
    assert.equal(resumed.created, false);
    assert.equal(resumed.token, first.token);
    assert.deepEqual(resumed.session, first.session);
    store.close();
    store = new SessionStore(config);
    assert.deepEqual(store.get(first.token), first.session);
    assert.equal(statSync(dataDir).mode & 0o777, 0o700);
    for (const file of readdirSync(dataDir)) {
      assert.equal(readFileSync(join(dataDir, file)).includes(Buffer.from(first.token)), false);
    }
    assert.equal(statSync(join(dataDir, 'coordination.sqlite')).mode & 0o777, 0o600);
  } finally { store.close(); clean(); }
});

await test('revoking one session cannot delete another and invalid tokens never resolve', () => {
  const { config, clean } = fixture();
  const store = new SessionStore(config);
  try {
    const a = store.start(null); const b = store.start(null);
    assert.notEqual(a.token, b.token);
    store.revoke(a.token);
    assert.equal(store.get(a.token), null);
    assert.deepEqual(store.get(b.token), b.session);
    assert.equal(store.get("' OR 1=1 --"), null);
    assert.equal(store.get('a'.repeat(43)), null);
  } finally { store.close(); clean(); }
});

await test('expiry is absolute and capacity prevents unlimited live metadata sessions', () => {
  const { config, clean } = fixture('1');
  const store = new SessionStore(config);
  try {
    const a = store.start(null, 1000);
    assert.equal(store.start(a.token, 2000).session.expiresAt, a.session.expiresAt);
    assert.throws(() => store.start(null, 2000), (e: unknown) => e instanceof AppError && e.code === 'SESSION_LIMIT');
    assert.equal(store.get(a.token, 301001), null);
    const b = store.start(null, 301001);
    assert.notEqual(b.token, a.token);
    assert.equal(store.get(a.token, 301001), null);
  } finally { store.close(); clean(); }
});

await test('cookie has secure attributes, host prefix on HTTPS, and rejects duplicate identities', () => {
  const config = readConfig({ APP_ORIGIN: 'https://wallet.example' });
  const token = 'a'.repeat(43);
  assert.equal(cookieName(config.origin), '__Host-diw-session');
  const cookie = sessionCookie(token, config);
  for (const part of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/', 'Max-Age=86400']) assert.ok(cookie.includes(part));
  assert.ok(!cookie.includes('Domain='));
  assert.deepEqual(readSessionCookie(new Request(config.origin, { headers: { cookie } }), config), { state: 'present', token });
  assert.deepEqual(readSessionCookie(new Request(config.origin, { headers: { cookie: `${cookie}; __Host-diw-session=${token}` } }), config), { state: 'invalid' });
  assert.deepEqual(readSessionCookie(new Request(config.origin, { headers: { cookie: '__Host-diw-session=bad' } }), config), { state: 'invalid' });
});

await test('a stale identity cannot silently create replacement metadata', () => {
  const { config, clean } = fixture('1');
  const store = new SessionStore(config);
  try {
    const original = store.start(null, 1000);
    assert.throws(() => store.start(original.token, 301001), (error: unknown) => error instanceof AppError && error.code === 'SESSION_EXPIRED');
    // No replacement occupied the capacity slot; an explicit fresh start is still possible.
    assert.equal(store.start(null, 301001).created, true);
  } finally { store.close(); clean(); }
});

await test('two store handles resume one identity without silently consuming extra session capacity', () => {
  const { config, clean } = fixture('1');
  const first = new SessionStore(config);
  const second = new SessionStore(config);
  try {
    const original = first.start(null);
    const resumed = second.start(original.token);
    assert.equal(resumed.created, false);
    assert.equal(resumed.token, original.token);
    assert.deepEqual(first.get(original.token), second.get(original.token));
    assert.throws(() => second.start(null), (error: unknown) => error instanceof AppError && error.code === 'SESSION_LIMIT');
  } finally { first.close(); second.close(); clean(); }
});
