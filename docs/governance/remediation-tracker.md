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
| REM-009 | Tracked `.test-dist` artifacts | Medium | Closed | Frontend | Removed tracked `.test-dist` artifacts and enforced clean-generation policy in CI. |
| REM-010 | Branch protection for preview gate | High | Closed | DevOps | `main` now requires `preview-contract-gate` with strict checks and review enforcement. |
| REM-011 | Preview threat model publication | Medium | Closed | Security | Published preview threat model with tenant/isolation/retention controls and residual risk tracking. |
| REM-012 | Release evidence bundling | Medium | Closed | DevOps | Added release evidence workflow and bundle artifact linking preview gate, SBOM, and security scan outputs. |
| REM-013 | Branch protection policy drift | High | Closed | DevOps | Added policy-as-code branch protection validation and required additional checks on `main`. |
| REM-014 | Release evidence provenance attestation gap | Medium | Closed | DevOps | Added GitHub artifact provenance attestation for release evidence bundle outputs. |
| REM-015 | Preview artifact retention purge automation | Medium | Closed | DevOps | Added scheduled purge workflow and retention cleanup utility for preview artifact roots. |
| REM-016 | Build artifact strategy ambiguity | Low | Closed | Tech Lead | Published ADR-0001 defining source-only strategy with CI-generated artifacts. |
| REM-017 | CODEOWNERS path-level ownership gaps | Medium | Closed | Tech Lead | Expanded CODEOWNERS for preview, adapters, evidence tooling, and operations docs surfaces. |
| REM-018 | Branch protection drift alerting gap | Medium | Closed | DevOps | Branch protection governance workflow now opens an issue on drift and fails the run. |
| REM-019 | Deploy-time provenance verification gap | High | Closed | DevOps | Deploy workflow now downloads latest release evidence artifact and verifies attestation before deploy continuation. |
| REM-020 | Workflow artifact retention policy drift | Medium | Closed | DevOps | Added retention policy config and CI validator enforcing workflow artifact retention-days values. |
| REM-021 | SOC2 control traceability documentation gap | Medium | Closed | Tech Lead | Published SOC2-style control matrix mapping controls to technical enforcement and evidence. |
| REM-022 | DR drill coverage gap for preview evidence | High | Closed | DevOps | DR check/report and drill workflow now validate preview evidence backup/restore artifacts and hashes. |
| REM-023 | CODEOWNERS role model and mandatory owner review gap | Medium | Closed | Tech Lead | Added role-alias-based CODEOWNERS generation and enabled required code-owner review on `main`. |

## Burn-Down Result
1. Legacy MVP remediation items remain closed.
2. Phase 7 pilot implementation risks are reduced with core controls closed.
3. Enterprise hardening backlog items in this phase are closed; next tickets focus on continuous control maturity.
