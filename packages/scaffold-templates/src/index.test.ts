import test from 'node:test';
import assert from 'node:assert/strict';
import intake from '@pgw/packages-contracts/dist/examples/intake.valid.v1.json' with { type: 'json' };
import { compileManifest } from '@pgw/packages-compiler/dist/index.js';
import { generatePilotScaffold } from './index.js';

test('generatePilotScaffold emits required MVP files', () => {
  const manifest = compileManifest(intake as any, '0.1.0');
  const output = generatePilotScaffold(manifest, '0.1.0');
  const paths = output.files.map((x) => x.path);

  assert.deepEqual(paths, [
    'docs/runbook.md',
    'manifest.json',
    'metadata/generation.json',
    'src/index.ts',
    'tests/contract.test.ts'
  ]);
});

test('generatePilotScaffold is deterministic for same input', () => {
  const manifest = compileManifest(intake as any, '0.1.0');
  const first = generatePilotScaffold(manifest, '0.1.0');
  const second = generatePilotScaffold(manifest, '0.1.0');

  assert.equal(first.deterministicHash, second.deterministicHash);
  assert.deepEqual(first.files, second.files);
});
