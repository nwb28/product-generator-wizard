import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--policy") {
      args.policy = argv[index + 1];
      index += 1;
    } else if (token === "--intake") {
      args.intake = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

export function validateRbacPolicy({ policy, intake }) {
  const errors = [];
  const permissions = intake.permissions ?? {};
  const requiredScopes = policy.requiredScopes ?? [];

  for (const scope of requiredScopes) {
    const entries = Array.isArray(permissions[scope]) ? permissions[scope] : [];
    if (entries.length === 0) {
      errors.push(`RBAC scope '${scope}' is missing required role mappings.`);
      continue;
    }

    const permissionSet = new Set(
      entries.flatMap((entry) => (Array.isArray(entry.permissions) ? entry.permissions : []))
    );
    const requiredPermissions = policy.requiredPermissionsByScope?.[scope] ?? [];
    for (const required of requiredPermissions) {
      if (!permissionSet.has(required)) {
        errors.push(`RBAC scope '${scope}' is missing required permission '${required}'.`);
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const policyPath = path.resolve(process.cwd(), args.policy ?? "config/rbac-policy.json");
  const intakePath = path.resolve(process.cwd(), args.intake ?? "fixtures/golden/pilot-intake.json");
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const intake = JSON.parse(fs.readFileSync(intakePath, "utf8"));
  const result = validateRbacPolicy({ policy, intake });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
