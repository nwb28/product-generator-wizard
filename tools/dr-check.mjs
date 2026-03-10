import { cp, mkdir, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const intakePath = 'fixtures/golden/pilot-intake.json';
const previewIntakePath = 'fixtures/preview/pilot-built-product-intake.json';
const sourceDir = '.tmp/dr/source';
const backupDir = '.tmp/dr/backup';
const restoreDir = '.tmp/dr/restore';
const previewSourceDir = '.tmp/dr/preview-source';
const previewBackupDir = '.tmp/dr/preview-backup';
const previewRestoreDir = '.tmp/dr/preview-restore';

await rm('.tmp/dr', { recursive: true, force: true });
await rm('.tmp/preview-gate', { recursive: true, force: true });
await mkdir(sourceDir, { recursive: true });
await mkdir(backupDir, { recursive: true });
await mkdir(restoreDir, { recursive: true });
await mkdir(previewSourceDir, { recursive: true });
await mkdir(previewBackupDir, { recursive: true });
await mkdir(previewRestoreDir, { recursive: true });

// Core generator DR flow.
runNodeScript(['tools/generator-cli/dist/index.js', 'generate', intakePath, '--out', sourceDir], 'Generation failed');
await cp(sourceDir, backupDir, { recursive: true });
await cp(backupDir, restoreDir, { recursive: true });

const sourceHash = await hashTree(sourceDir);
const restoreHash = await hashTree(restoreDir);
if (sourceHash !== restoreHash) {
  throw new Error(`Backup/restore mismatch: source hash ${sourceHash} restore hash ${restoreHash}`);
}

for (const required of ['manifest.json', 'review/human-review.md', 'metadata/generation.json']) {
  await assertFileExists(`${restoreDir}/${required}`, `Missing required restored artifact: ${required}`);
}

// Preview evidence DR flow.
runNodeScript(['tools/preview-contract-gate.mjs', previewIntakePath], 'Preview gate generation failed');

const syntheticSbomPath = '.tmp/dr/synthetic-sbom.json';
const syntheticAuditPath = '.tmp/dr/synthetic-audit.json';
await writeFile(
  syntheticSbomPath,
  JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.6', version: 1, metadata: { component: { name: 'product-generator-wizard' } } }, null, 2) + '\n',
  'utf8'
);
await writeFile(
  syntheticAuditPath,
  JSON.stringify({ metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 0, low: 0, info: 0 } } }, null, 2) + '\n',
  'utf8'
);

runNodeScript(
  [
    'tools/bundle-release-evidence.mjs',
    '--preview',
    '.tmp/preview-gate/report.json',
    '--sbom',
    syntheticSbomPath,
    '--audit',
    syntheticAuditPath,
    '--out',
    previewSourceDir
  ],
  'Preview evidence bundle generation failed'
);

await cp(previewSourceDir, previewBackupDir, { recursive: true });
await cp(previewBackupDir, previewRestoreDir, { recursive: true });

const previewSourceHash = await hashTree(previewSourceDir);
const previewRestoreHash = await hashTree(previewRestoreDir);
if (previewSourceHash !== previewRestoreHash) {
  throw new Error(`Preview backup/restore mismatch: source hash ${previewSourceHash} restore hash ${previewRestoreHash}`);
}

for (const required of ['release-evidence.json', 'release-evidence.md', 'raw/report.json']) {
  await assertFileExists(`${previewRestoreDir}/${required}`, `Missing required restored preview artifact: ${required}`);
}

const previewSummary = {
  sourceHash: previewSourceHash,
  restoreHash: previewRestoreHash,
  pass: previewSourceHash === previewRestoreHash
};
await writeFile('.tmp/dr/preview-check.json', JSON.stringify(previewSummary, null, 2) + '\n', 'utf8');

await rm('.tmp/preview-gate', { recursive: true, force: true });

process.stdout.write(
  `DR check passed. Deterministic hash preserved across backup/restore: ${sourceHash}. Preview evidence hash: ${previewSourceHash}\n`
);

async function hashTree(root) {
  const files = await collectFiles(root);
  const hasher = createHash('sha256');

  for (const file of files.sort()) {
    const content = await readFile(file);
    hasher.update(file.replace(`${root}/`, ''));
    hasher.update('\n');
    hasher.update(content);
    hasher.update('\n');
  }

  return hasher.digest('hex');
}

async function collectFiles(root) {
  const results = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = `${root}/${entry.name}`;
    if (entry.isDirectory()) {
      results.push(...(await collectFiles(fullPath)));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}

async function assertFileExists(path, message) {
  const targetStat = await stat(path).catch(() => null);
  if (!targetStat?.isFile()) {
    throw new Error(message);
  }
}

function runNodeScript(args, message) {
  const result = spawnSync(process.execPath, args, { stdio: 'pipe', encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${message}:\n${result.stderr || result.stdout}`);
  }
}
