import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

import { verifyRepositoryLayout } from "./verify-repository-layout.mjs";

const tempRoots = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function createRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "layout-policy-"));
  tempRoots.push(root);
  return root;
}

test("verifyRepositoryLayout passes when required paths exist and forbidden entries are absent", () => {
  const root = createRoot();
  fs.mkdirSync(path.join(root, "apps", "wizard-ui"), { recursive: true });
  fs.mkdirSync(path.join(root, "docs"), { recursive: true });

  const result = verifyRepositoryLayout({
    repositoryRoot: root,
    policy: {
      requiredPaths: ["apps/wizard-ui", "docs"],
      forbiddenTopLevelEntries: [".tmp"]
    },
    isTracked: () => false
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.missingPaths, []);
  assert.deepEqual(result.forbiddenEntries, []);
});

test("verifyRepositoryLayout reports missing and forbidden entries", () => {
  const root = createRoot();
  fs.mkdirSync(path.join(root, ".tmp"), { recursive: true });

  const result = verifyRepositoryLayout({
    repositoryRoot: root,
    policy: {
      requiredPaths: ["apps/wizard-ui", "docs"],
      forbiddenTopLevelEntries: [".tmp"]
    },
    isTracked: (_repositoryRoot, relativePath) => relativePath === ".tmp"
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.missingPaths, ["apps/wizard-ui", "docs"]);
  assert.deepEqual(result.forbiddenEntries, [".tmp"]);
});
