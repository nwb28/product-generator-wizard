import { test } from "node:test";
import assert from "node:assert/strict";

import { enforceDependencyPolicy } from "./enforce-dependency-policy.mjs";

test("enforceDependencyPolicy passes when denylist packages are absent", () => {
  const result = enforceDependencyPolicy({
    policy: { deniedPackages: ["left-pad"] },
    lockfile: {
      packages: {
        "": { name: "root" },
        "node_modules/typescript": { version: "5.8.2" }
      }
    }
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.violations, []);
});

test("enforceDependencyPolicy fails when denylist packages are present", () => {
  const result = enforceDependencyPolicy({
    policy: { deniedPackages: ["left-pad", "event-stream"] },
    lockfile: {
      packages: {
        "": { name: "root" },
        "node_modules/event-stream": { version: "3.3.6" }
      }
    }
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.violations, ["event-stream"]);
});
