import test from 'node:test';
import assert from 'node:assert/strict';
import type { BuiltProductAdapterInput, ProductAdapter } from './index.js';
import {
  adaptersIndex,
  builtProductIntakeSchema,
  compatibilityReportSchema,
  createProductAdapterRegistry,
  previewSessionSchema
} from './index.js';

const baselineInput: BuiltProductAdapterInput = {
  adapterId: 'pilot-adapter',
  adapterVersion: '1.0.0',
  tenantId: 'tenant-a',
  productId: 'product-a',
  metadata: { productType: 'loan' }
};

function createAdapter(): ProductAdapter {
  return {
    id: 'pilot-adapter',
    version: '1.0.0',
    supports(input) {
      return input.metadata.productType === 'loan';
    },
    transform() {
      return {
        compatibility: { blocking: 0, warning: 0 },
        diagnostics: [],
        previewSession: { mode: 'baseline' }
      };
    }
  };
}

test('registry resolves seeded adapter for supported input', () => {
  const registry = createProductAdapterRegistry([createAdapter()]);
  const resolved = registry.resolve(baselineInput);
  assert.equal(resolved.id, 'pilot-adapter');
  assert.equal(resolved.version, '1.0.0');
});

test('registry rejects duplicate adapter registration', () => {
  const registry = createProductAdapterRegistry([createAdapter()]);
  assert.throws(() => registry.register(createAdapter()), /already registered/);
});

test('registry rejects unsupported input', () => {
  const registry = createProductAdapterRegistry([createAdapter()]);
  const unsupported: BuiltProductAdapterInput = {
    ...baselineInput,
    metadata: { productType: 'unsupported' }
  };
  assert.throws(() => registry.resolve(unsupported), /does not support/);
});

test('registry returns adapters in deterministic order', () => {
  const registry = createProductAdapterRegistry([
    {
      id: 'z-adapter',
      version: '1.0.0',
      supports() {
        return true;
      },
      transform() {
        return {
          compatibility: { blocking: 0, warning: 0 },
          diagnostics: [],
          previewSession: {}
        };
      }
    },
    {
      id: 'a-adapter',
      version: '1.0.0',
      supports() {
        return true;
      },
      transform() {
        return {
          compatibility: { blocking: 0, warning: 0 },
          diagnostics: [],
          previewSession: {}
        };
      }
    }
  ]);

  const ordered = registry.list();
  assert.deepEqual(
    ordered.map((entry) => `${entry.id}@${entry.version}`),
    ['a-adapter@1.0.0', 'z-adapter@1.0.0']
  );
});

test('built product intake schema exposes required contract sections', () => {
  assert.equal(builtProductIntakeSchema.type, 'object');
  assert.deepEqual(
    builtProductIntakeSchema.required,
    ['schemaVersion', 'adapter', 'tenant', 'product', 'integrations', 'permissions', 'mappings']
  );
  assert.equal(builtProductIntakeSchema.properties.schemaVersion.const, '1.0.0');
});

test('preview session schema requires deterministic view model fields', () => {
  assert.equal(previewSessionSchema.type, 'object');
  assert.deepEqual(previewSessionSchema.required, ['schemaVersion', 'sessionId', 'tenantId', 'productId', 'views']);
  assert.equal(previewSessionSchema.properties.schemaVersion.const, '1.0.0');
});

test('compatibility report schema requires go/no-go recommendation', () => {
  assert.equal(compatibilityReportSchema.type, 'object');
  assert.deepEqual(compatibilityReportSchema.properties.recommendation.enum, ['Go', 'No-Go']);
  assert.deepEqual(compatibilityReportSchema.required, [
    'schemaVersion',
    'adapter',
    'summary',
    'diagnostics',
    'recommendation'
  ]);
});

test('adapters index declares active schema versions', () => {
  assert.equal(adaptersIndex.activeBuiltProductIntakeSchemaVersion, '1.0.0');
  assert.equal(adaptersIndex.activePreviewSessionSchemaVersion, '1.0.0');
  assert.equal(adaptersIndex.activeCompatibilityReportSchemaVersion, '1.0.0');
});
