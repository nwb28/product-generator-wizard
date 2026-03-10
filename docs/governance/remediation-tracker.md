# Remediation Tracker

| ID | Area | Severity | Status | Owner | Notes |
|---|---|---|---|---|---|
| REM-001 | API auth/header policy hardening | Medium | Closed | Backend | Replaced temporary role header checks with JWT claim-based authorization middleware. |
| REM-002 | UI production build pipeline | Medium | Closed | Frontend | Added Vite production bundling/runtime entry and retained automated UI tests. |
| REM-003 | CI artifact retention policy | Low | Closed | DevOps | Added artifact retention windows, strict upload rules, and naming conventions in contract-gate workflow. |
| REM-004 | Contract versioning governance docs | Low | Closed | Tech Lead | Published contract governance/versioning/approval policy. |
| REM-005 | Preview tenant boundary enforcement | High | Closed | Backend | Added tenant-header/payload consistency checks for preview endpoints with deny-path audit events. |
| REM-006 | Preview audit-chain coverage | Medium | Closed | Backend | Added tests for preview success/deny outcomes in tamper-evident audit logging. |
| REM-007 | Preview gate CI | Medium | Closed | DevOps | Added `preview-contract-gate` workflow and deterministic fixture enforcement. |
| REM-008 | Pre-inclusion docs pack | Medium | Closed | Tech Lead | Published preview runbook, pre-inclusion policy, adapter authoring, and operator guides. |
| REM-009 | Tracked `.test-dist` artifacts | Medium | Open | Frontend | Remove compiled test artifacts from source control and enforce clean generation at test runtime. |
| REM-010 | Branch protection for preview gate | High | Closed | DevOps | `main` now requires `preview-contract-gate` with strict checks and review enforcement. |
| REM-011 | Preview threat model publication | Medium | Closed | Security | Published preview threat model with tenant/isolation/retention controls and residual risk tracking. |
| REM-012 | Release evidence bundling | Medium | Closed | DevOps | Added release evidence workflow and bundle artifact linking preview gate, SBOM, and security scan outputs. |
| REM-013 | Branch protection policy drift | High | Closed | DevOps | Added policy-as-code branch protection validation and required additional checks on `main`. |
| REM-014 | Release evidence provenance attestation gap | Medium | Closed | DevOps | Added GitHub artifact provenance attestation for release evidence bundle outputs. |

## Burn-Down Result
1. Legacy MVP remediation items remain closed.
2. Phase 7 pilot implementation risks are reduced with core controls closed.
3. Four enterprise hardening items remain open and are promoted to next ticket set.
