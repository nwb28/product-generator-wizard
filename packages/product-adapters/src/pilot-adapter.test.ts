import test from 'node:test';
import assert from 'node:assert/strict';
import type { BuiltProductAdapterInput } from './index.js';
import { createPilotLoanAdapter, PILOT_ADAPTER_ID, PILOT_ADAPTER_VERSION } from './pilot-adapter.js';

const baselineInput: BuiltProductAdapterInput = {
  adapterId: PILOT_ADAPTER_ID,
  adapterVersion: PILOT_ADAPTER_VERSION,
  tenantId: 'tenant-a',
  productId: 'loan-product',
  metadata: {
    productType: 'loan',
    displayName: 'Loan Product',
    uiScreens: [
      { id: 'summary', title: 'Summary' },
      { id: 'details', title: 'Details' }
    ],
    excelCapabilities: ['refresh'],
    workforceCapabilities: ['submit'],
    canonicalMappings: [{ canonicalModel: 'loan', confidence: 0.95 }]
  }
};

test('pilot adapter supports loan products', () => {
  const adapter = createPilotLoanAdapter();
  assert.equal(adapter.id, PILOT_ADAPTER_ID);
  assert.equal(adapter.version, PILOT_ADAPTER_VERSION);
  assert.equal(adapter.supports(baselineInput), true);
});

test('pilot adapter transform produces deterministic sorted preview views', () => {
  const adapter = createPilotLoanAdapter();
  const output = adapter.transform(baselineInput);
  const previewSession = output.previewSession as {
    views: Array<{ id: string }>;
    generatedArtifacts: Array<{ path: string; hash: string }>;
  };
  assert.equal(output.compatibility.blocking, 0);
  assert.equal(output.compatibility.warning, 0);
  assert.deepEqual(
    previewSession.views.map((entry) => entry.id),
    ['details', 'summary']
  );
  assert.equal(previewSession.generatedArtifacts.length, 2);
});

test('pilot adapter emits warnings and blockers for incomplete metadata', () => {
  const adapter = createPilotLoanAdapter();
  const output = adapter.transform({
    ...baselineInput,
    metadata: {
      productType: 'loan',
      canonicalMappings: [{ canonicalModel: 'loan', confidence: 0.6 }]
    }
  });

  assert.equal(output.compatibility.blocking, 2);
  assert.equal(output.compatibility.warning, 3);
  const codes = output.diagnostics.map((entry) => entry.code).sort();
  assert.deepEqual(codes, [
    'PILOT_DISPLAY_NAME_MISSING',
    'PILOT_EXCEL_CAPABILITIES_EMPTY',
    'PILOT_LOW_CONFIDENCE_MAPPING',
    'PILOT_UI_SCREENS_MISSING',
    'PILOT_WORKFORCE_CAPABILITIES_EMPTY'
  ]);
});
