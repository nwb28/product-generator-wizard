import test from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import { signTestToken } from '@pgw/apps-generator-api/dist/auth.js';
import { createApp } from '@pgw/apps-generator-api/dist/server.js';

const app = createApp();

const builtProductPayload = {
  schemaVersion: '1.0.0',
  adapter: { id: 'pilot-loan-adapter', version: '1.0.0' },
  tenant: { id: 'tenant-preview' },
  product: { id: 'preview-product-01', type: 'loan', displayName: 'Preview Product' },
  integrations: {
    workforce: { enabled: true, details: { profile: 'default', capabilities: ['submit'] } },
    excelPlugin: { enabled: true, details: { mode: 'refresh', capabilities: ['export', 'refresh'] } }
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

async function bearer(): Promise<string> {
  const token = await signTestToken('preview-e2e-user', ['wizard-admin']);
  return `Bearer ${token}`;
}

test('preview e2e: validate -> simulate -> report', async () => {
  const auth = await bearer();

  const validate = await supertest(app)
    .post('/preview/validate')
    .set('authorization', auth)
    .set('x-tenant-id', 'tenant-preview')
    .send(builtProductPayload);
  assert.equal(validate.status, 200);
  assert.equal(validate.body.valid, true);

  const simulate = await supertest(app)
    .post('/preview/simulate')
    .set('authorization', auth)
    .set('x-tenant-id', 'tenant-preview')
    .send(builtProductPayload);
  assert.equal(simulate.status, 200);
  assert.equal(typeof simulate.body.artifacts.deterministicHash, 'string');
  assert.ok(Array.isArray(simulate.body.artifacts.files));

  const report = await supertest(app)
    .post('/preview/report')
    .set('authorization', auth)
    .set('x-tenant-id', 'tenant-preview')
    .send(builtProductPayload);
  assert.equal(report.status, 200);
  assert.equal(report.body.recommendation, 'Go');
  assert.equal(report.body.permissionMatrix.company.roles, 1);
});

test('preview e2e: report returns no-go with invalid permissions', async () => {
  const auth = await bearer();
  const report = await supertest(app)
    .post('/preview/report')
    .set('authorization', auth)
    .set('x-tenant-id', 'tenant-preview')
    .send({
      ...builtProductPayload,
      permissions: {
        bucs: [],
        firm: [],
        company: []
      }
    });

  assert.equal(report.status, 400);
  assert.equal(report.body.recommendation, 'No-Go');
  assert.ok(report.body.summary.blocking > 0);
});
