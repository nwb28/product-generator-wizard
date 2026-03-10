import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { scanSecrets } from "./scan-secrets.mjs";

const basePolicy = {
  scanRoots: ["src"],
  excludePrefixes: ["src/excluded/"],
  excludeSuffixes: [".png"],
  allowlist: [],
  patterns: [
    { id: "github-pat", regex: "ghp_[A-Za-z0-9]{36}" },
    { id: "private-key-header", regex: "-----BEGIN (RSA |EC |OPENSSH |)?PRIVATE KEY-----" }
  ]
};

function withTempDir(run) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "pgw-secret-scan-"));
  try {
    run(tempDir);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

test("scanSecrets returns valid true when no patterns are found", () => {
  withTempDir((tempDir) => {
    const srcDir = path.join(tempDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, "safe.txt"), "plain text only\n");

    const result = scanSecrets({ rootDir: tempDir, policy: basePolicy });
    assert.equal(result.valid, true);
    assert.equal(result.findings.length, 0);
  });
});

test("scanSecrets reports finding with path, pattern id, and line", () => {
  withTempDir((tempDir) => {
    const srcDir = path.join(tempDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcDir, "secret.txt"),
      "safe line\nanother line\nghp_abcdefghijklmnopqrstuvwxyz1234567890\n"
    );

    const result = scanSecrets({ rootDir: tempDir, policy: basePolicy });
    assert.equal(result.valid, false);
    assert.equal(result.findings.length, 1);
    assert.deepEqual(result.findings[0], {
      file: "src/secret.txt",
      patternId: "github-pat",
      line: 3
    });
  });
});

test("scanSecrets respects exclude prefixes and suffixes", () => {
  withTempDir((tempDir) => {
    const includedDir = path.join(tempDir, "src");
    const excludedDir = path.join(tempDir, "src", "excluded");
    fs.mkdirSync(includedDir, { recursive: true });
    fs.mkdirSync(excludedDir, { recursive: true });

    fs.writeFileSync(path.join(excludedDir, "secret.txt"), "-----BEGIN PRIVATE KEY-----\n");
    fs.writeFileSync(path.join(includedDir, "image.png"), "ghp_abcdefghijklmnopqrstuvwxyz1234567890");

    const result = scanSecrets({ rootDir: tempDir, policy: basePolicy });
    assert.equal(result.valid, true);
    assert.equal(result.findings.length, 0);
  });
});

test("scanSecrets allows explicitly allowlisted findings", () => {
  withTempDir((tempDir) => {
    const srcDir = path.join(tempDir, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    fs.writeFileSync(path.join(srcDir, "allowlisted.txt"), "ghp_abcdefghijklmnopqrstuvwxyz1234567890\n");

    const result = scanSecrets({
      rootDir: tempDir,
      policy: {
        ...basePolicy,
        allowlist: [{ file: "src/allowlisted.txt", patternId: "github-pat" }]
      }
    });
    assert.equal(result.valid, true);
    assert.equal(result.findings.length, 0);
  });
});
