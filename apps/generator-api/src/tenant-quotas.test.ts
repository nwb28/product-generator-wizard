import test from 'node:test';
import assert from 'node:assert/strict';
import { createTenantQuotaPolicy } from './tenant-quotas.js';

test('tenant quota policy resolves endpoint override and tenant override precedence', () => {
  const policy = createTenantQuotaPolicy({
    default: {
      perMinute: 100,
      endpointOverrides: { generate: 50 }
    },
    tenants: {
      'tenant-x': {
        perMinute: 200,
        endpointOverrides: { generate: 150 }
      },
      'tenant-y': {
        perMinute: 175
      }
    }
  });

  assert.equal(policy.resolvePerMinute('tenant-x', 'generate'), 150);
  assert.equal(policy.resolvePerMinute('tenant-x', 'compile'), 200);
  assert.equal(policy.resolvePerMinute('tenant-y', 'generate'), 175);
  assert.equal(policy.resolvePerMinute('tenant-z', 'generate'), 50);
  assert.equal(policy.resolvePerMinute('tenant-z', 'compile'), 100);
});
