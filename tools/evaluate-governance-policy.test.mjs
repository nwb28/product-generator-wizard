import assert from "node:assert/strict";
import { test } from "node:test";

import { evaluateGovernancePolicy } from "./evaluate-governance-policy.mjs";

const policy = {
  minimumCanonicalConfidence: 0.85,
  requiredOperations: ["create", "update", "list"],
  requireHttpsEvidenceLinks: true,
  requireNoPiiForPilotProfile: true
};

const validIntake = {
  product: { productType: "note-payable" },
  controlPlane: { operations: ["create", "update", "list"] },
  canonicalModel: { mappings: [{ confidence: 0.96 }] },
  securityEvidence: { pii: false, evidenceLinks: ["https://example.test/evidence"] }
};

test("evaluateGovernancePolicy allows compliant intake", () => {
  const result = evaluateGovernancePolicy({ policy, intake: validIntake });
  assert.equal(result.allow, true);
  assert.equal(result.violations.length, 0);
});

test("evaluateGovernancePolicy blocks intake with policy violations", () => {
  const result = evaluateGovernancePolicy({
    policy,
    intake: {
      product: { productType: "note-payable" },
      controlPlane: { operations: ["create"] },
      canonicalModel: { mappings: [{ confidence: 0.6 }] },
      securityEvidence: { pii: true, evidenceLinks: ["http://example.test/evidence"] }
    }
  });

  assert.equal(result.allow, false);
  assert.match(result.violations.map((entry) => entry.code).join(","), /OPA-CANONICAL-CONFIDENCE/u);
  assert.match(result.violations.map((entry) => entry.code).join(","), /OPA-CONTROL-PLANE-OPERATIONS/u);
  assert.match(result.violations.map((entry) => entry.code).join(","), /OPA-EVIDENCE-HTTPS/u);
  assert.match(result.violations.map((entry) => entry.code).join(","), /OPA-PILOT-PII/u);
});
