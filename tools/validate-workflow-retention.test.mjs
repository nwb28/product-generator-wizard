import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveExpectedRetention } from './validate-workflow-retention.mjs';

test('resolveExpectedRetention matches wildcard rule', () => {
  const policy = {
    defaults: { retentionDays: 30 },
    rules: [
      { workflow: 'security-scan.yml', artifact: 'npm-audit-report-*', retentionDays: 14 }
    ]
  };

  const expected = resolveExpectedRetention(policy, 'security-scan.yml', 'npm-audit-report-42');
  assert.equal(expected, 14);
});

test('resolveExpectedRetention falls back to default', () => {
  const policy = {
    defaults: { retentionDays: 30 },
    rules: []
  };

  const expected = resolveExpectedRetention(policy, 'unknown.yml', 'artifact-any');
  assert.equal(expected, 30);
});
