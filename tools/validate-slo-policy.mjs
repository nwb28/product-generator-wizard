import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--policy") {
      args.policy = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function isPositiveNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

export function validateSloPolicy(policy) {
  const errors = [];
  if (!isPositiveNumber(policy.windowDays)) {
    errors.push("windowDays must be a positive number.");
  }

  if (!isPositiveNumber(policy.availabilityTargetPercent) || policy.availabilityTargetPercent >= 100) {
    errors.push("availabilityTargetPercent must be > 0 and < 100.");
  }

  if (!isPositiveNumber(policy.errorBudgetPercent)) {
    errors.push("errorBudgetPercent must be a positive number.");
  }

  if (isPositiveNumber(policy.availabilityTargetPercent) && isPositiveNumber(policy.errorBudgetPercent)) {
    const budgetFromTarget = Number((100 - policy.availabilityTargetPercent).toFixed(6));
    const declaredBudget = Number(policy.errorBudgetPercent.toFixed(6));
    if (budgetFromTarget !== declaredBudget) {
      errors.push("errorBudgetPercent must equal (100 - availabilityTargetPercent).");
    }
  }

  if (!policy.latencyTargetsMs || typeof policy.latencyTargetsMs !== "object") {
    errors.push("latencyTargetsMs must be an object.");
  } else {
    for (const [endpoint, target] of Object.entries(policy.latencyTargetsMs)) {
      if (!endpoint.startsWith("/")) {
        errors.push(`latency target endpoint must start with '/': ${endpoint}`);
      }
      if (!isPositiveNumber(target)) {
        errors.push(`latency target for ${endpoint} must be a positive number.`);
      }
    }
  }

  for (const phase of ["fastBurn", "slowBurn"]) {
    const rule = policy[phase];
    if (!rule || typeof rule !== "object") {
      errors.push(`${phase} must be an object.`);
      continue;
    }
    if (!isPositiveNumber(rule.windowMinutes)) {
      errors.push(`${phase}.windowMinutes must be a positive number.`);
    }
    if (!isPositiveNumber(rule.maxErrorRatePercent) || rule.maxErrorRatePercent >= 100) {
      errors.push(`${phase}.maxErrorRatePercent must be > 0 and < 100.`);
    }
  }

  if (
    policy.fastBurn &&
    policy.slowBurn &&
    isPositiveNumber(policy.fastBurn.maxErrorRatePercent) &&
    isPositiveNumber(policy.slowBurn.maxErrorRatePercent) &&
    policy.fastBurn.maxErrorRatePercent <= policy.slowBurn.maxErrorRatePercent
  ) {
    errors.push("fastBurn.maxErrorRatePercent must be greater than slowBurn.maxErrorRatePercent.");
  }

  if (!Array.isArray(policy.trackedEndpoints) || policy.trackedEndpoints.length === 0) {
    errors.push("trackedEndpoints must be a non-empty array.");
  } else {
    const unique = new Set();
    for (const endpoint of policy.trackedEndpoints) {
      if (typeof endpoint !== "string" || !endpoint.startsWith("/")) {
        errors.push(`tracked endpoint must be a path starting with '/': ${String(endpoint)}`);
        continue;
      }
      if (unique.has(endpoint)) {
        errors.push(`tracked endpoint is duplicated: ${endpoint}`);
      }
      unique.add(endpoint);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const policyPath = path.resolve(process.cwd(), args.policy ?? "config/slo-policy.json");
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const result = validateSloPolicy(policy);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
