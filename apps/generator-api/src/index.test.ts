import test from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import intake from '@pgw/packages-contracts/dist/examples/intake.valid.v1.json' with { type: 'json' };
import type { AuditEvent } from './audit.js';
import { signTestToken } from './auth.js';
import { createRateLimiter } from './rate-limit.js';
import type { RedisExecutor } from './redis-executor.js';
import type { TelemetryClient } from './telemetry.js';
import { createApp } from './server.js';

const app = createApp();

const builtProductPayload = {
  schemaVersion: '1.0.0',
  adapter: { id: 'pilot-loan-adapter', version: '1.0.0' },
  tenant: { id: 'tenant-preview' },
  product: { id: 'preview-product-01', type: 'loan', displayName: 'Preview Product' },
  integrations: {
    workforce: { enabled: true, details: { profile: 'default' } },
    excelPlugin: { enabled: true, details: { mode: 'refresh', capabilities: ['refresh', 'export'] } }
  },
  permissions: {
    bucs: [{ role: 'reader', permissions: ['read'] }],
    firm: [{ role: 'writer', permissions: ['read', 'write'] }],
    company: [{ role: 'admin', permissions: ['read', 'write', 'approve'] }]
  },
  mappings: [{ canonicalModel: 'loan', sourcePath: '$.loan', confidence: 0.95 }],
  preview: {
    uiScreens: [
      { id: 'summary', title: 'Summary' },
      { id: 'details', title: 'Details' }
    ]
  }
};

async function authHeader(role: 'wizard-admin' | 'product-generator' = 'wizard-admin') {
  const token = await signTestToken('test-user', [role]);
  return `Bearer ${token}`;
}

test('POST /validate returns 200 for valid intake', async () => {
  const response = await supertest(app).post('/validate').send(intake);
  assert.equal(response.status, 200);
  assert.equal(response.body.valid, true);
});

test('GET /healthz returns process liveness', async () => {
  const response = await supertest(app).get('/healthz');
  assert.equal(response.status, 200);
  assert.equal(response.body.status, 'ok');
});

test('GET /healthz returns security hardening headers', async () => {
  const response = await supertest(app).get('/healthz');
  assert.equal(response.status, 200);
  assert.equal(response.headers['x-content-type-options'], 'nosniff');
  assert.equal(response.headers['x-frame-options'], 'DENY');
  assert.equal(response.headers['referrer-policy'], 'no-referrer');
  assert.equal(response.headers['content-security-policy'], "default-src 'none'; frame-ancestors 'none'");
});

test('GET /readyz returns ready when redis is not configured', async () => {
  const response = await supertest(app).get('/readyz');
  assert.equal(response.status, 200);
  assert.equal(response.body.ready, true);
  assert.equal(response.body.checks.redis, 'not-configured');
});

test('GET /readyz returns 503 when configured redis dependency check fails', async () => {
  const failingRedis: RedisExecutor = {
    async run() {
      throw new Error('redis unavailable');
    }
  };
  const dependencyApp = createApp({ redisExecutor: failingRedis });

  const response = await supertest(dependencyApp).get('/readyz');
  assert.equal(response.status, 503);
  assert.equal(response.body.ready, false);
  assert.equal(response.body.checks.redis, 'failed');
});

test('POST /generate falls back to local stores when redis backend fails', async () => {
  const failingRedis: RedisExecutor = {
    async run() {
      throw new Error('redis unavailable');
    }
  };
  const resilientApp = createApp({ redisExecutor: failingRedis });
  const token = await authHeader();

  const first = await supertest(resilientApp)
    .post('/generate')
    .set('authorization', token)
    .set('x-tenant-id', 'tenant-resilience')
    .set('idempotency-key', 'resilient-001')
    .send(intake);

  assert.equal(first.status, 200);
  assert.equal(first.headers['x-ratelimit-backend'], 'fallback');
  assert.equal(first.headers['x-idempotency-backend'], 'fallback');

  const second = await supertest(resilientApp)
    .post('/generate')
    .set('authorization', token)
    .set('x-tenant-id', 'tenant-resilience')
    .set('idempotency-key', 'resilient-001')
    .send(intake);

  assert.equal(second.status, 200);
  assert.equal(second.headers['x-idempotency-status'], 'replayed');
  assert.equal(second.headers['x-idempotency-backend'], 'fallback');
});

test('POST /generate returns 503 in fail-closed mode when redis backend fails', async () => {
  const failingRedis: RedisExecutor = {
    async run() {
      throw new Error('redis unavailable');
    }
  };
  const strictApp = createApp({
    redisExecutor: failingRedis,
    redisFallbackMode: 'fail-closed'
  });
  const token = await authHeader();

  const response = await supertest(strictApp)
    .post('/generate')
    .set('authorization', token)
    .set('x-tenant-id', 'tenant-strict')
    .set('idempotency-key', 'strict-001')
    .send(intake);

  assert.equal(response.status, 503);
  assert.match(response.body.message, /dependency unavailable/);
});

test('createApp fails fast when tenant quota config file is invalid', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pgw-invalid-quota-'));
  const configPath = join(dir, 'tenant-quotas.json');
  writeFileSync(configPath, JSON.stringify({ default: { perMinute: 0 } }), 'utf8');

  const previous = process.env.WIZARD_TENANT_QUOTA_CONFIG_PATH;
  process.env.WIZARD_TENANT_QUOTA_CONFIG_PATH = configPath;
  try {
    assert.throws(() => createApp(), /Tenant quota config/);
  } finally {
    if (previous === undefined) {
      delete process.env.WIZARD_TENANT_QUOTA_CONFIG_PATH;
    } else {
      process.env.WIZARD_TENANT_QUOTA_CONFIG_PATH = previous;
    }
  }
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

test('POST endpoints require application/json content type', async () => {
  const response = await supertest(app).post('/validate').set('content-type', 'text/plain').send('invalid');
  assert.equal(response.status, 415);
  assert.equal(response.body.message, 'Content-Type must be application/json.');
});

test('POST /validate returns 400 for malformed json payload', async () => {
  const response = await supertest(app)
    .post('/validate')
    .set('content-type', 'application/json')
    .send('{"product":');
  assert.equal(response.status, 400);
  assert.equal(response.body.message, 'Invalid JSON payload.');
});

test('POST /validate returns 413 for payloads above configured limit', async () => {
  const smallLimitApp = createApp({ jsonBodyLimitBytes: 64 });
  const oversizedPayload = {
    ...intake,
    canonicalModelMappings: [{ model: 'loan', sourcePath: 'a'.repeat(256), confidence: 0.9 }]
  };

  const response = await supertest(smallLimitApp).post('/validate').send(oversizedPayload);
  assert.equal(response.status, 413);
  assert.equal(response.body.message, 'Payload exceeds maximum allowed size.');
});

test('POST /review-document returns markdown', async () => {
  const response = await supertest(app)
    .post('/review-document')
    .set('authorization', await authHeader())
    .send(intake);
  assert.equal(response.status, 200);
  assert.match(response.body.markdown, /Human Review Document/);
});

test('POST /preview/validate returns 200 for valid built-product payload', async () => {
  const response = await supertest(app)
    .post('/preview/validate')
    .set('authorization', await authHeader())
    .set('x-tenant-id', 'tenant-preview')
    .send(builtProductPayload);

  assert.equal(response.status, 200);
  assert.equal(response.body.valid, true);
  assert.equal(response.body.summary.blocking, 0);
});

test('POST /preview/validate returns 403 without authorization token', async () => {
  const response = await supertest(app).post('/preview/validate').send(builtProductPayload);
  assert.equal(response.status, 403);
});

test('POST /preview/simulate returns transformed preview session output', async () => {
  const response = await supertest(app)
    .post('/preview/simulate')
    .set('authorization', await authHeader())
    .set('x-tenant-id', 'tenant-preview')
    .send(builtProductPayload);

  assert.equal(response.status, 200);
  assert.equal(response.body.validation.valid, true);
  assert.equal(response.body.output.previewSession.sessionId, 'tenant-preview-preview-product-01-pilot-loan-adapter');
  assert.deepEqual(response.body.output.previewSession.excelSimulation.capabilities, ['export', 'refresh']);
  assert.equal(typeof response.body.artifacts.deterministicHash, 'string');
  assert.ok(Array.isArray(response.body.artifacts.files));
  assert.equal(response.body.artifactPolicy.retentionHours, 24);
});

test('POST /preview/report returns no-go when built-product payload is invalid', async () => {
  const response = await supertest(app)
    .post('/preview/report')
    .set('authorization', await authHeader())
    .set('x-tenant-id', 'tenant-preview')
    .send({
      ...builtProductPayload,
      mappings: []
    });

  assert.equal(response.status, 400);
  assert.equal(response.body.recommendation, 'No-Go');
  assert.ok(response.body.summary.blocking > 0);
});

test('POST /preview/report returns permission matrix coverage for valid payload', async () => {
  const response = await supertest(app)
    .post('/preview/report')
    .set('authorization', await authHeader())
    .set('x-tenant-id', 'tenant-preview')
    .send(builtProductPayload);

  assert.equal(response.status, 200);
  assert.equal(response.body.recommendation, 'Go');
  assert.equal(response.body.permissionMatrix.bucs.roles, 1);
  assert.equal(response.body.permissionMatrix.company.permissions, 3);
  assert.equal(response.body.mappingCoverage.coveragePercent, 100);
  assert.equal(response.body.mappingCoverage.uniqueCanonicalModels, 1);
});

test('POST /preview/report returns 403 when request tenant and payload tenant do not match', async () => {
  const response = await supertest(app)
    .post('/preview/report')
    .set('authorization', await authHeader())
    .set('x-tenant-id', 'tenant-other')
    .send(builtProductPayload);

  assert.equal(response.status, 403);
  assert.match(response.body.message, /Tenant mismatch/);
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

test('audit logger captures preview operation success and deny events', async () => {
  const events: AuditEvent[] = [];
  const auditedApp = createApp({
    auditLogger: {
      emit(event) {
        events.push(event);
      }
    }
  });
  const token = await authHeader();

  const validate = await supertest(auditedApp)
    .post('/preview/validate')
    .set('authorization', token)
    .set('x-tenant-id', 'tenant-preview')
    .send(builtProductPayload);
  assert.equal(validate.status, 200);

  const simulate = await supertest(auditedApp)
    .post('/preview/simulate')
    .set('authorization', token)
    .set('x-tenant-id', 'tenant-preview')
    .send(builtProductPayload);
  assert.equal(simulate.status, 200);

  const deny = await supertest(auditedApp)
    .post('/preview/report')
    .set('authorization', token)
    .set('x-tenant-id', 'tenant-other')
    .send(builtProductPayload);
  assert.equal(deny.status, 403);

  assert.ok(events.some((event) => event.action === 'preview-validate' && event.outcome === 'success'));
  assert.ok(events.some((event) => event.action === 'preview-simulate' && event.outcome === 'success'));
  assert.ok(events.some((event) => event.action === 'preview-report' && event.outcome === 'deny'));
});

test('telemetry client captures request count and latency metrics', async () => {
  const counters: Array<{ name: string; value: number; attributes: Record<string, unknown> }> = [];
  const histograms: Array<{ name: string; value: number; attributes: Record<string, unknown> }> = [];

  const telemetry: TelemetryClient = {
    startSpan() {
      return { end() {} };
    },
    recordCounter(name, value, attributes) {
      counters.push({ name, value, attributes });
    },
    recordHistogram(name, value, attributes) {
      histograms.push({ name, value, attributes });
    }
  };

  const telemetryApp = createApp({ telemetry });
  const response = await supertest(telemetryApp).post('/validate').send(intake);
  assert.equal(response.status, 200);

  assert.ok(counters.some((entry) => entry.name === 'wizard_api_requests_total' && entry.value === 1));
  assert.ok(
    histograms.some(
      (entry) =>
        entry.name === 'wizard_api_request_duration_ms' &&
        typeof entry.value === 'number' &&
        entry.attributes.path === '/validate'
    )
  );
});
