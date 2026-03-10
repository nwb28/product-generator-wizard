import { test } from "node:test";
import assert from "node:assert/strict";

import { validateSecretRotationEvidence } from "./validate-secret-rotation-evidence.mjs";

test("validateSecretRotationEvidence passes when all required secrets are fresh", () => {
  const result = validateSecretRotationEvidence({
    policy: {
      maxAgeDays: 90,
      requiredSecrets: ["A", "B"]
    },
    evidence: {
      secrets: [
        { name: "A", rotatedAt: "2026-02-01", owner: "sec" },
        { name: "B", rotatedAt: "2026-02-01", owner: "sec" }
      ]
    },
    today: new Date("2026-03-10")
  });
  assert.equal(result.valid, true);
});

test("validateSecretRotationEvidence fails for missing and stale records", () => {
  const result = validateSecretRotationEvidence({
    policy: {
      maxAgeDays: 30,
      requiredSecrets: ["A", "B"]
    },
    evidence: {
      secrets: [{ name: "A", rotatedAt: "2025-01-01", owner: "" }]
    },
    today: new Date("2026-03-10")
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /Missing rotation evidence/u);
  assert.match(result.errors.join("\n"), /stale/u);
  assert.match(result.errors.join("\n"), /missing owner/u);
});
