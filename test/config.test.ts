import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readConfig } from '../src/server/core/config.ts';

await test('development defaults stay on loopback and contain no service credentials', () => {
  const config = readConfig({});
  assert.equal(config.origin, 'http://localhost:47831');
  assert.deepEqual(config.services, {});
  assert.equal(config.sessionTtlSeconds, 86400);
});

await test('production rejects missing or insecure application origins', () => {
  for (const APP_ORIGIN of [undefined, 'http://wallet.example', 'http://localhost:47831']) {
    assert.throws(() => readConfig({ NODE_ENV: 'production', APP_ORIGIN }));
  }
  assert.equal(readConfig({ NODE_ENV: 'production', APP_ORIGIN: 'https://wallet.example' }).origin, 'https://wallet.example');
});

await test('configuration rejects unsafe URLs, tokens, and unbounded settings without echoing values', () => {
  for (const env of [
    { APP_ORIGIN: 'http://elsewhere.example' },
    { APP_ORIGIN: 'https://wallet.example/path' },
    { WALT_WALLET_URL: 'https://user:supersecret@wallet.example' },
    { WALT_ISSUER_URL: 'file:///etc/passwd' },
    { WALT_ISSUER_URL: 'https://issuer.example?token=supersecret' },
    { WALT_VERIFIER_URL: 'https://verifier.example/private' },
    { WALT_WALLET_TOKEN: 'supersecret' },
    { WALT_WALLET_URL: 'http://localhost:7006', WALT_WALLET_TOKEN: 'supersecret\r\nInjected: true' },
    { SESSION_TTL_SECONDS: '0' }, { SESSION_TTL_SECONDS: 'Infinity' },
    { MAX_ACTIVE_SESSIONS: '9999999' },
  ]) {
    assert.throws(() => readConfig(env), error => error instanceof Error && !error.message.includes('supersecret'));
  }
});
