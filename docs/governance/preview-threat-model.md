# Preview Threat Model

## Scope
This model covers Phase 7 preview workflows for built-product onboarding:
- `POST /preview/validate`
- `POST /preview/simulate`
- `POST /preview/report`
- Preview sandbox UI interactions and exported report artifacts.

## Security Objectives
1. Prevent cross-tenant data exposure.
2. Protect integrity of diagnostics and readiness decisions.
3. Prevent unauthorized preview execution and report generation.
4. Enforce bounded retention for preview payloads/artifacts.
5. Preserve auditability for compliance review.

## Assets
1. Built-product intake payloads.
2. Preview session outputs (UI, workforce, Excel declarations).
3. Compatibility diagnostics and readiness report content.
4. Tenant and principal identity claims.
5. Audit chain metadata and signatures.

## Trust Boundaries
1. Client boundary: browser/CLI to API.
2. Auth boundary: JWT verification and role authorization.
3. Tenant boundary: request tenant header and payload tenant binding.
4. Storage boundary: in-memory/redis-backed idempotency and rate controls.
5. Artifact boundary: generated preview report and deterministic package metadata.

## Threat Scenarios and Controls

### T1: Cross-Tenant Data Access
- Scenario: caller replays payload for a different tenant.
- Controls:
  1. Require valid bearer token and role scope.
  2. Enforce tenant header and payload tenant match.
  3. Emit deny audit event on mismatch.
- Residual risk: low after endpoint-level tenant binding tests.

### T2: Unauthorized Preview Invocation
- Scenario: untrusted caller invokes preview endpoints.
- Controls:
  1. JWT signature/issuer/audience validation.
  2. Role-based authorization checks for preview actions.
  3. Explicit 401/403 path coverage in tests.
- Residual risk: medium if production secrets are misconfigured.

### T3: Payload Tampering or Non-Repudiation Gaps
- Scenario: actor modifies evidence after validation.
- Controls:
  1. Tamper-evident audit chain event hash sequencing.
  2. HMAC signing support for audit records.
  3. Deterministic artifact hash metadata.
- Residual risk: low with signing secrets managed correctly.

### T4: Data Retention Overrun
- Scenario: preview artifacts retained beyond policy window.
- Controls:
  1. Retention policy metadata required in report output.
  2. CI/governance checks for retention declaration.
  3. Operational runbook cleanup responsibilities.
- Residual risk: medium until automated purge job is implemented.

### T5: Denial-of-Service via Preview Endpoint Flood
- Scenario: abusive traffic exhausts preview resources.
- Controls:
  1. Tenant-principal rate limiting.
  2. Tenant quotas with endpoint overrides.
  3. SLO alerting for error-rate and latency anomalies.
- Residual risk: medium during broad enterprise rollout.

### T6: Report Integrity Drift
- Scenario: report content mismatches diagnostics source.
- Controls:
  1. Shared schema contracts across validator/compiler/report packages.
  2. Preview golden and e2e regression tests.
  3. CI gate artifact generation from single validated payload.
- Residual risk: low.

## Retention and Classification
1. Classification: preview payload and report data are internal confidential.
2. Minimum retention fields:
   - tenant id
   - request id
   - operation type
   - diagnostics summary
   - deterministic hash
3. Maximum retention window:
   - follow policy in `docs/governance/pre-inclusion-policy.md` and platform retention controls.

## Detection and Response
1. Monitor audit deny events for tenant mismatch/authz failures.
2. Alert on preview endpoint p95 degradation and elevated error rates.
3. Trigger incident workflow for repeated unauthorized attempts.
4. Preserve evidence bundle for governance and security review.

## Validation Evidence
1. Preview endpoint tenant-binding tests in API suite.
2. Preview e2e flow tests for authorize/validate/simulate/report.
3. `preview-contract-gate` required on `main` branch protection.
4. Deterministic fixture checks for preview artifact stability.

## Open Risks
1. Automated retention purge orchestration still pending.
2. Threat model should be revisited when adding additional adapters or external data connectors.
