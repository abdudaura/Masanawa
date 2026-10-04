import test from 'node:test';
import assert from 'node:assert/strict';
import { selectAlphaGeminiCredentials } from './alpha-credential-selection.mjs';
test('explicit selection pins one credential without modifying the imported pool', () => {
  const keys = ['first', 'second'];
  assert.deepEqual(selectAlphaGeminiCredentials(keys, '0'), ['first']);
  assert.deepEqual(keys, ['first', 'second']);
  assert.deepEqual(selectAlphaGeminiCredentials(keys), keys);
  assert.equal(Object.isFrozen(selectAlphaGeminiCredentials(keys, '1')), true);
});
test('invalid operator selections fail without disclosing credentials', () => {
  for (const index of ['2', '-1', '0.0', 'private-value', '01', '999999999999999999999']) {
    assert.throws(() => selectAlphaGeminiCredentials(['private-key'], index), { message: 'Invalid Alpha active credential index' });
  }
});
