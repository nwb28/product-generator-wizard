# Pre-Inclusion Governance Policy

## Purpose
Define mandatory controls for onboarding fully built products into the catalog using preview validation and compatibility gates.

## Policy Statements
1. Every candidate product must pass preview contract validation before inclusion.
2. Any blocking diagnostic is an automatic `No-Go`.
3. Warning diagnostics require documented risk acceptance or remediation plan.
4. Inclusion decisions must include immutable artifact evidence:
   - diagnostics JSON
   - human-readable review report
   - deterministic artifact hash metadata
5. Tenant-bound authorization is mandatory for all preview operations.
6. Audit records for validation/simulation/report actions must be retained per policy.

## Control Ownership
- Tech Lead: contract baseline and acceptance sign-off.
- Backend Engineer: validator/compiler/preview endpoint compliance.
- Frontend Engineer: preview UI fidelity and checklist workflow.
- DevOps Engineer: CI gate enforcement and artifact retention.
- QA/SET: deterministic golden and end-to-end compatibility checks.
- Product/Platform SME: canonical mapping and permission matrix correctness.

## Go/No-Go Decision Rules
1. Go:
   - No blocking diagnostics.
   - Readiness score meets minimum threshold (default >= 85).
   - Manual checklist complete and reviewer sign-off recorded.
2. Conditional Go:
   - No blockers.
   - Warnings accepted with time-bound remediation ticket.
3. No-Go:
   - Any blocking diagnostic.
   - Missing mandatory security/evidence declarations.
   - Missing reviewer sign-off.

## Evidence Requirements
1. CI run link for `preview-contract-gate`.
2. Attached compatibility diagnostics artifact.
3. Attached pre-inclusion report artifact.
4. Reported deterministic hash for generated preview package.
5. Remediation links for all warning categories.

## Exception Handling
Exceptions require written approval from Tech Lead and Product/Platform SME and must include:
1. Scope and rationale.
2. Explicit risk statement.
3. Expiration date.
4. Owner and mitigation timeline.
