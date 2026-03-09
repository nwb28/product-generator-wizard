import test from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import intake from '@pgw/packages-contracts/dist/examples/intake.valid.v1.json' with { type: 'json' };
import { signTestToken } from '@pgw/apps-generator-api/dist/auth.js';
import { createRateLimiter } from '@pgw/apps-generator-api/dist/rate-limit.js';
import { createApp } from '@pgw/apps-generator-api/dist/server.js';

async function bearer(): Promise<string> {
  const token = await signTestToken('tenant-test-user', ['wizard-admin']);
  return `Bearer ${token}`;
}

test('tenant isolation: rate limits do not bleed between tenants', async () => {
  const app = createApp({
    rateLimiter: createRateLimiter({ maxRequests: 1, windowMs: 60_000 }),
    auditLogger: { emit() {} }
  });
  const auth = await bearer();
  const agent = supertest(app);

  const tenantAFirst = await agent
    .post('/generate')
    .set('authorization', auth)
    .set('x-tenant-id', 'tenant-a')
    .send(intake);
  assert.equal(tenantAFirst.status, 200);

  const tenantASecond = await agent
    .post('/generate')
    .set('authorization', auth)
    .set('x-tenant-id', 'tenant-a')
    .send(intake);
  assert.equal(tenantASecond.status, 429);

  const tenantBFirst = await agent
    .post('/generate')
    .set('authorization', auth)
    .set('x-tenant-id', 'tenant-b')
    .send(intake);
  assert.equal(tenantBFirst.status, 200);
});

test('tenant isolation: idempotency key scope is isolated by tenant', async () => {
  const app = createApp({ auditLogger: { emit() {} } });
  const auth = await bearer();
  const agent = supertest(app);

  const key = 'shared-idempotency-key';

  const tenantA = await agent
    .post('/generate')
    .set('authorization', auth)
    .set('x-tenant-id', 'tenant-a')
    .set('idempotency-key', key)
    .send(intake);
  assert.equal(tenantA.status, 200);
  assert.equal(tenantA.headers['x-idempotency-status'], 'created');

  const tenantB = await agent
    .post('/generate')
    .set('authorization', auth)
    .set('x-tenant-id', 'tenant-b')
    .set('idempotency-key', key)
    .send(intake);
  assert.equal(tenantB.status, 200);
  assert.equal(tenantB.headers['x-idempotency-status'], 'created');
});
