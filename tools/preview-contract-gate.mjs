import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { signTestToken } from '../apps/generator-api/dist/auth.js';
import { createApp } from '../apps/generator-api/dist/server.js';

const fixturePath = process.argv[2] ?? 'fixtures/preview/pilot-built-product-intake.json';
const payload = JSON.parse(await readFile(resolve(process.cwd(), fixturePath), 'utf8'));

const app = createApp({ auditLogger: { emit() {} } });
const server = app.listen(0);
const address = server.address();
if (!address || typeof address === 'string') {
  throw new Error('Unable to resolve ephemeral preview-contract-gate server port.');
}

const baseUrl = `http://127.0.0.1:${address.port}`;
const token = await signTestToken('preview-contract-gate', ['wizard-admin']);
const headers = {
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
  'x-tenant-id': payload.tenant.id
};

try {
  const validate = await post('/preview/validate', payload, headers);
  const simulate = await post('/preview/simulate', payload, headers);
  const report = await post('/preview/report', payload, headers);

  const gate = {
    generatedAt: new Date().toISOString(),
    fixture: fixturePath,
    steps: {
      validate: summarize(validate),
      simulate: summarize(simulate),
      report: summarize(report)
    },
    recommendation: report.body.recommendation,
    blocking: report.body.summary?.blocking ?? 0,
    warning: report.body.summary?.warning ?? 0,
    deterministicHash: simulate.body.artifacts?.deterministicHash ?? null,
    passed: validate.status === 200 && simulate.status === 200 && report.status === 200 && report.body.recommendation === 'Go'
  };

  await mkdir('.tmp/preview-gate', { recursive: true });
  await writeFile('.tmp/preview-gate/report.json', JSON.stringify(gate, null, 2) + '\n', 'utf8');
  await writeFile('.tmp/preview-gate/simulate.json', JSON.stringify(simulate.body, null, 2) + '\n', 'utf8');
  await writeFile('.tmp/preview-gate/report-response.json', JSON.stringify(report.body, null, 2) + '\n', 'utf8');

  process.stdout.write(`${JSON.stringify(gate, null, 2)}\n`);

  if (!gate.passed) {
    process.exitCode = 1;
  }
} finally {
  server.close();
}

async function post(path, body, headers) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body)
  });
  const responseBody = await response.json();
  return { status: response.status, body: responseBody };
}

function summarize(result) {
  return {
    status: result.status,
    valid: result.body?.valid ?? null,
    summary: result.body?.summary ?? null
  };
}
