import assert from 'node:assert/strict';
import test from 'node:test';
import { checkRequiredContexts } from './check-branch-protection.mjs';

test('checkRequiredContexts passes when all contexts are present', () => {
  const result = checkRequiredContexts(
    {
      required_status_checks: {
        checks: [
          { context: 'bootstrap' },
          { context: 'contract-gate' },
          { context: 'preview-contract-gate' },
          { context: 'security-scan' },
          { context: 'release-evidence-bundle' }
        ]
      }
    },
    ['bootstrap', 'contract-gate', 'preview-contract-gate', 'security-scan', 'release-evidence-bundle']
  );

  assert.equal(result.valid, true);
  assert.deepEqual(result.missing, []);
});

test('checkRequiredContexts reports missing contexts', () => {
  const result = checkRequiredContexts(
    {
      required_status_checks: {
        checks: [
          { context: 'bootstrap' },
          { context: 'contract-gate' }
        ]
      }
    },
    ['bootstrap', 'contract-gate', 'preview-contract-gate']
  );

  assert.equal(result.valid, false);
  assert.deepEqual(result.missing, ['preview-contract-gate']);
});
