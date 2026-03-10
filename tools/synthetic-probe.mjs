import { mkdir, writeFile } from 'node:fs/promises';
import intake from '../packages/contracts/dist/examples/intake.valid.v1.json' with { type: 'json' };
import { signTestToken } from '../apps/generator-api/dist/auth.js';
import { createApp } from '../apps/generator-api/dist/server.js';

const app = createApp({ auditLogger: { emit() {} } });
const server = app.listen(0);
const address = server.address();

if (!address || typeof address === 'string') {
  throw new Error('Synthetic probe could not resolve local server port.');
}

const baseUrl = `http://127.0.0.1:${address.port}`;
const token = await signTestToken('synthetic-probe-user', ['wizard-admin']);
const previewPayload = {
  schemaVersion: '1.0.0',
  adapter: { id: 'pilot-loan-adapter', version: '1.0.0' },
  tenant: { id: 'synthetic-tenant' },
  product: { id: 'synthetic-preview-product', type: 'loan', displayName: 'Synthetic Preview Product' },
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

const checks = [
  {
    name: 'authz-entry',
    run: async () => await request('/authz/wizard-entry', { method: 'GET', headers: { authorization: `Bearer ${token}` } }, 200)
  },
  {
    name: 'validate',
    run: async () =>
      await request('/validate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(intake)
      }, 200)
  },
  {
    name: 'generate',
    run: async () =>
      await request('/generate', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'x-tenant-id': 'synthetic-tenant',
          'idempotency-key': `synthetic-${Date.now()}`
        },
        body: JSON.stringify(intake)
      }, 200)
  },
  {
    name: 'preview-validate',
    run: async () =>
      await request('/preview/validate', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'x-tenant-id': 'synthetic-tenant'
        },
        body: JSON.stringify(previewPayload)
      }, 200)
  },
  {
    name: 'preview-simulate',
    run: async () =>
      await request('/preview/simulate', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'x-tenant-id': 'synthetic-tenant'
        },
        body: JSON.stringify(previewPayload)
      }, 200)
  },
  {
    name: 'preview-report',
    run: async () =>
      await request('/preview/report', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          'content-type': 'application/json',
          'x-tenant-id': 'synthetic-tenant'
        },
        body: JSON.stringify(previewPayload)
      }, 200)
  }
];

const results = [];
for (const check of checks) {
  const started = Date.now();
  try {
    await check.run();
    results.push({ name: check.name, ok: true, durationMs: Date.now() - started });
  } catch (error) {
    results.push({
      name: check.name,
      ok: false,
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

server.close();

const report = {
  generatedAt: new Date().toISOString(),
  ok: results.every((result) => result.ok),
  results
};

await mkdir('.tmp/synthetic', { recursive: true });
await writeFile('.tmp/synthetic/latest.json', JSON.stringify(report, null, 2) + '\n', 'utf8');
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (!report.ok) {
  process.exitCode = 1;
}

async function request(path, init, expectedStatus) {
  const response = await fetch(`${baseUrl}${path}`, init);
  if (response.status !== expectedStatus) {
    throw new Error(`${path} expected ${expectedStatus} received ${response.status}`);
  }
}
