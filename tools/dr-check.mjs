import { cp, mkdir, readFile, readdir, rm, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const intakePath = 'fixtures/golden/pilot-intake.json';
const sourceDir = '.tmp/dr/source';
const backupDir = '.tmp/dr/backup';
const restoreDir = '.tmp/dr/restore';

await rm('.tmp/dr', { recursive: true, force: true });
await mkdir(sourceDir, { recursive: true });
await mkdir(backupDir, { recursive: true });
await mkdir(restoreDir, { recursive: true });

const generate = spawnSync(
  process.execPath,
  ['tools/generator-cli/dist/index.js', 'generate', intakePath, '--out', sourceDir],
  { stdio: 'pipe', encoding: 'utf8' }
);

if (generate.status !== 0) {
  throw new Error(`Generation failed:\n${generate.stderr || generate.stdout}`);
}

await cp(sourceDir, backupDir, { recursive: true });
await cp(backupDir, restoreDir, { recursive: true });

const sourceHash = await hashTree(sourceDir);
const restoreHash = await hashTree(restoreDir);
if (sourceHash !== restoreHash) {
  throw new Error(`Backup/restore mismatch: source hash ${sourceHash} restore hash ${restoreHash}`);
}

for (const required of ['manifest.json', 'review/human-review.md', 'metadata/generation.json']) {
  const target = `${restoreDir}/${required}`;
  const targetStat = await stat(target).catch(() => null);
  if (!targetStat?.isFile()) {
    throw new Error(`Missing required restored artifact: ${required}`);
  }
}

process.stdout.write(
  `DR check passed. Deterministic hash preserved across backup/restore: ${sourceHash}\n`
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
