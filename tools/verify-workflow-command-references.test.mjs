import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, test } from "node:test";
import assert from "node:assert/strict";

import { verifyWorkflowCommandReferences } from "./verify-workflow-command-references.mjs";

const tempRoots = [];

afterEach(() => {
  while (tempRoots.length > 0) {
    const root = tempRoots.pop();
    fs.rmSync(root, { recursive: true, force: true });
  }
});

function writeFixture({ scripts, workflowContent, createTool = true }) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "workflow-refs-"));
  tempRoots.push(root);

  fs.mkdirSync(path.join(root, ".github", "workflows"), { recursive: true });
  fs.mkdirSync(path.join(root, "tools"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify({ name: "fixture", private: true, scripts }, null, 2)
  );
  fs.writeFileSync(path.join(root, ".github", "workflows", "ci.yml"), workflowContent);
  if (createTool) {
    fs.writeFileSync(path.join(root, "tools", "good.mjs"), "console.log('ok');\n");
  }

  return root;
}

test("verifyWorkflowCommandReferences passes when workflow references existing scripts and tools", () => {
  const root = writeFixture({
    scripts: { build: "echo build" },
    workflowContent: `
name: ci
jobs:
  bootstrap:
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
      - run: node tools/good.mjs
`
  });

  const result = verifyWorkflowCommandReferences({
    repositoryRoot: root,
    workflowsDirectory: path.join(root, ".github", "workflows"),
    packageJsonPath: path.join(root, "package.json")
  });

  assert.equal(result.missingScripts.length, 0);
  assert.equal(result.missingToolPaths.length, 0);
});

test("verifyWorkflowCommandReferences flags missing npm scripts", () => {
  const root = writeFixture({
    scripts: { test: "echo test" },
    workflowContent: `
name: ci
jobs:
  bootstrap:
    runs-on: ubuntu-latest
    steps:
      - run: npm run build
`
  });

  const result = verifyWorkflowCommandReferences({
    repositoryRoot: root,
    workflowsDirectory: path.join(root, ".github", "workflows"),
    packageJsonPath: path.join(root, "package.json")
  });

  assert.deepEqual(result.missingScripts.map((item) => item.scriptName), ["build"]);
});

test("verifyWorkflowCommandReferences flags missing tools in block run steps", () => {
  const root = writeFixture({
    scripts: { build: "echo build" },
    workflowContent: `
name: ci
jobs:
  bootstrap:
    runs-on: ubuntu-latest
    steps:
      - run: |
          npm run build
          node tools/missing.mjs
`,
    createTool: false
  });

  const result = verifyWorkflowCommandReferences({
    repositoryRoot: root,
    workflowsDirectory: path.join(root, ".github", "workflows"),
    packageJsonPath: path.join(root, "package.json")
  });

  assert.deepEqual(result.missingToolPaths.map((item) => item.toolPath), ["tools/missing.mjs"]);
});
