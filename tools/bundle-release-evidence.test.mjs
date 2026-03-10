import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { generateReleaseEvidenceBundle } from './bundle-release-evidence.mjs';

test('generateReleaseEvidenceBundle marks Go when preview and security gates pass', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pgw-release-evidence-'));
  try {
    const previewPath = join(dir, 'preview-report.json');
    const sbomPath = join(dir, 'sbom.cdx.json');
    const auditPath = join(dir, 'npm-audit-report.json');
    const outDir = join(dir, 'bundle');

    await writeFile(
      previewPath,
      JSON.stringify({ passed: true, recommendation: 'Go', blocking: 0, warning: 0, deterministicHash: 'abc123', fixture: 'fixture.json' })
    );
    await writeFile(
      sbomPath,
      JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.6', version: 1, metadata: { component: { name: 'product-generator-wizard' } } })
    );
    await writeFile(
      auditPath,
      JSON.stringify({ metadata: { vulnerabilities: { critical: 0, high: 0, moderate: 1, low: 0, info: 0 } } })
    );

    const bundle = await generateReleaseEvidenceBundle({
      previewPath,
      sbomPath,
      auditPath,
      outDir
    });

    assert.equal(bundle.overall.recommendation, 'Go');
    assert.equal(bundle.overall.passed, true);

    const manifest = JSON.parse(await readFile(join(outDir, 'release-evidence.json'), 'utf8'));
    assert.equal(manifest.overall.recommendation, 'Go');
    assert.equal(typeof manifest.bundleHash, 'string');
    assert.ok(manifest.bundleHash.length > 0);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('generateReleaseEvidenceBundle marks No-Go when high vulnerabilities exist', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pgw-release-evidence-'));
  try {
    const previewPath = join(dir, 'preview-report.json');
    const sbomPath = join(dir, 'sbom.cdx.json');
    const auditPath = join(dir, 'npm-audit-report.json');
    const outDir = join(dir, 'bundle');

    await writeFile(previewPath, JSON.stringify({ passed: true, recommendation: 'Go' }));
    await writeFile(sbomPath, JSON.stringify({ bomFormat: 'CycloneDX', specVersion: '1.6', version: 1 }));
    await writeFile(auditPath, JSON.stringify({ metadata: { vulnerabilities: { critical: 0, high: 1, moderate: 0, low: 0, info: 0 } } }));

    const bundle = await generateReleaseEvidenceBundle({
      previewPath,
      sbomPath,
      auditPath,
      outDir
    });

    assert.equal(bundle.securityScan.gatePassed, false);
    assert.equal(bundle.overall.recommendation, 'No-Go');
    assert.equal(bundle.overall.passed, false);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
