import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { exportControlEvidence } from './export-control-evidence.mjs';

test('exportControlEvidence writes manifest and summary', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pgw-control-evidence-'));
  const cwd = process.cwd();

  try {
    process.chdir(dir);
    await mkdir('docs/governance', { recursive: true });
    await mkdir('docs/operations', { recursive: true });
    await mkdir('config', { recursive: true });
    await mkdir('.github', { recursive: true });

    const required = [
      'docs/governance/compliance-package.md',
      'docs/governance/soc2-control-matrix.md',
      'docs/governance/remediation-tracker.md',
      'docs/governance/pre-inclusion-policy.md',
      'docs/governance/preview-threat-model.md',
      'docs/operations/operations-log.md',
      'docs/operations/disaster-recovery-runbook.md',
      'config/branch-protection-baseline.json',
      'config/artifact-retention-policy.json',
      '.github/CODEOWNERS'
    ];

    for (const path of required) {
      await writeFile(path, 'test\n', 'utf8');
    }

    const originalSha = process.env.CONTROL_EVIDENCE_GIT_SHA;
    process.env.CONTROL_EVIDENCE_GIT_SHA = 'deadbeef';

    const result = await exportControlEvidence({ outDir: '.tmp/control-evidence', includes: [] });
    const manifest = JSON.parse(await readFile(result.manifestPath, 'utf8'));
    const summary = await readFile(result.summaryPath, 'utf8');

    assert.equal(manifest.sources.length, 10);
    assert.equal(manifest.gitSha, 'deadbeef');
    assert.ok(summary.includes('# Control Evidence Package'));
    process.env.CONTROL_EVIDENCE_GIT_SHA = originalSha;
  } finally {
    process.chdir(cwd);
    await rm(dir, { recursive: true, force: true });
  }
});
