import test from 'node:test';
import assert from 'node:assert/strict';
import intake from '@pgw/packages-contracts/dist/examples/intake.valid.v1.json' with { type: 'json' };
import { compileManifest, serializeManifestDeterministic } from './index.js';

test('compileManifest creates schema-compliant manifest', () => {
  const manifest = compileManifest(intake as any, '0.1.0');

  assert.equal(manifest.schemaVersion, '1.0.0');
  assert.equal(manifest.intake.productId, 'pilot-product-01');
  assert.equal(manifest.permissions.bucs.roles, 1);
  assert.equal(manifest.canonicalCoverage.coveragePercent, 100);
});

test('serializeManifestDeterministic returns identical output for same input', () => {
  const manifest = compileManifest(intake as any, '0.1.0');

  const one = serializeManifestDeterministic(manifest);
  const two = serializeManifestDeterministic(manifest);

  assert.equal(one, two);
  assert.match(one, /"artifactPlan"/);
});

