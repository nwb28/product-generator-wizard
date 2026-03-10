import assert from 'node:assert/strict';
import test from 'node:test';
import { validateConfig } from './apply-environment-protection.mjs';

test('validateConfig accepts valid configuration', () => {
  assert.doesNotThrow(() =>
    validateConfig({
      environment: 'governance-remediation',
      reviewers: [{ type: 'User', login: 'nwb28' }]
    })
  );
});

test('validateConfig rejects missing reviewers', () => {
  assert.throws(() => validateConfig({ environment: 'x', reviewers: [] }), /at least one reviewer/);
});
