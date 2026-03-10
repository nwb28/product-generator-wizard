import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";

import { scanCodeSast } from "./scan-code-sast.mjs";

const policy = {
  scanRoots: ["src"],
  excludePrefixes: [],
  excludeSuffixes: [".md"],
  patterns: [
    { id: "no-eval", severity: "high", regex: "\\beval\\s*\\(" },
    { id: "no-new-function", severity: "high", regex: "\\bnew\\s+Function\\s*\\(" }
  ],
  allowlist: []
};

function withTempDir(run) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "pgw-sast-"));
  try {
    run(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("scanCodeSast passes when no forbidden patterns are present", () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src", "safe.js"), "const x = 1;\n");
    const result = scanCodeSast({ rootDir: dir, policy });
    assert.equal(result.valid, true);
    assert.equal(result.findings.length, 0);
  });
});

test("scanCodeSast flags high-risk dynamic evaluation patterns", () => {
  withTempDir((dir) => {
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src", "bad.js"), "eval('x');\nnew Function('a', 'return a');\n");
    const result = scanCodeSast({ rootDir: dir, policy });
    assert.equal(result.valid, false);
    assert.equal(result.findings.length, 2);
    assert.match(result.findings.map((entry) => entry.patternId).join(","), /no-eval/u);
    assert.match(result.findings.map((entry) => entry.patternId).join(","), /no-new-function/u);
  });
});
