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

function normalizeRelativePath(filePath) {
  return filePath.split(path.sep).join("/");
}

function shouldExclude(filePath, policy) {
  const relativePath = normalizeRelativePath(filePath);
  return (policy.excludePrefixes ?? []).some((prefix) => relativePath.startsWith(String(prefix))) ||
    (policy.excludeSuffixes ?? []).some((suffix) => relativePath.endsWith(String(suffix)));
}

function collectFiles(rootDir, rootEntry, policy, files = []) {
  const rootEntryPath = path.resolve(rootDir, rootEntry);
  if (!fs.existsSync(rootEntryPath)) {
    return files;
  }

  const relativeRootEntry = normalizeRelativePath(rootEntry);
  if (shouldExclude(relativeRootEntry, policy)) {
    return files;
  }

  const stats = fs.statSync(rootEntryPath);
  if (stats.isFile()) {
    files.push(relativeRootEntry);
    return files;
  }

  const children = fs.readdirSync(rootEntryPath).sort((a, b) => a.localeCompare(b));
  for (const child of children) {
    const childRelativePath = normalizeRelativePath(path.join(relativeRootEntry, child));
    if (shouldExclude(childRelativePath, policy)) {
      continue;
    }

    const childAbsolutePath = path.join(rootEntryPath, child);
    const childStats = fs.statSync(childAbsolutePath);
    if (childStats.isDirectory()) {
      collectFiles(rootDir, childRelativePath, policy, files);
    } else if (childStats.isFile()) {
      files.push(childRelativePath);
    }
  }

  return files;
}

function compilePatterns(policy) {
  return (policy.patterns ?? []).map((pattern) => ({
    id: pattern.id,
    regex: new RegExp(pattern.regex, "g")
  }));
}

function lineNumberAtIndex(content, index) {
  return content.slice(0, index).split("\n").length;
}

function scanFileContent(filePath, content, compiledPatterns) {
  const findings = [];
  for (const pattern of compiledPatterns) {
    const matches = content.matchAll(pattern.regex);
    for (const match of matches) {
      findings.push({
        file: filePath,
        patternId: pattern.id,
        line: lineNumberAtIndex(content, match.index ?? 0)
      });
    }
  }
  return findings;
}

function isAllowlisted(finding, policy) {
  return (policy.allowlist ?? []).some((entry) => {
    const allowFile = String(entry.file ?? "");
    const allowPatternId = String(entry.patternId ?? "");
    return finding.file === allowFile && finding.patternId === allowPatternId;
  });
}

export function scanSecrets({ rootDir, policy }) {
  const files = [];
  for (const rootEntry of policy.scanRoots ?? []) {
    collectFiles(rootDir, rootEntry, policy, files);
  }

  const compiledPatterns = compilePatterns(policy);
  const findings = [];

  for (const relativeFilePath of files.sort((a, b) => a.localeCompare(b))) {
    const absolutePath = path.resolve(rootDir, relativeFilePath);
    const content = fs.readFileSync(absolutePath, "utf8");
    // Skip binary-like files that contain null bytes.
    if (content.includes("\u0000")) {
      continue;
    }
    const fileFindings = scanFileContent(relativeFilePath, content, compiledPatterns)
      .filter((finding) => !isAllowlisted(finding, policy));
    findings.push(...fileFindings);
  }

  return {
    valid: findings.length === 0,
    findings
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rootDir = path.resolve(process.cwd(), args.root ?? ".");
  const policyPath = path.resolve(rootDir, args.policy ?? "config/secret-scan-policy.json");

  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const result = scanSecrets({ rootDir, policy });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
