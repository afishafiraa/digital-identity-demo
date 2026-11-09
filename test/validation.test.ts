import assert from 'node:assert/strict';
import { test } from 'node:test';
import { integerColumn } from '../src/server/core/validation.ts';

await test('database integer decoding rejects invalid runtime shapes rather than trusting assertions', () => {
  assert.equal(integerColumn({ count: 0 }, 'count'), 0);
  assert.equal(integerColumn({ expires_at: 123456 }, 'expires_at'), 123456);
  for (const row of [null, [], {}, { count: '1' }, { count: -1 }, { count: 1.5 }, { count: Number.NaN }, { count: Number.MAX_SAFE_INTEGER + 1 }]) {
    assert.throws(() => integerColumn(row, 'count'));
  }
});
