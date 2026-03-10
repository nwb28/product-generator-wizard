import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const isCli = process.argv[1] && process.argv[1].endsWith('/governance-self-test.mjs');

if (isCli) {
  const args = parseArgs(process.argv.slice(2));
  const outDir = args.out ?? '.tmp/governance-self-test';
  const protectionJson = args.protection ?? '.tmp/main-branch-protection.json';

  const report = await runGovernanceSelfTest({ outDir, protectionJson });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

  if (!report.pass) {
    process.exitCode = 1;
  }
}

export async function runGovernanceSelfTest({ outDir, protectionJson }) {
  const outputRoot = resolve(process.cwd(), outDir);
  await mkdir(outputRoot, { recursive: true });

  const checks = [];

  checks.push(runCheck('branch-protection-policy', `node tools/check-branch-protection.mjs --protection ${protectionJson} --required bootstrap,contract-gate,preview-contract-gate,security-scan,release-evidence-bundle`));
  checks.push(runCheck('codeowners-render', 'node tools/render-codeowners.mjs --check'));
  checks.push(runCheck('deploy-attestation-path', 'node tools/verify-deploy-attestation-path.mjs --workflow .github/workflows/deploy.yml'));
  checks.push(runCheck('workflow-retention-policy', 'node tools/validate-workflow-retention.mjs --policy config/artifact-retention-policy.json --workflows .github/workflows'));
  checks.push(runCheck('retention-purge-freshness', 'node tools/check-retention-purge-slo.mjs --runs-json .tmp/retention-runs.sample.json --max-age-hours 26 --now 2026-03-10T12:00:00.000Z'));

  const results = await Promise.all(checks);
  const report = summarizeResults(results);

  await writeFile(resolve(outputRoot, 'governance-self-test.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');
  await writeFile(resolve(outputRoot, 'governance-self-test.md'), renderMarkdown(report), 'utf8');

  return report;
}

export function summarizeResults(results) {
  return {
    generatedAt: new Date().toISOString(),
    pass: results.every((result) => result.pass),
    checks: results
  };
}

function renderMarkdown(report) {
  return [
    '# Governance Self-Test Report',
    '',
    `- Generated at: ${report.generatedAt}`,
    `- Overall pass: ${report.pass ? 'true' : 'false'}`,
    '',
    '## Check Results',
    ...report.checks.map((check) => `- ${check.name}: ${check.pass ? 'pass' : 'fail'}`),
    ''
  ].join('\n');
}

async function runCheck(name, command) {
  try {
    execSync(command, { stdio: 'pipe', encoding: 'utf8' });
    return { name, pass: true };
  } catch (error) {
    return { name, pass: false, detail: String(error?.message ?? error) };
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--out') {
      args.out = argv[i + 1];
      i += 1;
    } else if (token === '--protection') {
      args.protection = argv[i + 1];
      i += 1;
    }
  }
  return args;
}
