import { cp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, basename } from 'node:path';
import { execSync } from 'node:child_process';

const DEFAULT_SOURCES = [
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

const isCli = process.argv[1] && process.argv[1].endsWith('/export-control-evidence.mjs');

if (isCli) {
  const args = parseArgs(process.argv.slice(2));
  const outDir = args.out ?? '.tmp/control-evidence';
  const includes = args.include ?? [];
  const result = await exportControlEvidence({ outDir, includes });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

export async function exportControlEvidence({ outDir, includes }) {
  const root = process.cwd();
  const outputRoot = resolve(root, outDir);
  const evidenceDir = resolve(outputRoot, 'evidence');

  await mkdir(evidenceDir, { recursive: true });

  const copied = [];
  for (const source of [...DEFAULT_SOURCES, ...includes]) {
    const from = resolve(root, source);
    const to = resolve(evidenceDir, basename(source));
    await cp(from, to, { recursive: false });
    copied.push({ source, target: to });
  }

  const gitSha = process.env.CONTROL_EVIDENCE_GIT_SHA ?? execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
  const generatedAt = new Date().toISOString();

  const manifest = {
    generatedAt,
    gitSha,
    sources: copied.map((item) => item.source),
    workflows: [
      'generator-contract-gate',
      'preview-contract-gate',
      'release-evidence-bundle',
      'security-scan',
      'sbom',
      'dr-drill',
      'branch-protection-governance',
      'retention-observability'
    ]
  };

  await writeFile(resolve(outputRoot, 'control-evidence-manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  await writeFile(resolve(outputRoot, 'control-evidence-summary.md'), renderSummary(manifest), 'utf8');

  return {
    outDir: outputRoot,
    manifestPath: resolve(outputRoot, 'control-evidence-manifest.json'),
    summaryPath: resolve(outputRoot, 'control-evidence-summary.md'),
    copiedCount: copied.length
  };
}

function renderSummary(manifest) {
  return [
    '# Control Evidence Package',
    '',
    `- Generated at: ${manifest.generatedAt}`,
    `- Commit: ${manifest.gitSha}`,
    '',
    '## Included Sources',
    ...manifest.sources.map((source) => `- ${source}`),
    '',
    '## Referenced Workflows',
    ...manifest.workflows.map((workflow) => `- ${workflow}`),
    ''
  ].join('\n');
}

function parseArgs(argv) {
  const args = { include: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--out') {
      args.out = argv[i + 1];
      i += 1;
    } else if (token === '--include') {
      args.include.push(argv[i + 1]);
      i += 1;
    }
  }
  return args;
}
