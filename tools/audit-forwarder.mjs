import { readFile, mkdir, writeFile } from 'node:fs/promises';

const sourcePath = process.env.WIZARD_AUDIT_LOG_PATH ?? '.tmp/audit/audit.ndjson';
const statePath = process.env.WIZARD_AUDIT_FORWARDER_STATE_PATH ?? '.tmp/audit/forwarder-state.json';
const endpoint = process.env.WIZARD_AUDIT_FORWARDER_ENDPOINT ?? '';
const authToken = process.env.WIZARD_AUDIT_FORWARDER_TOKEN ?? '';
const batchSize = readPositiveInt(process.env.WIZARD_AUDIT_FORWARDER_BATCH_SIZE, 100);
const maxRetries = readPositiveInt(process.env.WIZARD_AUDIT_FORWARDER_MAX_RETRIES, 5);
const baseBackoffMs = readPositiveInt(process.env.WIZARD_AUDIT_FORWARDER_BASE_BACKOFF_MS, 500);
const dryRun = process.argv.includes('--dry-run') || process.env.WIZARD_AUDIT_FORWARDER_DRY_RUN === 'true';

const lines = await readLines(sourcePath);
const state = await readState(statePath);
const startOffset = Math.max(0, Math.min(state.offset, lines.length));
const pending = lines.slice(startOffset);

if (pending.length === 0) {
  process.stdout.write('No audit records pending forward.\n');
  process.exit(0);
}

const records = pending.map((line, index) => {
  try {
    return JSON.parse(line);
  } catch (error) {
    throw new Error(`Invalid JSON at line ${startOffset + index + 1}: ${asMessage(error)}`);
  }
});

if (!dryRun && !endpoint) {
  throw new Error('WIZARD_AUDIT_FORWARDER_ENDPOINT must be set unless --dry-run is used.');
}

for (let i = 0; i < records.length; i += batchSize) {
  const batch = records.slice(i, i + batchSize);
  if (dryRun) {
    process.stdout.write(`Dry run: would forward batch ${i / batchSize + 1} containing ${batch.length} records.\n`);
    continue;
  }
  await forwardBatchWithRetry(batch, {
    endpoint,
    authToken,
    maxRetries,
    baseBackoffMs
  });
}

await writeState(statePath, { offset: lines.length });
process.stdout.write(`Forwarded ${records.length} audit records.\n`);

async function readLines(path) {
  const content = await readFile(path, 'utf8');
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

async function readState(path) {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw);
    return { offset: typeof parsed.offset === 'number' ? parsed.offset : 0 };
  } catch {
    return { offset: 0 };
  }
}

async function writeState(path, state) {
  const directory = path.split('/').slice(0, -1).join('/') || '.';
  await mkdir(directory, { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

async function forwardBatchWithRetry(batch, options) {
  for (let attempt = 1; attempt <= options.maxRetries; attempt += 1) {
    try {
      const response = await fetch(options.endpoint, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(options.authToken ? { authorization: `Bearer ${options.authToken}` } : {})
        },
        body: JSON.stringify({ records: batch })
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return;
    } catch (error) {
      if (attempt === options.maxRetries) {
        throw new Error(`Audit forwarder failed after ${attempt} attempts: ${asMessage(error)}`);
      }
      const backoff = options.baseBackoffMs * 2 ** (attempt - 1);
      await delay(backoff);
    }
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readPositiveInt(raw, fallback) {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

function asMessage(error) {
  return error instanceof Error ? error.message : String(error);
}
