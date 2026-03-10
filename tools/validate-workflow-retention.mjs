import { readdir, readFile } from 'node:fs/promises';
import { resolve, basename, join } from 'node:path';
import yaml from 'yaml';

const isCli = process.argv[1] && process.argv[1].endsWith('/validate-workflow-retention.mjs');

if (isCli) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.policy || !args.workflows) {
    throw new Error('Usage: node tools/validate-workflow-retention.mjs --policy <json-path> --workflows <dir>');
  }

  const result = await validateWorkflowRetentionPolicy({
    policyPath: args.policy,
    workflowsDir: args.workflows
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (!result.valid) {
    process.exitCode = 1;
  }
}

export async function validateWorkflowRetentionPolicy({ policyPath, workflowsDir }) {
  const resolvedPolicy = resolve(process.cwd(), policyPath);
  const resolvedWorkflows = resolve(process.cwd(), workflowsDir);

  const policy = JSON.parse(await readFile(resolvedPolicy, 'utf8'));
  const workflowFiles = (await readdir(resolvedWorkflows)).filter((file) => file.endsWith('.yml') || file.endsWith('.yaml'));

  const violations = [];
  const checked = [];

  for (const file of workflowFiles) {
    const source = await readFile(join(resolvedWorkflows, file), 'utf8');
    const document = yaml.parse(source) ?? {};
    const jobs = document.jobs ?? {};

    for (const [, job] of Object.entries(jobs)) {
      const steps = job.steps ?? [];
      for (const step of steps) {
        if (step.uses !== 'actions/upload-artifact@v4') {
          continue;
        }

        const artifactName = step.with?.name;
        const retentionDays = step.with?.['retention-days'];
        if (!artifactName) {
          continue;
        }

        const expected = resolveExpectedRetention(policy, file, artifactName);
        checked.push({ workflow: file, artifact: artifactName, actual: Number(retentionDays), expected });

        if (!Number.isFinite(Number(retentionDays))) {
          violations.push({
            workflow: file,
            artifact: artifactName,
            expected,
            actual: retentionDays,
            message: 'retention-days is missing or not numeric'
          });
          continue;
        }

        if (Number(retentionDays) !== expected) {
          violations.push({
            workflow: file,
            artifact: artifactName,
            expected,
            actual: Number(retentionDays),
            message: 'retention-days does not match policy'
          });
        }
      }
    }
  }

  return {
    valid: violations.length === 0,
    checkedCount: checked.length,
    violations,
    checked
  };
}

export function resolveExpectedRetention(policy, workflowFile, artifactName) {
  const matchedRule = (policy.rules ?? []).find((rule) => rule.workflow === basename(workflowFile) && wildcardMatch(rule.artifact, artifactName));
  if (matchedRule) {
    return Number(matchedRule.retentionDays);
  }
  return Number(policy.defaults?.retentionDays ?? 30);
}

function wildcardMatch(pattern, value) {
  const regex = new RegExp(`^${pattern.replace(/[.+?^${}()|[\\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`);
  return regex.test(value);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--policy') {
      args.policy = argv[index + 1];
      index += 1;
    } else if (token === '--workflows') {
      args.workflows = argv[index + 1];
      index += 1;
    }
  }
  return args;
}
