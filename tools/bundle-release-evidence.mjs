import { createHash } from 'node:crypto';
import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const isCli = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);

if (isCli) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.preview || !args.sbom || !args.audit) {
    throw new Error('Usage: node tools/bundle-release-evidence.mjs --preview <path> --sbom <path> --audit <path> [--out <dir>]');
  }

  const evidence = await generateReleaseEvidenceBundle({
    previewPath: args.preview,
    sbomPath: args.sbom,
    auditPath: args.audit,
    outDir: args.out ?? '.tmp/release-evidence'
  });

  process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
}

export async function generateReleaseEvidenceBundle({ previewPath, sbomPath, auditPath, outDir }) {
  const resolvedOutDir = resolve(process.cwd(), outDir);
  const resolvedPreview = resolve(process.cwd(), previewPath);
  const resolvedSbom = resolve(process.cwd(), sbomPath);
  const resolvedAudit = resolve(process.cwd(), auditPath);

  const preview = await readJson(resolvedPreview);
  const sbom = await readJson(resolvedSbom);
  const audit = await readJson(resolvedAudit);

  const securitySummary = summarizeAudit(audit);

  const bundle = {
    schemaVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    previewContractGate: {
      passed: Boolean(preview.passed),
      recommendation: preview.recommendation ?? 'No-Go',
      blocking: preview.blocking ?? null,
      warning: preview.warning ?? null,
      deterministicHash: preview.deterministicHash ?? null,
      fixture: preview.fixture ?? null
    },
    sbom: {
      bomFormat: sbom.bomFormat ?? null,
      specVersion: sbom.specVersion ?? null,
      version: sbom.version ?? null,
      component: sbom.metadata?.component?.name ?? null,
      serialNumber: sbom.serialNumber ?? null
    },
    securityScan: securitySummary,
    overall: {
      passed: Boolean(preview.passed) && securitySummary.gatePassed,
      recommendation: Boolean(preview.passed) && securitySummary.gatePassed ? 'Go' : 'No-Go'
    }
  };

  await mkdir(resolvedOutDir, { recursive: true });
  await mkdir(resolve(resolvedOutDir, 'raw'), { recursive: true });

  await cp(resolvedPreview, resolve(resolvedOutDir, 'raw', basename(resolvedPreview)));
  await cp(resolvedSbom, resolve(resolvedOutDir, 'raw', basename(resolvedSbom)));
  await cp(resolvedAudit, resolve(resolvedOutDir, 'raw', basename(resolvedAudit)));

  const manifestPath = resolve(resolvedOutDir, 'release-evidence.json');
  const summaryPath = resolve(resolvedOutDir, 'release-evidence.md');

  await writeFile(manifestPath, JSON.stringify(bundle, null, 2) + '\n', 'utf8');
  await writeFile(summaryPath, renderMarkdown(bundle), 'utf8');

  const bundleHash = createHash('sha256')
    .update(await readFile(manifestPath, 'utf8'))
    .update(await readFile(summaryPath, 'utf8'))
    .digest('hex');

  const withHash = {
    ...bundle,
    bundleHash
  };

  await writeFile(manifestPath, JSON.stringify(withHash, null, 2) + '\n', 'utf8');
  await writeFile(summaryPath, renderMarkdown(withHash), 'utf8');

  return withHash;
}

function summarizeAudit(report) {
  const vulnerabilities = report.metadata?.vulnerabilities ?? report.vulnerabilities ?? {};
  const critical = Number(vulnerabilities.critical ?? 0);
  const high = Number(vulnerabilities.high ?? 0);
  const moderate = Number(vulnerabilities.moderate ?? 0);
  const low = Number(vulnerabilities.low ?? 0);
  const info = Number(vulnerabilities.info ?? 0);

  return {
    critical,
    high,
    moderate,
    low,
    info,
    gatePassed: critical === 0 && high === 0
  };
}

function renderMarkdown(bundle) {
  return [
    '# Release Evidence Bundle',
    '',
    `- Generated at: ${bundle.generatedAt}`,
    `- Overall recommendation: ${bundle.overall.recommendation}`,
    `- Overall passed: ${bundle.overall.passed ? 'true' : 'false'}`,
    `- Bundle hash: ${bundle.bundleHash ?? 'pending'}`,
    '',
    '## Preview Contract Gate',
    `- Passed: ${bundle.previewContractGate.passed ? 'true' : 'false'}`,
    `- Recommendation: ${bundle.previewContractGate.recommendation}`,
    `- Blocking diagnostics: ${bundle.previewContractGate.blocking ?? 'n/a'}`,
    `- Warning diagnostics: ${bundle.previewContractGate.warning ?? 'n/a'}`,
    `- Deterministic hash: ${bundle.previewContractGate.deterministicHash ?? 'n/a'}`,
    '',
    '## SBOM',
    `- Format: ${bundle.sbom.bomFormat ?? 'n/a'}`,
    `- Spec version: ${bundle.sbom.specVersion ?? 'n/a'}`,
    `- Component: ${bundle.sbom.component ?? 'n/a'}`,
    '',
    '## Security Scan',
    `- Critical: ${bundle.securityScan.critical}`,
    `- High: ${bundle.securityScan.high}`,
    `- Moderate: ${bundle.securityScan.moderate}`,
    `- Low: ${bundle.securityScan.low}`,
    `- Info: ${bundle.securityScan.info}`,
    `- Gate passed (critical/high == 0): ${bundle.securityScan.gatePassed ? 'true' : 'false'}`,
    ''
  ].join('\n');
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--preview') {
      args.preview = argv[i + 1];
      i += 1;
    } else if (token === '--sbom') {
      args.sbom = argv[i + 1];
      i += 1;
    } else if (token === '--audit') {
      args.audit = argv[i + 1];
      i += 1;
    } else if (token === '--out') {
      args.out = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

async function readJson(path) {
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}
