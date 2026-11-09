import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readConfig } from '../src/server/core/config.ts';
import { SessionStore } from '../src/server/core/session.ts';
import { sessionHandler } from '../src/server/core/session-handler.ts';
import { errorResponse } from '../src/server/core/errors.ts';

import { isRecord } from '../src/server/core/validation.ts';

function cookiePair(response: Response): string {
  const header = response.headers.get('set-cookie');
  assert.ok(header);
  const [pair] = header.split(';');
  assert.ok(pair);
  return pair;
}

function decodePayload(value: unknown): { session: { expiresAt: string } | null; wallet: null } {
  assert.ok(isRecord(value));
  assert.equal(value['wallet'], null);
  const session = value['session'];
  if (session === null) return { session: null, wallet: null };
  assert.ok(isRecord(session));
  const expiresAt = session['expiresAt'];
  assert.equal(typeof expiresAt, 'string');
  assert.ok(typeof expiresAt === 'string');
  return { session: { expiresAt }, wallet: null };
}

async function readPayload(response: Response) {
  const value: unknown = await response.json();
  return decodePayload(value);
}

function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'diw-api-test-'));
  const config = readConfig({ DEMO_DATA_DIR: dir });
  const store = new SessionStore(config);
  const handle = sessionHandler(config, store);
  function request(method = 'POST', cookie?: string, body = '{}', headers: Record<string, string> = {}) {
    return new Request(`${config.origin}/api/session`, {
      method, headers: { origin: config.origin, 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...headers },
      ...(method === 'GET' ? {} : { body }),
    });
  }
  return { config, store, handle, request, close: () => { store.close(); rmSync(dir, { recursive: true, force: true }); } };
}

await test('API creates/resumes metadata without claiming a real wallet and never exposes the token in JSON', async () => {
  const f = setup();
  try {
    const initial = await f.handle(f.request('GET'));
    assert.equal(initial.status, 200);
    assert.equal((await readPayload(initial)).session, null);
    assert.equal(initial.headers.get('set-cookie'), null);
    const a = await f.handle(f.request());
    assert.equal(a.status, 201);
    const cookie = cookiePair(a);
    const payload = await a.text();
    const parsed: unknown = JSON.parse(payload);
    const original = decodePayload(parsed);
    assert.equal(original.wallet, null);
    const token = cookie.split('=')[1];
    assert.ok(token);
    assert.ok(!payload.includes(token));
    assert.equal(a.headers.get('cache-control'), 'no-store, private');
    const resumed = await f.handle(f.request('POST', cookie));
    assert.equal(resumed.status, 200);
    assert.equal(resumed.headers.get('set-cookie'), null);
    const current = await readPayload(resumed);
    assert.ok(current.session && original.session);
    assert.equal(current.session.expiresAt, original.session.expiresAt);
  } finally { f.close(); }
});

await test('origin, content-type, unexpected IDs, malformed JSON and oversized bodies fail closed', async () => {
  const f = setup();
  try {
    const checks: Array<[Request, number]> = [
      [f.request('POST', undefined, '{}', { origin: 'https://attacker.example' }), 403],
      [f.request('POST', undefined, '{}', { origin: '' }), 403],
      [f.request('POST', undefined, '{}', { 'sec-fetch-site': 'cross-site' }), 403],
      [f.request('POST', undefined, '{}', { 'content-type': 'text/plain' }), 415],
      [f.request('POST', undefined, '{"walletId":"foreign"}'), 400],
      [f.request('POST', undefined, '{'), 400],
      [f.request('POST', undefined, '[]'), 400],
      [f.request('POST', undefined, 'x'.repeat(257)), 413],
    ];
    for (const [req, status] of checks) assert.equal((await f.handle(req)).status, status);
  } finally { f.close(); }
});

await test('revoke affects only the cookie owner and does not authorize a foreign ID', async () => {
  const f = setup();
  try {
    const a = await f.handle(f.request()); const b = await f.handle(f.request());
    const cookieA = cookiePair(a);
    const cookieB = cookiePair(b);
    const deleted = await f.handle(f.request('DELETE', cookieA));
    assert.equal(deleted.status, 200);
    assert.ok(deleted.headers.get('set-cookie')?.includes('Max-Age=0'));
    assert.equal((await readPayload(await f.handle(f.request('GET', cookieA)))).session, null);
    assert.notEqual((await readPayload(await f.handle(f.request('GET', cookieB)))).session, null);
  } finally { f.close(); }
});

await test('unexpected errors redact secrets and stack traces', async () => {
  const response = errorResponse(new Error('password=secret-token at http://internal-service'));
  assert.equal(response.status, 500);
  const body = await response.text();
  for (const secret of ['password', 'secret-token', 'internal-service', 'stack']) assert.ok(!body.includes(secret));
});

await test('GET distinguishes a missing session from expired metadata without creating or replacing one', async () => {
  const f = setup();
  try {
    const missing: unknown = await (await f.handle(f.request('GET'))).json();
    assert.ok(isRecord(missing));
    assert.equal(missing['state'], 'not-started');
    const expired = f.store.start(null, Date.now() - f.config.sessionTtlSeconds * 1000 - 1000);
    const cookie = `diw-session=${expired.token}`;
    const response = await f.handle(f.request('GET', cookie));
    const payload: unknown = await response.json();
    assert.ok(isRecord(payload));
    assert.equal(payload['state'], 'expired');
    assert.equal(payload['session'], null);
    assert.equal(response.headers.get('set-cookie'), null);
    const retry = await f.handle(f.request('POST', cookie));
    assert.equal(retry.status, 409);
    assert.equal(retry.headers.get('set-cookie'), null);
    assert.equal(f.store.get(expired.token), null);
  } finally { f.close(); }
});

await test('invalid, duplicate, and unknown cookies cannot silently create fresh metadata', async () => {
  const f = setup();
  try {
    const owner = await f.handle(f.request());
    const cookie = cookiePair(owner);
    for (const candidate of ['diw-session=bad', `${cookie}; ${cookie}`, `diw-session=${'a'.repeat(43)}`]) {
      const response = await f.handle(f.request('POST', candidate));
      assert.equal(response.status, 409);
      assert.equal(response.headers.get('set-cookie'), null);
      const payload: unknown = await response.json();
      assert.ok(isRecord(payload));
      const error = payload['error'];
      assert.ok(isRecord(error));
      assert.equal(error['code'], 'SESSION_EXPIRED');
    }
    assert.notEqual((await readPayload(await f.handle(f.request('GET', cookie)))).session, null);
  } finally { f.close(); }
});
