import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { signTestToken } from '../apps/generator-api/dist/auth.js';
import { createApp } from '../apps/generator-api/dist/server.js';

const SAMPLE_SIZE = readPositiveInt('PERF_PREVIEW_SAMPLE_SIZE', 40);
const CONCURRENCY = readPositiveInt('PERF_PREVIEW_CONCURRENCY', 8);
const VALIDATE_P95_MS = readPositiveInt('PERF_PREVIEW_VALIDATE_P95_MS', 900);
const SIMULATE_P95_MS = readPositiveInt('PERF_PREVIEW_SIMULATE_P95_MS', 1800);
const REPORT_P95_MS = readPositiveInt('PERF_PREVIEW_REPORT_P95_MS', 1200);

const payload = JSON.parse(await readFile('fixtures/preview/pilot-built-product-intake.json', 'utf8'));

const app = createApp({ auditLogger: { emit() {} } });
const server = app.listen(0);
const address = server.address();

if (!address || typeof address === 'string') {
  throw new Error('Unable to determine preview performance test server address.');
}

const baseUrl = `http://127.0.0.1:${address.port}`;
const token = await signTestToken('preview-perf-user', ['wizard-admin']);
const headers = {
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
  'x-tenant-id': payload.tenant.id
};

const validateRuns = await runEndpointLoad({
  label: 'preview-validate',
  sampleSize: SAMPLE_SIZE,
  concurrency: CONCURRENCY,
  invoke: async () => await assertStatus('/preview/validate', payload, headers, 200)
});

const simulateRuns = await runEndpointLoad({
  label: 'preview-simulate',
  sampleSize: SAMPLE_SIZE,
  concurrency: CONCURRENCY,
  invoke: async () => await assertStatus('/preview/simulate', payload, headers, 200)
});

const reportRuns = await runEndpointLoad({
  label: 'preview-report',
  sampleSize: SAMPLE_SIZE,
  concurrency: CONCURRENCY,
  invoke: async () => await assertStatus('/preview/report', payload, headers, 200)
});

server.close();

const summary = {
  generatedAt: new Date().toISOString(),
  config: {
    sampleSize: SAMPLE_SIZE,
    concurrency: CONCURRENCY,
    thresholds: {
      previewValidateP95Ms: VALIDATE_P95_MS,
      previewSimulateP95Ms: SIMULATE_P95_MS,
      previewReportP95Ms: REPORT_P95_MS
    }
  },
  metrics: {
    previewValidate: summarize(validateRuns),
    previewSimulate: summarize(simulateRuns),
    previewReport: summarize(reportRuns)
  }
};

const failures = [];
if (summary.metrics.previewValidate.p95Ms > VALIDATE_P95_MS) {
  failures.push(`preview validate p95 ${summary.metrics.previewValidate.p95Ms}ms > ${VALIDATE_P95_MS}ms`);
}
if (summary.metrics.previewSimulate.p95Ms > SIMULATE_P95_MS) {
  failures.push(`preview simulate p95 ${summary.metrics.previewSimulate.p95Ms}ms > ${SIMULATE_P95_MS}ms`);
}
if (summary.metrics.previewReport.p95Ms > REPORT_P95_MS) {
  failures.push(`preview report p95 ${summary.metrics.previewReport.p95Ms}ms > ${REPORT_P95_MS}ms`);
}

await mkdir('.tmp/perf', { recursive: true });
await writeFile('.tmp/perf/preview-latest.json', JSON.stringify(summary, null, 2) + '\n', 'utf8');

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (failures.length > 0) {
  process.stderr.write(`Preview performance profile failed:\n- ${failures.join('\n- ')}\n`);
  process.exitCode = 1;
}

async function assertStatus(path, body, requestHeaders, expectedStatus) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: requestHeaders,
    body: JSON.stringify(body)
  });
  if (response.status !== expectedStatus) {
    throw new Error(`${path} returned ${response.status}, expected ${expectedStatus}`);
  }
}

async function runEndpointLoad({ label, sampleSize, concurrency, invoke }) {
  const durations = [];
  let launched = 0;

  async function worker() {
    while (launched < sampleSize) {
      launched += 1;
      const started = performance.now();
      await invoke();
      durations.push(Math.round(performance.now() - started));
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
  process.stdout.write(`Completed ${sampleSize} samples for ${label}.\n`);
  return durations;
}

function summarize(samples) {
  const sorted = [...samples].sort((a, b) => a - b);
  const p95Index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  const total = sorted.reduce((sum, value) => sum + value, 0);
  return {
    count: sorted.length,
    minMs: sorted[0] ?? 0,
    avgMs: sorted.length === 0 ? 0 : Math.round(total / sorted.length),
    p95Ms: sorted[p95Index] ?? 0,
    maxMs: sorted[sorted.length - 1] ?? 0
  };
}

function readPositiveInt(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}
