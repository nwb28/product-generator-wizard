import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--policy") {
      args.policy = argv[index + 1];
      index += 1;
    } else if (token === "--event") {
      args.event = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

export function validatePrCompliance({ policy, eventPayload }) {
  const errors = [];
  const pr = eventPayload.pull_request;
  if (!pr) {
    return {
      valid: true,
      errors: []
    };
  }

  const labelNames = new Set((pr.labels ?? []).map((label) => String(label.name).toLowerCase()));
  for (const requiredLabel of policy.requiredLabels ?? []) {
    if (!labelNames.has(String(requiredLabel).toLowerCase())) {
      errors.push(`Missing required PR label '${requiredLabel}'.`);
    }
  }

  const body = String(pr.body ?? "").toLowerCase();
  for (const pattern of policy.requiredChecklistPatterns ?? []) {
    if (!body.includes(String(pattern).toLowerCase())) {
      errors.push(`PR description checklist is missing '${pattern}'.`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const policyPath = path.resolve(process.cwd(), args.policy ?? "config/pr-compliance-policy.json");
  const eventPath = path.resolve(process.cwd(), args.event ?? process.env.GITHUB_EVENT_PATH ?? "");
  if (!eventPath) {
    throw new Error("Missing --event path and GITHUB_EVENT_PATH.");
  }

  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const eventPayload = JSON.parse(fs.readFileSync(eventPath, "utf8"));
  const result = validatePrCompliance({ policy, eventPayload });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
