import test from 'node:test';
import assert from 'node:assert/strict';
import type { BuiltProductAdapterInput, ProductAdapter } from './index.js';
import { createProductAdapterRegistry } from './index.js';

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
