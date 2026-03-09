import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import intake from '@pgw/packages-contracts/dist/examples/intake.valid.v1.json' with { type: 'json' };
import { runCli } from './index.js';

test('wizard validate exits 0 for valid intake', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'wizard-cli-'));
  const intakePath = path.join(tmp, 'intake.json');
  await writeFile(intakePath, JSON.stringify(intake, null, 2), 'utf8');

  const logs: string[] = [];
  const exitCode = await runCli(['validate', intakePath], {
    log: (m) => logs.push(m),
    error: (m) => logs.push(m)
  });

  assert.equal(exitCode, 0);
  assert.ok(logs.some((x) => x.includes('Blocking: 0')));
});

test('wizard generate writes scaffold files', async () => {
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'wizard-cli-'));
  const intakePath = path.join(tmp, 'intake.json');
  const outDir = path.join(tmp, 'out');
  await writeFile(intakePath, JSON.stringify(intake, null, 2), 'utf8');

  const exitCode = await runCli(['generate', intakePath, '--out', outDir], {
    log: () => undefined,
    error: () => undefined
  });

  assert.equal(exitCode, 0);
  const manifest = await readFile(path.join(outDir, 'manifest.json'), 'utf8');
  assert.match(manifest, /"schemaVersion":"1.0.0"/);
});

test('wizard ci-check exits 1 for invalid intake', async () => {
  const invalid = structuredClone(intake) as any;
  invalid.permissions.bucs = [];

  const tmp = await mkdtemp(path.join(os.tmpdir(), 'wizard-cli-'));
  const intakePath = path.join(tmp, 'intake.invalid.json');
  await writeFile(intakePath, JSON.stringify(invalid, null, 2), 'utf8');

  const exitCode = await runCli(['ci-check', intakePath], {
    log: () => undefined,
    error: () => undefined
  });

  assert.equal(exitCode, 1);
});
