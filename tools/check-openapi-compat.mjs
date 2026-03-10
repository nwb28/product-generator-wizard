import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--openapi") {
      args.openapi = argv[index + 1];
      index += 1;
    } else if (token === "--policy") {
      args.policy = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

export function checkOpenApiCompatibility({ openapiDocument, policy }) {
  const operations = new Set();
  const paths = openapiDocument.paths ?? {};

  for (const [route, methods] of Object.entries(paths)) {
    if (!methods || typeof methods !== "object") {
      continue;
    }
    for (const method of Object.keys(methods)) {
      operations.add(`${method.toLowerCase()} ${route}`);
    }
  }

  const missing = [];
  for (const operation of policy.requiredOperations ?? []) {
    const key = `${String(operation.method).toLowerCase()} ${operation.path}`;
    if (!operations.has(key)) {
      missing.push(key);
    }
  }

  return {
    valid: missing.length === 0,
    missingOperations: missing
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const openapiPath = path.resolve(process.cwd(), args.openapi ?? "docs/api/openapi.yaml");
  const policyPath = path.resolve(process.cwd(), args.policy ?? "config/openapi-compat-policy.json");
  const openapiDocument = YAML.parse(fs.readFileSync(openapiPath, "utf8"));
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));

  const result = checkOpenApiCompatibility({ openapiDocument, policy });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
