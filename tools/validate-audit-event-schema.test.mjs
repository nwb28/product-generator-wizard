import { test } from "node:test";
import assert from "node:assert/strict";

import { validateAuditEventSchema } from "./validate-audit-event-schema.mjs";

const policy = {
  schemaVersion: "1.0.0",
  requiredFields: ["schemaVersion", "eventType", "chain.eventHash"],
  allowedEventTypes: ["wizard-authz", "wizard-operation"]
};

test("validateAuditEventSchema passes for compliant events", () => {
  const result = validateAuditEventSchema({
    policy,
    events: [
      {
        schemaVersion: "1.0.0",
        eventType: "wizard-authz",
        chain: { eventHash: "abc" }
      }
    ]
  });
  assert.equal(result.valid, true);
});

test("validateAuditEventSchema fails for incompatible events", () => {
  const result = validateAuditEventSchema({
    policy,
    events: [
      {
        schemaVersion: "2.0.0",
        eventType: "other"
      }
    ]
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /schemaVersion/u);
  assert.match(result.errors.join("\n"), /not allowed/u);
  assert.match(result.errors.join("\n"), /missing required field 'chain.eventHash'/u);
});
