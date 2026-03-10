import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--policy") {
      args.policy = argv[index + 1];
      index += 1;
    } else if (token === "--report") {
      args.report = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

export function validatePerfReport({ policy, report }) {
  const errors = [];
  const longrunPolicy = policy.longrun ?? {};
  const validateP95 = report?.metrics?.validate?.p95Ms;
  const generateP95 = report?.metrics?.generate?.p95Ms;

  if (typeof validateP95 !== "number") {
    errors.push("report.metrics.validate.p95Ms is required.");
  } else if (typeof longrunPolicy.validateP95MaxMs === "number" && validateP95 > longrunPolicy.validateP95MaxMs) {
    errors.push(`validate p95 ${validateP95}ms exceeds ${longrunPolicy.validateP95MaxMs}ms.`);
  }

  if (typeof generateP95 !== "number") {
    errors.push("report.metrics.generate.p95Ms is required.");
  } else if (typeof longrunPolicy.generateP95MaxMs === "number" && generateP95 > longrunPolicy.generateP95MaxMs) {
    errors.push(`generate p95 ${generateP95}ms exceeds ${longrunPolicy.generateP95MaxMs}ms.`);
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const policyPath = path.resolve(process.cwd(), args.policy ?? "config/perf-load-policy.json");
  const reportPath = path.resolve(process.cwd(), args.report ?? ".tmp/perf/longrun.json");
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
  const result = validatePerfReport({ policy, report });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
