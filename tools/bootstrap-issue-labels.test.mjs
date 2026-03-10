import assert from 'node:assert/strict';
import test from 'node:test';
import { validateLabels } from './bootstrap-issue-labels.mjs';

test('validateLabels accepts valid payload', () => {
  assert.doesNotThrow(() =>
    validateLabels([
      { name: 'governance', color: '1D76DB' }
    ])
  );
});

test('validateLabels rejects missing required fields', () => {
  assert.throws(() => validateLabels([{ name: 'x' }]), /name and color/);
});
