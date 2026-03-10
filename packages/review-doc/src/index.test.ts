import test from 'node:test';
import assert from 'node:assert/strict';
import intake from '@pgw/packages-contracts/dist/examples/intake.valid.v1.json' with { type: 'json' };
import { validateIntake } from '@pgw/packages-validator/dist/index.js';
import { generateHumanReviewDocument, generatePreInclusionReviewDocument } from './index.js';

test('generateHumanReviewDocument returns Go with score 100 for clean intake', () => {
  const validation = validateIntake(intake);
  const doc = generateHumanReviewDocument(intake as any, validation);

  assert.equal(doc.recommendation, 'Go');
  assert.equal(doc.readinessScore, 100);
  assert.match(doc.markdown, /## Intake Summary/);
});

test('generateHumanReviewDocument returns No-Go when blocking issues exist', () => {
  const invalid = structuredClone(intake) as any;
  invalid.permissions.bucs = [];
  const validation = validateIntake(invalid);
  const doc = generateHumanReviewDocument(invalid, validation);

  assert.equal(doc.recommendation, 'No-Go');
  assert.match(doc.markdown, /Recommendation: No-Go/);
});

test('readiness score deducts by warning category', () => {
  const warningPayload = structuredClone(intake) as any;
  warningPayload.canonicalModel.mappings[0].confidence = 0.5;
  const validation = validateIntake(warningPayload);
  const doc = generateHumanReviewDocument(warningPayload, validation);

  assert.equal(doc.readinessScore, 95);
});

test('generatePreInclusionReviewDocument renders go/no-go summary template', () => {
  const doc = generatePreInclusionReviewDocument({
    adapter: { id: 'pilot-loan-adapter', version: '1.0.0' },
    summary: { blocking: 0, warning: 2 },
    readinessScore: 90,
    recommendation: 'Go',
    permissionMatrix: {
      bucs: { roles: 1, permissions: 1 },
      firm: { roles: 1, permissions: 2 },
      company: { roles: 1, permissions: 3 }
    },
    mappingCoverage: { coveragePercent: 100, uniqueCanonicalModels: 2, lowConfidenceCount: 0 },
    diagnostics: []
  });

  assert.equal(doc.recommendation, 'Go');
  assert.equal(doc.readinessScore, 90);
  assert.match(doc.markdown, /Pre-Inclusion Review Document/);
  assert.match(doc.markdown, /Recommendation: Go/);
});
