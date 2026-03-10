import { mkdir, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import intake from '../packages/contracts/dist/examples/intake.valid.v1.json' with { type: 'json' };
import { signTestToken } from '../apps/generator-api/dist/auth.js';
import { createApp } from '../apps/generator-api/dist/server.js';

const SAMPLE_SIZE = readPositiveInt('PERF_SAMPLE_SIZE', 50);
const CONCURRENCY = readPositiveInt('PERF_CONCURRENCY', 10);
const VALIDATE_P95_MS = readPositiveInt('PERF_VALIDATE_P95_MS', 750);
const GENERATE_P95_MS = readPositiveInt('PERF_GENERATE_P95_MS', 1500);

const app = createApp({ auditLogger: { emit() {} } });
const server = app.listen(0);
const address = server.address();

if (!address || typeof address === 'string') {
  throw new Error('Unable to determine local test server address.');
}

const baseUrl = `http://127.0.0.1:${address.port}`;
const token = await signTestToken('perf-user', ['wizard-admin']);
const headers = {
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
  'x-tenant-id': 'perf-tenant'
};

const validateRuns = await runEndpointLoad({
  label: 'validate',
  sampleSize: SAMPLE_SIZE,
  concurrency: CONCURRENCY,
  invoke: async () => {
    const response = await fetch(`${baseUrl}/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-tenant-id': 'perf-tenant' },
      body: JSON.stringify(intake)
    });
    if (response.status !== 200) {
      throw new Error(`/validate returned ${response.status}`);
    }
  }
});

const generateRuns = await runEndpointLoad({
  label: 'generate',
  sampleSize: SAMPLE_SIZE,
  concurrency: CONCURRENCY,
  invoke: async () => {
    const response = await fetch(`${baseUrl}/generate`, {
      method: 'POST',
      headers: {
        ...headers,
        'idempotency-key': `perf-${Math.random().toString(36).slice(2)}`
      },
      body: JSON.stringify(intake)
    });
    if (response.status !== 200) {
      throw new Error(`/generate returned ${response.status}`);
    }
  }
});

server.close();

const summary = {
  generatedAt: new Date().toISOString(),
  config: {
    sampleSize: SAMPLE_SIZE,
    concurrency: CONCURRENCY,
    thresholds: {
      validateP95Ms: VALIDATE_P95_MS,
      generateP95Ms: GENERATE_P95_MS
    }
  },
  metrics: {
    validate: summarize(validateRuns),
    generate: summarize(generateRuns)
  }
};

const failures = [];
if (summary.metrics.validate.p95Ms > VALIDATE_P95_MS) {
  failures.push(`validate p95 ${summary.metrics.validate.p95Ms}ms > ${VALIDATE_P95_MS}ms`);
}
if (summary.metrics.generate.p95Ms > GENERATE_P95_MS) {
  failures.push(`generate p95 ${summary.metrics.generate.p95Ms}ms > ${GENERATE_P95_MS}ms`);
}

await mkdir('.tmp/perf', { recursive: true });
await writeFile('.tmp/perf/latest.json', JSON.stringify(summary, null, 2) + '\n', 'utf8');

process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);

if (failures.length > 0) {
  process.stderr.write(`Performance baseline failed:\n- ${failures.join('\n- ')}\n`);
  process.exitCode = 1;
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

  const workers = Array.from({ length: Math.max(1, concurrency) }, () => worker());
  await Promise.all(workers);
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
