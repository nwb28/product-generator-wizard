import { readFile } from 'node:fs/promises';

const isCli = process.argv[1] && process.argv[1].endsWith('/check-branch-protection.mjs');

if (isCli) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.protection || !args.required) {
    throw new Error('Usage: node tools/check-branch-protection.mjs --protection <json-path> --required <context-a,context-b>');
  }

  const payload = JSON.parse(await readFile(args.protection, 'utf8'));
  const required = args.required.split(',').map((value) => value.trim()).filter(Boolean);
  const result = checkRequiredContexts(payload, required);

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);

  if (!result.valid) {
    process.exitCode = 1;
  }
}

export function checkRequiredContexts(protection, requiredContexts) {
  const checks = protection.required_status_checks?.checks ?? [];
  const actualContexts = checks
    .map((entry) => entry.context)
    .filter(Boolean)
    .sort();

  const missing = requiredContexts
    .filter((context) => !actualContexts.includes(context))
    .sort();

  return {
    requiredContexts: [...requiredContexts].sort(),
    actualContexts,
    missing,
    valid: missing.length === 0
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--protection') {
      args.protection = argv[index + 1];
      index += 1;
    } else if (token === '--required') {
      args.required = argv[index + 1];
      index += 1;
    }
  }
  return args;
}
