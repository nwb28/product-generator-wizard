import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCanonicalMappingCoverage } from './mapping-coverage.js';

test('analyzeCanonicalMappingCoverage reports full coverage for unique complete mappings', () => {
  const result = analyzeCanonicalMappingCoverage([
    { canonicalModel: 'loan', confidence: 0.95 },
    { canonicalModel: 'collateral', confidence: 0.9 }
  ]);

  assert.equal(result.coveragePercent, 100);
  assert.equal(result.uniqueCanonicalModels, 2);
  assert.equal(result.lowConfidenceCount, 0);
});

test('analyzeCanonicalMappingCoverage reports low confidence diagnostics', () => {
  const result = analyzeCanonicalMappingCoverage([
    { canonicalModel: 'loan', confidence: 0.95 },
    { canonicalModel: 'loan', confidence: 0.6 }
  ]);

  assert.equal(result.lowConfidenceCount, 1);
  assert.ok(result.diagnostics.some((entry) => entry.code === 'CANONICAL_MAPPING_LOW_CONFIDENCE'));
});
