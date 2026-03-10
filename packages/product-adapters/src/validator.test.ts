import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductAdapterRegistry } from './index.js';
import { createPilotLoanAdapter } from './pilot-adapter.js';
import { validateBuiltProductIntake, validateBuiltProductWithRegistry } from './validator.js';

const validPayload = {
  schemaVersion: '1.0.0',
  adapter: { id: 'pilot-loan-adapter', version: '1.0.0' },
  tenant: { id: 'tenant-a' },
  product: { id: 'product-a', type: 'loan', displayName: 'Loan A' },
  integrations: {
    workforce: { enabled: true, details: { profile: 'default' } },
    excelPlugin: { enabled: true, details: { mode: 'refresh' } }
  },
  permissions: {
    bucs: [{ role: 'reader', permissions: ['read'] }],
    firm: [{ role: 'writer', permissions: ['read', 'write'] }],
    company: [{ role: 'admin', permissions: ['read', 'write', 'approve'] }]
  },
  mappings: [{ canonicalModel: 'loan', sourcePath: '$.loan', confidence: 0.95 }]
};

test('validateBuiltProductIntake returns valid for complete payload', () => {
  const result = validateBuiltProductIntake(validPayload);
  assert.equal(result.valid, true);
  assert.equal(result.summary.blocking, 0);
  assert.equal(result.summary.warning, 0);
});

test('validateBuiltProductIntake returns blocking diagnostics for missing required sections', () => {
  const result = validateBuiltProductIntake({ schemaVersion: '1.0.0' });
  assert.equal(result.valid, false);
  assert.ok(result.summary.blocking >= 7);
  assert.ok(result.diagnostics.some((entry) => entry.code === 'ADAPTER_ID_MISSING'));
  assert.ok(result.diagnostics.some((entry) => entry.code === 'MAPPINGS_MISSING'));
});

test('validateBuiltProductIntake returns warnings for low confidence and incomplete enabled integrations', () => {
  const result = validateBuiltProductIntake({
    ...validPayload,
    integrations: {
      workforce: { enabled: true },
      excelPlugin: { enabled: true }
    },
    mappings: [{ canonicalModel: 'loan', sourcePath: '$.loan', confidence: 0.6 }]
  });

  assert.equal(result.summary.blocking, 0);
  assert.equal(result.summary.warning, 3);
  assert.ok(result.diagnostics.some((entry) => entry.code === 'WORKFORCE_DETAILS_MISSING'));
  assert.ok(result.diagnostics.some((entry) => entry.code === 'EXCEL_DETAILS_MISSING'));
  assert.ok(result.diagnostics.some((entry) => entry.code === 'MAPPINGS_LOW_CONFIDENCE'));
});

test('validateBuiltProductWithRegistry returns blocking when adapter cannot resolve', () => {
  const registry = createProductAdapterRegistry([]);
  const result = validateBuiltProductWithRegistry(validPayload, registry);
  assert.equal(result.valid, false);
  assert.ok(result.diagnostics.some((entry) => entry.code === 'ADAPTER_NOT_RESOLVABLE'));
});

test('validateBuiltProductWithRegistry returns valid for resolvable adapter', () => {
  const registry = createProductAdapterRegistry([createPilotLoanAdapter()]);
  const result = validateBuiltProductWithRegistry(validPayload, registry);
  assert.equal(result.valid, true);
  assert.equal(result.summary.blocking, 0);
});
