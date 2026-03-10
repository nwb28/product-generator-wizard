import assert from 'node:assert/strict';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { purgePreviewArtifacts, seedPreviewArtifact } from './purge-preview-artifacts.mjs';

test('purgePreviewArtifacts removes files older than retention window', async () => {
  const root = await mkdtemp(join(tmpdir(), 'pgw-preview-purge-'));
  const oldFile = join(root, 'old', 'artifact.json');
  const newFile = join(root, 'new', 'artifact.json');

  try {
    await seedPreviewArtifact(oldFile, new Date(Date.now() - 40 * 24 * 60 * 60 * 1000));
    await seedPreviewArtifact(newFile, new Date());

    const result = await purgePreviewArtifacts({ root, retentionDays: 30 });

    assert.equal(result.deletedFiles.length, 1);
    assert.ok(result.deletedFiles[0].endsWith('old/artifact.json'));

    const remainingRootEntries = await readdir(root);
    assert.deepEqual(remainingRootEntries, ['new']);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('purgePreviewArtifacts validates retentionDays input', async () => {
  await assert.rejects(
    () => purgePreviewArtifacts({ root: '/tmp/anything', retentionDays: 0 }),
    /retentionDays must be a positive number/ 
  );
});
