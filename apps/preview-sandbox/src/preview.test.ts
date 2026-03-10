import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePreviewViews } from './preview.js';

test('normalizePreviewViews sorts views deterministically by id', () => {
  const ordered = normalizePreviewViews([
    { id: 'summary', title: 'Summary', payload: {} },
    { id: 'details', title: 'Details', payload: {} }
  ]);

  assert.deepEqual(
    ordered.map((entry) => entry.id),
    ['details', 'summary']
  );
});
