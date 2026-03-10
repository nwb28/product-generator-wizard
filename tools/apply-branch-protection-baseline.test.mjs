import assert from 'node:assert/strict';
import test from 'node:test';
import { validateBaselinePayload } from './apply-branch-protection-baseline.mjs';

test('validateBaselinePayload accepts valid baseline', () => {
  assert.doesNotThrow(() =>
    validateBaselinePayload({
      required_status_checks: { checks: [{ context: 'bootstrap' }] },
      required_pull_request_reviews: { require_code_owner_reviews: true }
    })
  );
});

test('validateBaselinePayload rejects missing checks', () => {
  assert.throws(
    () =>
      validateBaselinePayload({
        required_status_checks: { checks: [] },
        required_pull_request_reviews: { require_code_owner_reviews: true }
      }),
    /required_status_checks.checks/
  );
});
