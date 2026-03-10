import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDeterministicPreviewArtifacts } from './preview-artifacts.js';

const previewSession = {
  sessionId: 'session-1',
  tenantId: 'tenant-a',
  productId: 'product-a',
  views: [
    { id: 'summary', title: 'Summary', payload: { order: 2 } },
    { id: 'details', title: 'Details', payload: { order: 1 } }
  ]
};

test('generateDeterministicPreviewArtifacts emits stable file order', () => {
  const output = generateDeterministicPreviewArtifacts(previewSession);
  assert.deepEqual(
    output.files.map((entry) => entry.path),
    ['preview/metadata/session.json', 'preview/views/details.json', 'preview/views/summary.json']
  );
});

test('generateDeterministicPreviewArtifacts returns stable hash for same input', () => {
  const first = generateDeterministicPreviewArtifacts(previewSession);
  const second = generateDeterministicPreviewArtifacts(previewSession);
  assert.equal(first.deterministicHash, second.deterministicHash);
});
