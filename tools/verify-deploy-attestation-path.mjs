import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import yaml from 'yaml';

const REQUIRED_STEP_NAMES = [
  'Resolve latest release evidence run id',
  'Download release evidence artifact',
  'Verify release evidence attestation'
];

const REQUIRED_VERIFY_SNIPPET = 'gh attestation verify';

const isCli = process.argv[1] && process.argv[1].endsWith('/verify-deploy-attestation-path.mjs');

if (isCli) {
  const args = parseArgs(process.argv.slice(2));
  const workflowPath = args.workflow ?? '.github/workflows/deploy.yml';
  const result = await verifyDeployAttestationPath(workflowPath);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

export async function verifyDeployAttestationPath(workflowPath) {
  const source = await readFile(resolve(process.cwd(), workflowPath), 'utf8');
  const doc = yaml.parse(source) ?? {};
  const steps = (doc.jobs?.preflight?.steps ?? []);

  const stepNames = steps.map((step) => step.name).filter(Boolean);
  const missing = REQUIRED_STEP_NAMES.filter((required) => !stepNames.includes(required));

  const verifyStep = steps.find((step) => step.name === 'Verify release evidence attestation');
  const verifyHasCommand = typeof verifyStep?.run === 'string' && verifyStep.run.includes(REQUIRED_VERIFY_SNIPPET);

  return {
    valid: missing.length === 0 && verifyHasCommand,
    missingSteps: missing,
    verifyCommandPresent: verifyHasCommand
  };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--workflow') {
      args.workflow = argv[i + 1];
      i += 1;
    }
  }
  return args;
}
