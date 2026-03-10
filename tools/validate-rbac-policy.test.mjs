import { test } from "node:test";
import assert from "node:assert/strict";

import { validateRbacPolicy } from "./validate-rbac-policy.mjs";

test("validateRbacPolicy passes when required scopes and permissions exist", () => {
  const result = validateRbacPolicy({
    policy: {
      requiredScopes: ["bucs", "firm", "company"],
      requiredPermissionsByScope: {
        bucs: ["read"],
        firm: ["read"],
        company: ["read", "approve"]
      }
    },
    intake: {
      permissions: {
        bucs: [{ role: "a", permissions: ["read"] }],
        firm: [{ role: "b", permissions: ["read"] }],
        company: [{ role: "c", permissions: ["read", "approve"] }]
      }
    }
  });
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("validateRbacPolicy fails when scopes or permissions are missing", () => {
  const result = validateRbacPolicy({
    policy: {
      requiredScopes: ["bucs", "firm", "company"],
      requiredPermissionsByScope: {
        company: ["approve"]
      }
    },
    intake: {
      permissions: {
        bucs: [{ role: "a", permissions: ["read"] }],
        company: [{ role: "c", permissions: ["read"] }]
      }
    }
  });
  assert.equal(result.valid, false);
  assert.match(result.errors.join("\n"), /scope 'firm' is missing/u);
  assert.match(result.errors.join("\n"), /missing required permission 'approve'/u);
});
