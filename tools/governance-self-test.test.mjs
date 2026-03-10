import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeResults } from './governance-self-test.mjs';

test('summarizeResults passes when all checks pass', () => {
  const report = summarizeResults([
    { name: 'a', pass: true },
    { name: 'b', pass: true }
  ]);

  assert.equal(report.pass, true);
});

test('summarizeResults fails when any check fails', () => {
  const report = summarizeResults([
    { name: 'a', pass: true },
    { name: 'b', pass: false }
  ]);

  assert.equal(report.pass, false);
});
