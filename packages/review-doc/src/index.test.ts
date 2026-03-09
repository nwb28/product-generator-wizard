import test from 'node:test';
import assert from 'node:assert/strict';
import intake from '@pgw/packages-contracts/dist/examples/intake.valid.v1.json' with { type: 'json' };
import { validateIntake } from '@pgw/packages-validator/dist/index.js';
import { generateHumanReviewDocument } from './index.js';

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
