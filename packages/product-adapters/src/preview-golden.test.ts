import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { generateDeterministicPreviewArtifacts } from './preview-artifacts.js';

const previewSession = JSON.parse(
  readFileSync(resolve(process.cwd(), '../../fixtures/preview/pilot-preview-session.json'), 'utf8')
) as Record<string, unknown>;
const expected = JSON.parse(
  readFileSync(resolve(process.cwd(), '../../fixtures/preview/pilot-preview-expected.json'), 'utf8')
) as { deterministicHash: string; paths: string[] };

test('preview golden fixture keeps deterministic hash and file tree stable', () => {
  const output = generateDeterministicPreviewArtifacts(previewSession);

  assert.equal(output.deterministicHash, expected.deterministicHash);
  assert.deepEqual(
    output.files.map((entry) => entry.path),
    expected.paths
  );
});
