#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--policy") {
      args.policy = argv[i + 1];
      i += 1;
    } else if (token === "--intake") {
      args.intake = argv[i + 1];
      i += 1;
    }
  }
  return args;
}

function addViolation(violations, violation) {
  violations.push({
    code: violation.code,
    severity: "blocking",
    path: violation.path,
    message: violation.message
  });
}

export function evaluateGovernancePolicy({ policy, intake }) {
  const violations = [];

  const mappings = intake.canonicalModel?.mappings ?? [];
  for (let index = 0; index < mappings.length; index += 1) {
    const mapping = mappings[index];
    if (typeof mapping.confidence === "number" && mapping.confidence < policy.minimumCanonicalConfidence) {
      addViolation(violations, {
        code: "OPA-CANONICAL-CONFIDENCE",
        path: `/canonicalModel/mappings/${index}/confidence`,
        message: `Canonical mapping confidence ${mapping.confidence} is below policy minimum ${policy.minimumCanonicalConfidence}.`
      });
    }
  }

  const operations = new Set(intake.controlPlane?.operations ?? []);
  for (const requiredOperation of policy.requiredOperations ?? []) {
    if (!operations.has(requiredOperation)) {
      addViolation(violations, {
        code: "OPA-CONTROL-PLANE-OPERATIONS",
        path: "/controlPlane/operations",
        message: `Required control-plane operation '${requiredOperation}' is missing.`
      });
    }
  }

  if (policy.requireHttpsEvidenceLinks) {
    const evidenceLinks = intake.securityEvidence?.evidenceLinks ?? [];
    for (let index = 0; index < evidenceLinks.length; index += 1) {
      const link = String(evidenceLinks[index]);
      if (!link.startsWith("https://")) {
        addViolation(violations, {
          code: "OPA-EVIDENCE-HTTPS",
          path: `/securityEvidence/evidenceLinks/${index}`,
          message: "Security evidence links must use HTTPS."
        });
      }
    }
  }

  if (policy.requireNoPiiForPilotProfile && intake.product?.productType === "note-payable") {
    if (intake.securityEvidence?.pii !== false) {
      addViolation(violations, {
        code: "OPA-PILOT-PII",
        path: "/securityEvidence/pii",
        message: "Pilot note-payable profile must declare pii=false."
      });
    }
  }

  return {
    allow: violations.length === 0,
    violations
  };
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const policyPath = path.resolve(process.cwd(), args.policy ?? "config/opa-governance-policy.json");
  const intakePath = path.resolve(process.cwd(), args.intake ?? "fixtures/golden/pilot-intake.json");
  const policy = JSON.parse(fs.readFileSync(policyPath, "utf8"));
  const intake = JSON.parse(fs.readFileSync(intakePath, "utf8"));
  const result = evaluateGovernancePolicy({ policy, intake });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.allow) {
    process.exitCode = 1;
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
