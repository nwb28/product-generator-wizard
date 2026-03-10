import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSignoffRecord, isReviewerChecklistComplete } from './reviewer.js';

test('isReviewerChecklistComplete returns true when all checks are true', () => {
  assert.equal(
    isReviewerChecklistComplete({
      permissionsVerified: true,
      mappingsVerified: true,
      securityEvidenceVerified: true,
      testsVerified: true
    }),
    true
  );
});

test('buildSignoffRecord trims reviewer and computes completion state', () => {
  const record = buildSignoffRecord({
    reviewer: '  reviewer-a ',
    checklist: {
      permissionsVerified: true,
      mappingsVerified: true,
      securityEvidenceVerified: false,
      testsVerified: true
    },
    recommendation: 'No-Go'
  });

  assert.equal(record.reviewer, 'reviewer-a');
  assert.equal(record.completed, false);
  assert.equal(record.recommendation, 'No-Go');
});
