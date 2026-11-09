import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BodyLimitError, readBytes } from '../src/server/core/body.ts';
import { requireMutation } from '../src/server/core/request.ts';
import { AppError } from '../src/server/core/errors.ts';

await test('stream limit counts actual chunks rather than trusting Content-Length', async () => {
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { controller.enqueue(new Uint8Array(200)); controller.enqueue(new Uint8Array(100)); },
    cancel() { cancelled = true; },
  });
  await assert.rejects(readBytes(stream, 256, AbortSignal.timeout(1000)), BodyLimitError);
  assert.equal(cancelled, true);
});

await test('a stalled incoming body is cancelled at its deadline', async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
  const init: RequestInit & { duplex: 'half' } = {
    method: 'POST', headers: { origin: 'http://127.0.0.1:47831', 'content-type': 'application/json' },
    body, duplex: 'half',
  };
  const request = new Request('http://127.0.0.1:47831/api/session', init);
  const hold = setTimeout(() => {}, 1000);
  try {
    await assert.rejects(requireMutation(request, 'http://127.0.0.1:47831', 5), (error: unknown) => error instanceof AppError && error.status === 408);
    assert.equal(cancelled, true);
  } finally { clearTimeout(hold); }
});
