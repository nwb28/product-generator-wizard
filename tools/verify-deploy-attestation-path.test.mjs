import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verifyDeployAttestationPath } from './verify-deploy-attestation-path.mjs';

test('verifyDeployAttestationPath passes when required steps exist', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pgw-deploy-attest-'));
  const workflow = join(dir, 'deploy.yml');

  try {
    await writeFile(
      workflow,
      [
        'jobs:',
        '  preflight:',
        '    steps:',
        '      - name: Resolve latest release evidence run id',
        '      - name: Download release evidence artifact',
        '      - name: Verify release evidence attestation',
        '        run: gh attestation verify some-file --repo owner/repo'
      ].join('\n')
    );

    const result = await verifyDeployAttestationPath(workflow);
    assert.equal(result.valid, true);
    assert.deepEqual(result.missingSteps, []);
    assert.equal(result.verifyCommandPresent, true);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('verifyDeployAttestationPath fails when verification command is missing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pgw-deploy-attest-'));
  const workflow = join(dir, 'deploy.yml');

  try {
    await writeFile(
      workflow,
      [
        'jobs:',
        '  preflight:',
        '    steps:',
        '      - name: Resolve latest release evidence run id',
        '      - name: Download release evidence artifact',
        '      - name: Verify release evidence attestation',
        '        run: echo missing'
      ].join('\n')
    );

    const result = await verifyDeployAttestationPath(workflow);
    assert.equal(result.valid, false);
    assert.equal(result.verifyCommandPresent, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
