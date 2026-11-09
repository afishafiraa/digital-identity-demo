import assert from 'node:assert/strict';
import { test } from 'node:test';
import { AppError } from '../src/server/core/errors.ts';
import { serviceClient } from '../src/server/core/transport.ts';

function decode(value: unknown): { ok: true } {
  if (typeof value !== 'object' || value === null || !('ok' in value) || value.ok !== true) throw new Error('private schema detail');
  return { ok: true };
}
const config = { url: 'http://wallet.internal:7006', token: 'private-token' };

await test('transport keeps service credentials server-side and uses bounded non-retrying requests', async () => {
  let calls = 0;
  const client = serviceClient(config, async (input, options) => {
    calls++;
    assert.equal(String(input), 'http://wallet.internal:7006/wallet');
    assert.equal(options?.redirect, 'error');
    assert.equal(options?.cache, 'no-store');
    assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer private-token');
    assert.ok(options?.signal);
    return Response.json({ ok: true });
  });
  assert.deepEqual(await client({ path: '/wallet', method: 'POST', body: {}, decode }), { ok: true });
  assert.equal(calls, 1);
});

await test('transport refuses arbitrary URLs and path traversal before making a call', async () => {
  let calls = 0;
  const client = serviceClient(config, async () => { calls++; return Response.json({ ok: true }); });
  for (const path of ['https://attacker.example', '//attacker.example', '/..', '/%2e%2e/private', '/wallet?url=evil', '/\\evil']) {
    await assert.rejects(client({ path, decode }), (e: unknown) => e instanceof AppError && e.code === 'INVALID_REQUEST');
  }
  assert.equal(calls, 0);
});

await test('upstream status/body/schema failures never leak raw contents or report success', async () => {
  for (const response of [
    new Response('secret upstream error', { status: 500 }),
    new Response('private-token', { status: 302, headers: { Location: 'https://attacker.example' } }),
    new Response('<html>secret</html>'),
    new Response('{bad-json', { headers: { 'content-type': 'application/json' } }),
    Response.json({ password: 'secret' }),
    new Response('x'.repeat(1024 * 1024 + 1), { headers: { 'content-type': 'application/json' } }),
  ]) {
    const client = serviceClient(config, async () => response);
    await assert.rejects(client({ path: '/wallet', decode }), error => {
      assert.ok(error instanceof AppError);
      assert.ok(!error.message.includes('secret') && !error.message.includes('private-token'));
      return true;
    });
  }
});

await test('timeout is distinct from a verifier rejection and does not retry a mutation', async () => {
  let calls = 0;
  const client = serviceClient(config, async (_url, options) => {
    calls++;
    const signal = options?.signal;
    assert.ok(signal);
    // Keep one event-loop handle alive because AbortSignal.timeout itself is unref'd.
    return await new Promise<Response>((_resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('test timed out')), 1000);
      signal.addEventListener('abort', () => { clearTimeout(timer); reject(signal.reason); }, { once: true });
    });
  });
  await assert.rejects(client({ path: '/wallet', method: 'POST', body: {}, decode, timeoutMs: 5 }), (error: unknown) => error instanceof AppError && error.code === 'UPSTREAM_TIMEOUT' && error.status === 504);
  assert.equal(calls, 1);
});

await test('connection failures are service errors, without leaking connection details', async () => {
  const client = serviceClient(config, async () => { throw new TypeError('ECONNREFUSED private-token wallet.internal'); });
  await assert.rejects(client({ path: '/wallet', decode }), (error: unknown) => error instanceof AppError && error.code === 'SERVICE_UNAVAILABLE' && !error.message.includes('private-token') && !error.message.includes('wallet.internal'));
});
