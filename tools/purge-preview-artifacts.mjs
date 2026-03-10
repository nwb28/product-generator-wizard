import { mkdir, readdir, rm, stat, utimes, writeFile } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';

const isCli = process.argv[1] && process.argv[1].endsWith('/purge-preview-artifacts.mjs');

if (isCli) {
  const args = parseArgs(process.argv.slice(2));
  const result = await purgePreviewArtifacts({
    root: args.root ?? '.tmp/preview-artifacts',
    retentionDays: Number(args.retentionDays ?? 30)
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

export async function purgePreviewArtifacts({ root, retentionDays }) {
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) {
    throw new Error('retentionDays must be a positive number.');
  }

  const resolvedRoot = resolve(process.cwd(), root);
  const cutoffEpochMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;

  const result = {
    root: resolvedRoot,
    retentionDays,
    cutoffIso: new Date(cutoffEpochMs).toISOString(),
    deletedFiles: [],
    deletedDirectories: [],
    scannedFileCount: 0
  };

  await walkAndPurge(resolvedRoot, cutoffEpochMs, result);
  return result;
}

async function walkAndPurge(path, cutoffEpochMs, result) {
  let entries;
  try {
    entries = await readdir(path, { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return;
    }
    throw error;
  }

  for (const entry of entries) {
    const fullPath = join(path, entry.name);
    if (entry.isDirectory()) {
      await walkAndPurge(fullPath, cutoffEpochMs, result);
      const remaining = await readdir(fullPath).catch(() => []);
      if (remaining.length === 0) {
        await rm(fullPath, { recursive: true, force: true });
        result.deletedDirectories.push(fullPath);
      }
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const details = await stat(fullPath);
    result.scannedFileCount += 1;

    if (details.mtimeMs < cutoffEpochMs) {
      await rm(fullPath, { force: true });
      result.deletedFiles.push(fullPath);
    }
  }
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--root') {
      args.root = argv[index + 1];
      index += 1;
    } else if (token === '--retention-days') {
      args.retentionDays = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

export async function seedPreviewArtifact(path, modifiedAt) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, '{}\n', 'utf8');
  await utimes(path, modifiedAt, modifiedAt);
}
