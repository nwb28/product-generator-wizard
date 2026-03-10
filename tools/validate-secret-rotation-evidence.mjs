import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--policy") {
      args.policy = argv[index + 1];
      index += 1;
    } else if (token === "--evidence") {
      args.evidence = argv[index + 1];
      index += 1;
    } else if (token === "--today") {
      args.today = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function toDate(input) {
  const date = new Date(input);
  return Number.isNaN(date.getTime()) ? null : date;
}

function ageDays(from, to) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((to.getTime() - from.getTime()) / msPerDay);
}

export function validateSecretRotationEvidence({ policy, evidence, today = new Date() }) {
  const errors = [];
  const required = new Set(policy.requiredSecrets ?? []);
  const map = new Map((evidence.secrets ?? []).map((item) => [item.name, item]));

  for (const secretName of required) {
    const record = map.get(secretName);
    if (!record) {
      errors.push(`Missing rotation evidence for secret ${secretName}.`);
      continue;
    }
    const rotatedAt = toDate(record.rotatedAt);
    if (!rotatedAt) {
      errors.push(`Invalid rotatedAt date for secret ${secretName}.`);
      continue;
    }
    const age = ageDays(rotatedAt, today);
    if (typeof policy.maxAgeDays === "number" && age > policy.maxAgeDays) {
      errors.push(`Secret ${secretName} is stale (${age} days > ${policy.maxAgeDays} days).`);
    }
    if (!record.owner) {
      errors.push(`Secret ${secretName} is missing owner attribution.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const policyPath = path.resolve(process.cwd(), args.policy ?? "config/secret-rotation-policy.json");
  const evidencePath = path.resolve(process.cwd(), args.evidence ?? "docs/governance/secret-rotation-evidence.json");
  const today = args.today ? toDate(args.today) : new Date();
  if (!today) {
    throw new Error("Invalid --today value.");
  }
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const evidence = JSON.parse(fs.readFileSync(evidencePath, "utf8"));
  const result = validateSecretRotationEvidence({ policy, evidence, today });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
