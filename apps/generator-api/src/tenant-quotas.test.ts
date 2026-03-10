import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  createTenantQuotaPolicy,
  loadTenantQuotaConfigOrThrow,
  validateTenantQuotaConfig
} from './tenant-quotas.js';

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

test('validateTenantQuotaConfig rejects malformed quota payload', () => {
  const validation = validateTenantQuotaConfig({
    default: {
      perMinute: -5
    },
    tenants: {
      '': {
        endpointOverrides: {
          '': 0
        }
      }
    }
  });

  assert.equal(validation.valid, false);
  assert.ok(validation.errors.some((error) => error.includes('default.perMinute')));
  assert.ok(validation.errors.some((error) => error.includes('tenant id keys')));
});

test('loadTenantQuotaConfigOrThrow fails fast on invalid file contents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tenant-quota-invalid-'));
  const file = join(dir, 'tenant-quotas.json');
  writeFileSync(file, JSON.stringify({ default: { perMinute: -1 } }), 'utf8');

  assert.throws(() => loadTenantQuotaConfigOrThrow(file), /is invalid/);
});
