import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

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

function defaultIsTracked(repositoryRoot, relativePath) {
  const check = spawnSync("git", ["ls-files", "--error-unmatch", "--", relativePath], {
    cwd: repositoryRoot,
    encoding: "utf8"
  });
  return check.status === 0;
}

export function verifyRepositoryLayout({ repositoryRoot, policy, isTracked = defaultIsTracked }) {
  const missingPaths = [];
  const forbiddenEntries = [];

  for (const relativePath of policy.requiredPaths ?? []) {
    const absolutePath = path.join(repositoryRoot, relativePath);
    if (!fs.existsSync(absolutePath)) {
      missingPaths.push(relativePath);
    }
  }

  for (const entry of policy.forbiddenTopLevelEntries ?? []) {
    const absolutePath = path.join(repositoryRoot, entry);
    if (fs.existsSync(absolutePath) && isTracked(repositoryRoot, entry)) {
      forbiddenEntries.push(entry);
    }
  }

  return {
    valid: missingPaths.length === 0 && forbiddenEntries.length === 0,
    missingPaths,
    forbiddenEntries
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const policyPath = path.resolve(process.cwd(), args.policy ?? "config/repository-layout-policy.json");
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const result = verifyRepositoryLayout({
    repositoryRoot: process.cwd(),
    policy
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
