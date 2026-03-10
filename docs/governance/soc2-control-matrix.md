# SOC2 Control Matrix

## Purpose
Map enterprise controls to technical enforcement points in Product Generator Wizard.

## Control Mapping

| Control ID | Objective | Enforcement Mechanism | Evidence Artifact |
|---|---|---|---|
| CC1.1 | Change governance and approvals | Branch protection + CODEOWNERS + required review | GitHub branch protection config, PR review history |
| CC2.1 | CI contract and quality gating | `generator-contract-gate`, `preview-contract-gate`, `release:check` | CI run logs, diagnostics artifacts |
| CC2.2 | Deterministic generation integrity | Golden fixture tests and deterministic hash checks | `fixtures/golden/*`, `fixtures/preview/*`, test outputs |
| CC3.1 | Security vulnerability control | `security-scan` + vulnerability gate script | `npm-audit-report-*`, gate logs |
| CC3.2 | Supply-chain transparency | `sbom` workflow + release evidence bundle | `sbom-cyclonedx`, `release-evidence-bundle` |
| CC3.3 | Artifact provenance integrity | Artifact attestation and deploy-time attestation verification | Attestation records, deploy preflight logs |
| CC4.1 | Tenant isolation and authz control | API authz middleware + tenant-bound checks + e2e tests | API test logs, audit chain entries |
| CC4.2 | Auditability and non-repudiation | Tamper-evident audit chain + HMAC signing support | Audit event stream and signatures |
| CC5.1 | Data retention governance | Workflow retention policy validator + purge automation | retention policy config, purge run logs |
| CC6.1 | Operational resilience and DR | `dr:check`, DR drill workflow, performance/synthetic monitors | DR reports, perf/synthetic artifacts |

## Traceability Index
1. Branch protection policy validator: `tools/check-branch-protection.mjs`
2. Workflow retention validator: `tools/validate-workflow-retention.mjs`
3. Release evidence bundling: `tools/bundle-release-evidence.mjs`
4. Preview retention purge: `tools/purge-preview-artifacts.mjs`
5. Clean tracked-tree guard: `tools/ensure-clean-worktree.mjs`

## Review Cadence
1. Monthly control verification by Tech Lead + DevOps.
2. Per-release control evidence package attached in release records.
3. Quarterly control matrix review for control drift and coverage gaps.
