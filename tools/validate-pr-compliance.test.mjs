import { test } from "node:test";
import assert from "node:assert/strict";

import { validatePrCompliance } from "./validate-pr-compliance.mjs";

const policy = {
  requiredLabels: ["governance", "compliance"],
  requiredChecklistPatterns: ["release evidence", "security impact", "rollback plan"]
};

test("validatePrCompliance passes when labels and checklist are present", () => {
  const result = validatePrCompliance({
    policy,
    eventPayload: {
      pull_request: {
        labels: [{ name: "governance" }, { name: "compliance" }],
        body: "- [x] release evidence\n- [x] security impact\n- [x] rollback plan"
      }
    }
  });

  assert.equal(result.valid, true);
});

test("validatePrCompliance fails when labels or checklist entries are missing", () => {
  const result = validatePrCompliance({
    policy,
    eventPayload: {
      pull_request: {
        labels: [{ name: "governance" }],
        body: "- [x] release evidence"
      }
    }
  });

  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /Missing required PR label 'compliance'/u);
  assert.match(result.errors.join("\n"), /security impact/u);
  assert.match(result.errors.join("\n"), /rollback plan/u);
});
