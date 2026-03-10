import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--policy") {
      args.policy = argv[index + 1];
      index += 1;
    } else if (token === "--lockfile") {
      args.lockfile = argv[index + 1];
      index += 1;
    }
  }
  return args;
}

function packageNamesFromLock(lockfile) {
  const names = new Set();
  const packages = lockfile.packages ?? {};
  for (const [packagePath, metadata] of Object.entries(packages)) {
    if (packagePath.startsWith("node_modules/")) {
      names.add(packagePath.slice("node_modules/".length));
    } else if (metadata && typeof metadata.name === "string" && metadata.name.length > 0) {
      names.add(metadata.name);
    }
  }
  return names;
}

export function enforceDependencyPolicy({ policy, lockfile }) {
  const deniedPackages = Array.isArray(policy.deniedPackages) ? policy.deniedPackages : [];
  const lockPackages = packageNamesFromLock(lockfile);
  const violations = deniedPackages.filter((name) => lockPackages.has(name)).sort();

  return {
    valid: violations.length === 0,
    violations
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const policyPath = path.resolve(process.cwd(), args.policy ?? "config/dependency-policy.json");
  const lockfilePath = path.resolve(process.cwd(), args.lockfile ?? "package-lock.json");
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const lockfile = JSON.parse(fs.readFileSync(lockfilePath, "utf8"));
  const result = enforceDependencyPolicy({ policy, lockfile });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
