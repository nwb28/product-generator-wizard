import { test } from "node:test";
import assert from "node:assert/strict";

import { buildBootstrapCommands } from "./bootstrap-governance-controls.mjs";

test("buildBootstrapCommands emits dry-run branch protection command by default", () => {
  const commands = buildBootstrapCommands({
    owner: "octo",
    repo: "wizard"
  });

  assert.equal(commands.length, 3);
  assert.match(commands[0], /bootstrap-issue-labels\.mjs/u);
  assert.match(commands[1], /apply-environment-protection\.mjs/u);
  assert.match(commands[2], /--dry-run/u);
});

test("buildBootstrapCommands emits apply commands when requested", () => {
  const commands = buildBootstrapCommands({
    owner: "octo",
    repo: "wizard",
    branch: "main",
    apply: true
  });

  assert.doesNotMatch(commands[2], /--dry-run/u);
  assert.match(commands[0], /--apply/u);
  assert.match(commands[1], /--apply/u);
});

test("buildBootstrapCommands requires owner and repo", () => {
  assert.throws(() => buildBootstrapCommands({ repo: "wizard" }), /owner and repo are required/u);
  assert.throws(() => buildBootstrapCommands({ owner: "octo" }), /owner and repo are required/u);
});
