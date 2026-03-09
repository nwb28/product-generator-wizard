import test from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import intake from '@pgw/packages-contracts/dist/examples/intake.valid.v1.json' with { type: 'json' };
import type { AuditEvent } from './audit.js';
import { signTestToken } from './auth.js';
import { createRateLimiter } from './rate-limit.js';
import { createApp } from './server.js';

const app = createApp();

async function authHeader(role: 'wizard-admin' | 'product-generator' = 'wizard-admin') {
  const token = await signTestToken('test-user', [role]);
  return `Bearer ${token}`;
}

test('POST /validate returns 200 for valid intake', async () => {
  const response = await supertest(app).post('/validate').send(intake);
  assert.equal(response.status, 200);
  assert.equal(response.body.valid, true);
});

test('GET /authz/wizard-entry returns 403 without auth token', async () => {
  const response = await supertest(app).get('/authz/wizard-entry');
  assert.equal(response.status, 403);
});

test('GET /authz/wizard-entry returns 200 for product-generator role', async () => {
  const response = await supertest(app)
    .get('/authz/wizard-entry')
    .set('authorization', await authHeader('product-generator'));
  assert.equal(response.status, 200);
  assert.equal(response.body.authorized, true);
});

test('POST /compile returns manifest', async () => {
  const response = await supertest(app)
    .post('/compile')
    .set('authorization', await authHeader())
    .send(intake);
  assert.equal(response.status, 200);
  assert.equal(response.body.manifest.schemaVersion, '1.0.0');
});

test('POST /generate returns deterministic hash and files', async () => {
  const response = await supertest(app)
    .post('/generate')
    .set('authorization', await authHeader())
    .send(intake);
  assert.equal(response.status, 200);
  assert.equal(typeof response.body.deterministicHash, 'string');
  assert.ok(Array.isArray(response.body.files));
});

test('POST /generate returns 403 without authorization token', async () => {
  const response = await supertest(app).post('/generate').send(intake);
  assert.equal(response.status, 403);
});

test('POST /review-document returns markdown', async () => {
  const response = await supertest(app)
    .post('/review-document')
    .set('authorization', await authHeader())
    .send(intake);
  assert.equal(response.status, 200);
  assert.match(response.body.markdown, /Human Review Document/);
});

test('POST /generate returns 429 when tenant-principal key exceeds limit', async () => {
  const limitedApp = createApp({ rateLimiter: createRateLimiter({ maxRequests: 1, windowMs: 60_000 }) });
  const token = await authHeader();
  const agent = supertest(limitedApp);

  const first = await agent.post('/generate').set('authorization', token).set('x-tenant-id', 'tenant-a').send(intake);
  assert.equal(first.status, 200);
  assert.equal(first.headers['x-ratelimit-limit'], '1');
  assert.equal(first.headers['x-ratelimit-remaining'], '0');

  const second = await agent.post('/generate').set('authorization', token).set('x-tenant-id', 'tenant-a').send(intake);
  assert.equal(second.status, 429);
  assert.equal(second.headers['x-ratelimit-limit'], '1');
  assert.equal(second.body.message, 'Rate limit exceeded. Retry later.');
});

test('POST /generate applies rate limits per tenant identity', async () => {
  const limitedApp = createApp({ rateLimiter: createRateLimiter({ maxRequests: 1, windowMs: 60_000 }) });
  const token = await authHeader();
  const agent = supertest(limitedApp);

  const firstTenantA = await agent
    .post('/generate')
    .set('authorization', token)
    .set('x-tenant-id', 'tenant-a')
    .send(intake);
  assert.equal(firstTenantA.status, 200);

  const firstTenantB = await agent
    .post('/generate')
    .set('authorization', token)
    .set('x-tenant-id', 'tenant-b')
    .send(intake);
  assert.equal(firstTenantB.status, 200);
});

test('POST /generate replays response when idempotency key is reused with same payload', async () => {
  const token = await authHeader();
  const key = 'gen-request-001';

  const first = await supertest(app)
    .post('/generate')
    .set('authorization', token)
    .set('x-tenant-id', 'tenant-idempotent')
    .set('idempotency-key', key)
    .send(intake);
  assert.equal(first.status, 200);
  assert.equal(first.headers['x-idempotency-status'], 'created');

  const second = await supertest(app)
    .post('/generate')
    .set('authorization', token)
    .set('x-tenant-id', 'tenant-idempotent')
    .set('idempotency-key', key)
    .send(intake);
  assert.equal(second.status, 200);
  assert.equal(second.headers['x-idempotency-status'], 'replayed');
  assert.deepEqual(second.body, first.body);
});

test('POST /generate returns 409 when idempotency key is reused with different payload', async () => {
  const token = await authHeader();
  const key = 'gen-request-002';

  const first = await supertest(app)
    .post('/generate')
    .set('authorization', token)
    .set('x-tenant-id', 'tenant-idempotent-conflict')
    .set('idempotency-key', key)
    .send(intake);
  assert.equal(first.status, 200);

  const modifiedPayload = {
    ...intake,
    product: { ...intake.product, id: 'pilot-product-01-conflict' }
  };

  const second = await supertest(app)
    .post('/generate')
    .set('authorization', token)
    .set('x-tenant-id', 'tenant-idempotent-conflict')
    .set('idempotency-key', key)
    .send(modifiedPayload);
  assert.equal(second.status, 409);
  assert.equal(second.headers['x-idempotency-status'], 'conflict');
  assert.match(second.body.message, /different request payload/);
});

test('audit logger emits structured events for authz deny and generate replay', async () => {
  const events: AuditEvent[] = [];
  const auditedApp = createApp({
    auditLogger: {
      emit(event) {
        events.push(event);
      }
    }
  });
  const token = await authHeader();

  const denied = await supertest(auditedApp).get('/authz/wizard-entry');
  assert.equal(denied.status, 403);

  const firstGenerate = await supertest(auditedApp)
    .post('/generate')
    .set('authorization', token)
    .set('x-tenant-id', 'tenant-audit')
    .set('idempotency-key', 'audit-generate-001')
    .send(intake);
  assert.equal(firstGenerate.status, 200);

  const replayedGenerate = await supertest(auditedApp)
    .post('/generate')
    .set('authorization', token)
    .set('x-tenant-id', 'tenant-audit')
    .set('idempotency-key', 'audit-generate-001')
    .send(intake);
  assert.equal(replayedGenerate.status, 200);

  const denyEvent = events.find((event) => event.eventType === 'wizard-authz' && event.outcome === 'deny');
  assert.ok(denyEvent);

  const replayEvent = events.find(
    (event) => event.eventType === 'wizard-operation' && event.action === 'generate' && event.outcome === 'replayed'
  );
  assert.ok(replayEvent);
  assert.equal(replayEvent?.tenantId, 'tenant-audit');
});
