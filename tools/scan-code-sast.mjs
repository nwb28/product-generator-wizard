#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--policy") {
      args.policy = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--root") {
      args.root = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function normalize(filePath) {
  return filePath.split(path.sep).join("/");
}

function shouldExclude(relativePath, policy) {
  return (policy.excludePrefixes ?? []).some((prefix) => relativePath.startsWith(String(prefix))) ||
    (policy.excludeSuffixes ?? []).some((suffix) => relativePath.endsWith(String(suffix)));
}

function collectFiles(rootDir, entry, policy, files = []) {
  const entryPath = path.resolve(rootDir, entry);
  if (!fs.existsSync(entryPath)) {
    return files;
  }

  const normalizedEntry = normalize(entry);
  if (shouldExclude(normalizedEntry, policy)) {
    return files;
  }

  const stats = fs.statSync(entryPath);
  if (stats.isFile()) {
    files.push(normalizedEntry);
    return files;
  }

  const children = fs.readdirSync(entryPath).sort((a, b) => a.localeCompare(b));
  for (const child of children) {
    const relativeChild = normalize(path.join(normalizedEntry, child));
    if (shouldExclude(relativeChild, policy)) {
      continue;
    }
    const childPath = path.join(entryPath, child);
    const childStats = fs.statSync(childPath);
    if (childStats.isDirectory()) {
      collectFiles(rootDir, relativeChild, policy, files);
    } else if (childStats.isFile()) {
      files.push(relativeChild);
    }
  }

  return files;
}

function lineAt(content, index) {
  return content.slice(0, index).split("\n").length;
}

function isAllowlisted(finding, policy) {
  return (policy.allowlist ?? []).some((entry) =>
    String(entry.file ?? "") === finding.file &&
    String(entry.patternId ?? "") === finding.patternId
  );
}

export function scanCodeSast({ rootDir, policy }) {
  const files = [];
  for (const entry of policy.scanRoots ?? []) {
    collectFiles(rootDir, entry, policy, files);
  }

  const compiledPatterns = (policy.patterns ?? []).map((pattern) => ({
    id: pattern.id,
    severity: pattern.severity ?? "high",
    regex: new RegExp(pattern.regex, "g")
  }));

  const findings = [];
  for (const file of files.sort((a, b) => a.localeCompare(b))) {
    const absolutePath = path.resolve(rootDir, file);
    const content = fs.readFileSync(absolutePath, "utf8");
    if (content.includes("\u0000")) {
      continue;
    }
    for (const pattern of compiledPatterns) {
      const matches = content.matchAll(pattern.regex);
      for (const match of matches) {
        const finding = {
          file,
          patternId: pattern.id,
          severity: pattern.severity,
          line: lineAt(content, match.index ?? 0)
        };
        if (!isAllowlisted(finding, policy)) {
          findings.push(finding);
        }
      }
    }
  }

  return {
    valid: findings.length === 0,
    findings
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(process.cwd(), args.root ?? ".");
  const policyPath = path.resolve(rootDir, args.policy ?? "config/sast-policy.json");
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const result = scanCodeSast({ rootDir, policy });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
