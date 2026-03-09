import test from 'node:test';
import assert from 'node:assert/strict';
import intake from '@pgw/packages-contracts/dist/examples/intake.valid.v1.json' with { type: 'json' };
import { toHumanSummary, validateIntake } from './index.js';

test('validateIntake returns valid for baseline intake', () => {
  const result = validateIntake(intake);
  assert.equal(result.valid, true);
  assert.equal(result.diagnostics.length, 0);
});

test('validateIntake returns blocking diagnostics for schema and domain failures', () => {
  const broken = structuredClone(intake) as any;
  delete broken.product.name;
  broken.permissions.bucs = [];

  const result = validateIntake(broken);

  assert.equal(result.valid, false);
  assert.ok(result.diagnostics.some((x) => x.code === 'SCHEMA_INVALID'));
  assert.ok(result.diagnostics.some((x) => x.code === 'MISSING_ROLE_PERMISSION_DECLARATIONS'));
});

test('validateIntake returns warnings for low confidence mappings', () => {
  const lowConfidence = structuredClone(intake) as any;
  lowConfidence.canonicalModel.mappings[0].confidence = 0.4;

  const result = validateIntake(lowConfidence);
  assert.ok(result.diagnostics.some((x) => x.code === 'LOW_CONFIDENCE_MAPPING_HINT' && x.severity === 'warning'));
});

test('toHumanSummary renders a readable output', () => {
  const result = validateIntake(intake);
  const summary = toHumanSummary(result);

  assert.match(summary, /Blocking: 0, Warnings: 0/);
});
