import { test } from "node:test";
import assert from "node:assert/strict";

import { validateSloPolicy } from "./validate-slo-policy.mjs";

test("validateSloPolicy accepts valid policy", () => {
  const result = validateSloPolicy({
    windowDays: 30,
    availabilityTargetPercent: 99.9,
    errorBudgetPercent: 0.1,
    latencyTargetsMs: {
      "/validate": 750
    },
    fastBurn: {
      windowMinutes: 5,
      maxErrorRatePercent: 2
    },
    slowBurn: {
      windowMinutes: 60,
      maxErrorRatePercent: 0.5
    },
    trackedEndpoints: ["/validate", "/generate"]
  });
  assert.equal(result.valid, true);
  assert.equal(result.errors.length, 0);
});

test("validateSloPolicy rejects budget mismatch and invalid burn ordering", () => {
  const result = validateSloPolicy({
    windowDays: 30,
    availabilityTargetPercent: 99.9,
    errorBudgetPercent: 0.2,
    latencyTargetsMs: {
      "/validate": 750
    },
    fastBurn: {
      windowMinutes: 5,
      maxErrorRatePercent: 0.5
    },
    slowBurn: {
      windowMinutes: 60,
      maxErrorRatePercent: 0.5
    },
    trackedEndpoints: ["/validate", "/validate"]
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /errorBudgetPercent must equal/u);
  assert.match(result.errors.join("\n"), /fastBurn\.maxErrorRatePercent must be greater/u);
  assert.match(result.errors.join("\n"), /duplicated/u);
});
