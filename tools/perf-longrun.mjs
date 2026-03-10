import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import intake from '../packages/contracts/dist/examples/intake.valid.v1.json' with { type: 'json' };
import { signTestToken } from '../apps/generator-api/dist/auth.js';
import { createApp } from '../apps/generator-api/dist/server.js';

const SAMPLE_SIZE = readPositiveInt('PERF_LONGRUN_SAMPLE_SIZE', 10_000);
const CONCURRENCY = readPositiveInt('PERF_LONGRUN_CONCURRENCY', 50);
const TREND_MAX_DEGRADATION_RATIO = readPositiveFloat('PERF_TREND_MAX_DEGRADATION_RATIO', 1.2);
const baselinePath = process.env.PERF_TREND_BASELINE_PATH ?? 'fixtures/perf/longrun-baseline.json';

process.env.WIZARD_TENANT_QUOTA_CONFIG_PATH = '.tmp/perf/nonexistent-tenant-quotas.json';
process.env.WIZARD_RATE_LIMIT_MAX_PER_MINUTE = String(Math.max(100_000, SAMPLE_SIZE * 2));

const app = createApp({ auditLogger: { emit() {} } });
const server = app.listen(0);
await new Promise((resolve, reject) => {
  server.once('listening', resolve);
  server.once('error', reject);
});
const address = server.address();

if (!address || typeof address === 'string') {
  throw new Error('Unable to determine local test server address.');
}

const baseUrl = `http://127.0.0.1:${address.port}`;
const token = await signTestToken('perf-longrun-user', ['wizard-admin']);

const validateRuns = await runLoad({
  sampleSize: SAMPLE_SIZE,
  concurrency: CONCURRENCY,
  invoke: async () => {
    const response = await fetch(`${baseUrl}/validate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(intake)
    });
    if (response.status !== 200) {
      throw new Error(`/validate returned ${response.status}`);
    }
  }
});

const generateRuns = await runLoad({
  sampleSize: SAMPLE_SIZE,
  concurrency: CONCURRENCY,
  invoke: async (index) => {
    const response = await fetch(`${baseUrl}/generate`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-tenant-id': 'perf-longrun',
        'idempotency-key': `longrun-${index}-${Date.now()}`
      },
      body: JSON.stringify(intake)
    });
    if (response.status !== 200) {
      throw new Error(`/generate returned ${response.status}`);
    }
  }
});

server.close();

const report = {
  generatedAt: new Date().toISOString(),
  config: {
    sampleSize: SAMPLE_SIZE,
    concurrency: CONCURRENCY,
    trendMaxDegradationRatio: TREND_MAX_DEGRADATION_RATIO,
    baselinePath
  },
  metrics: {
    validate: summarize(validateRuns),
    generate: summarize(generateRuns)
  }
};

const failures = [];
const baseline = await loadBaseline(baselinePath);
if (baseline) {
  checkTrend('validate', report.metrics.validate.p95Ms, baseline.metrics.validate.p95Ms, TREND_MAX_DEGRADATION_RATIO, failures);
  checkTrend('generate', report.metrics.generate.p95Ms, baseline.metrics.generate.p95Ms, TREND_MAX_DEGRADATION_RATIO, failures);
}

await mkdir('.tmp/perf', { recursive: true });
await writeFile('.tmp/perf/longrun.json', JSON.stringify(report, null, 2) + '\n', 'utf8');
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (failures.length > 0) {
  process.stderr.write(`Long-run trend validation failed:\n- ${failures.join('\n- ')}\n`);
  process.exitCode = 1;
}

async function runLoad({ sampleSize, concurrency, invoke }) {
  const durations = [];
  let counter = 0;

  async function worker() {
    while (counter < sampleSize) {
      const index = counter;
      counter += 1;
      const started = performance.now();
      await invoke(index);
      durations.push(Math.round(performance.now() - started));
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, concurrency) }, () => worker()));
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

async function loadBaseline(path) {
  try {
    return JSON.parse(await readFile(path, 'utf8'));
  } catch {
    return null;
  }
}

function checkTrend(name, currentP95, baselineP95, maxRatio, failures) {
  const allowed = Math.ceil(baselineP95 * maxRatio);
  if (currentP95 > allowed) {
    failures.push(`${name} p95 ${currentP95}ms exceeds allowed ${allowed}ms from baseline ${baselineP95}ms`);
  }
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

function readPositiveFloat(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
}
