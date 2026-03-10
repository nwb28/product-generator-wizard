# Operations Log

## Ticket 1 - Push Feature Branch
- Created remote repository: `https://github.com/nwb28/product-generator-wizard`
- Configured `origin` for local repository.
- Pushed branch: `codex/pgw-wizard-mvp-20260309`
- Verified remote branch exists via `git ls-remote --heads origin codex/pgw-wizard-mvp-20260309`.

## Ticket 2 - Open Pull Request
- Created `main` integration branch on remote from bootstrap checkpoint.
- Opened PR #1: https://github.com/nwb28/product-generator-wizard/pull/1
- Verified PR state is `OPEN` with base `main` and head `codex/pgw-wizard-mvp-20260309`.

## Ticket 3 - Branch Protection
- Repository visibility changed to public to allow branch protection.
- Applied protection on `main` requiring checks: `bootstrap`, `contract-gate`.
- Enforced admin protection and 1 required PR approval.
- Verified protection settings through GitHub API.

## Enterprise Ticket 1 - Reinstate Review Requirement
- Restored `main` branch protection to require **1 approving review**.
- Kept required checks: `bootstrap`, `contract-gate`.

## Enterprise Ticket 9 - MVP Release Tag
- Published release `v0.1.0` on `main`.
- Release URL: https://github.com/nwb28/product-generator-wizard/releases/tag/v0.1.0

## Enterprise Ticket 1 - PR Opened
- Opened PR #2 from `codex/enterprise-hardening-20260309` into `main`.
- URL: https://github.com/nwb28/product-generator-wizard/pull/2

## Phase 7 Ticket 27 - Preview Gate Branch Protection
- Updated `main` branch protection required checks to include `preview-contract-gate`.
- Preserved existing protection controls:
  - strict status checks
  - required conversation resolution
  - 1 approving review
  - enforce admin rules
- Verified through GitHub API response that required contexts are now:
  - `bootstrap`
  - `contract-gate`
  - `preview-contract-gate`

## Phase 7 Ticket 29 - Release Evidence Bundle
- Added CI workflow: `.github/workflows/release-evidence-bundle.yml`.
- Workflow links release evidence from:
  - `preview-contract-gate`
  - `sbom` generation
  - `security-scan` vulnerability report
- Added bundle generator `tools/bundle-release-evidence.mjs` that emits:
  - `.tmp/release-evidence/release-evidence.json`
  - `.tmp/release-evidence/release-evidence.md`
  - `.tmp/release-evidence/raw/*` source evidence files

## Enterprise Ticket - Branch Protection Policy As Code
- Added workflow: `.github/workflows/branch-protection-governance.yml`.
- Added validator: `tools/check-branch-protection.mjs`.
- Updated `main` required checks to:
  - `bootstrap`
  - `contract-gate`
  - `preview-contract-gate`
  - `security-scan`
  - `release-evidence-bundle`

## Enterprise Ticket - Release Evidence Attestation
- Updated `.github/workflows/release-evidence-bundle.yml` to request:
  - `id-token: write`
  - `attestations: write`
- Added `actions/attest-build-provenance@v2` step for `.tmp/release-evidence/**`.

## Enterprise Ticket - Preview Artifact Retention Purge
- Added `tools/purge-preview-artifacts.mjs` with retention-based file cleanup logic.
- Added scheduled workflow `.github/workflows/preview-artifact-retention.yml`.
- Updated preview runbook with purge procedure and workflow linkage.

## Enterprise Ticket - Build Artifact Strategy ADR
- Added ADR document `docs/reference/adr/0001-build-artifact-strategy.md`.
- Standardized policy to keep generated build outputs out of source control.
- Linked ADR in documentation index for maintainer discoverability.

## Enterprise Ticket - CODEOWNERS Hardening
- Expanded `.github/CODEOWNERS` to include:
  - preview sandbox and preview e2e surfaces
  - product adapter and preview fixture paths
  - operations docs and ADR references
  - governance-critical tools for branch protection, evidence, retention, and cleanliness

## Enterprise Ticket - Branch Protection Drift Alerting
- Updated `.github/workflows/branch-protection-governance.yml` to:
  - continue policy check step on failure
  - open a governance issue when drift is detected (deduplicated by title)
  - fail the workflow after issue creation to preserve blocking behavior

## Enterprise Ticket - Deploy Attestation Verification
- Updated `.github/workflows/deploy.yml` preflight to:
  - resolve latest successful `release-evidence-bundle` run id
  - download `release-evidence-bundle` artifact from that run
  - verify `release-evidence.json` attestation with `gh attestation verify`

## Enterprise Ticket - Retention Policy Conformance Gate
- Added `config/artifact-retention-policy.json` as the policy source.
- Added `tools/validate-workflow-retention.mjs` for workflow policy validation.
- Wired retention policy validation into CI and generator contract gate workflows.

## Enterprise Ticket - SOC2 Control Matrix
- Added governance reference: `docs/governance/soc2-control-matrix.md`.
- Mapped control objectives to enforcing workflows, scripts, and evidence artifacts.

## Enterprise Ticket - DR Drill Preview Evidence Coverage
- Extended `tools/dr-check.mjs` to include preview evidence backup/restore verification.
- Extended `tools/dr-drill-report.mjs` to include preview evidence pass/fail status in drill report.
- Updated `.github/workflows/dr-drill.yml` artifact upload paths for preview DR outputs.

## Enterprise Ticket - CODEOWNERS Role Alias Model
- Added role alias configuration: `config/codeowners-roles.json`.
- Added CODEOWNERS template and renderer:
  - `.github/CODEOWNERS.template`
  - `tools/render-codeowners.mjs`
- Updated `main` branch protection to require code owner reviews (`require_code_owner_reviews=true`).

## Enterprise Ticket - Deploy Attestation Path CI Check
- Added `tools/verify-deploy-attestation-path.mjs` and tests.
- Wired the check into `.github/workflows/ci.yml`.
- CI now fails if deploy workflow loses attestation run resolution, artifact download, or verification step.

## Enterprise Ticket - Branch Protection Remediation Workflow
- Added baseline policy file: `config/branch-protection-baseline.json`.
- Added apply utility: `tools/apply-branch-protection-baseline.mjs`.
- Added manual approval-gated workflow: `.github/workflows/branch-protection-remediation.yml`.
- Workflow requires explicit `apply=true` and runs in `governance-remediation` environment.

## Enterprise Ticket - Retention Observability and Alerting
- Added `tools/check-retention-purge-slo.mjs` and tests.
- Added scheduled monitor workflow: `.github/workflows/retention-observability.yml`.
- Monitor fails if the latest successful purge run is older than 26 hours and opens a deduplicated alert issue.

## Enterprise Ticket - Control Evidence Export Package
- Added `tools/export-control-evidence.mjs` and tests.
- Added scheduled workflow `.github/workflows/control-evidence-export.yml`.
- Workflow publishes auditable control package artifact (`control-evidence-*`) with manifest and summary.

## Enterprise Ticket - Quarterly Governance Self-Test
- Added `tools/governance-self-test.mjs` and tests.
- Added quarterly workflow `.github/workflows/governance-quarterly-self-test.yml`.
- Workflow emits consolidated governance report artifact and opens issue on failure.

## Enterprise Ticket - Label Bootstrap Baseline
- Added label policy config `config/issue-labels.json`.
- Added bootstrap tool `tools/bootstrap-issue-labels.mjs`.
- Tool supports dry-run planning and apply mode for governance/operations alert labels.

## Enterprise Ticket - Governance Remediation Environment Protection
- Added environment protection config `config/environment-protection.json`.
- Added apply utility `tools/apply-environment-protection.mjs` with dry-run/apply modes.
- Enforced `governance-remediation` required reviewer and self-review prevention on the repository environment.

## Enterprise Ticket - Workflow Command Reference Integrity
- Added workflow command reference validator `tools/verify-workflow-command-references.mjs`.
- Added automated tests `tools/verify-workflow-command-references.test.mjs`.
- Enforced workflow reference checks in:
  - `npm run release:check`
  - `.github/workflows/ci.yml`
  - `.github/workflows/generator-contract-gate.yml`

## Enterprise Ticket - Governance Bootstrap Runbook and Orchestration
- Added orchestration tool `tools/bootstrap-governance-controls.mjs` to execute label/environment/branch-protection bootstrap sequence.
- Added baseline orchestration config `config/governance-bootstrap.json`.
- Added runbook `docs/operations/governance-bootstrap-runbook.md` and indexed it in `docs/README.md`.

## Enterprise Ticket - Repository Layout Policy Guard
- Added repository layout policy config `config/repository-layout-policy.json`.
- Added verifier `tools/verify-repository-layout.mjs` and tests `tools/verify-repository-layout.test.mjs`.
- Enforced layout checks in:
  - `npm run release:check`
  - `.github/workflows/ci.yml`
  - `.github/workflows/generator-contract-gate.yml`

## Enterprise Ticket - SLO Policy-as-Code Gate
- Added SLO policy baseline `config/slo-policy.json`.
- Added validator `tools/validate-slo-policy.mjs` and tests `tools/validate-slo-policy.test.mjs`.
- Enforced SLO checks in:
  - `npm run release:check`
  - `.github/workflows/ci.yml`
  - `.github/workflows/generator-contract-gate.yml`

## Enterprise Ticket - Dependency Policy Gate
- Added dependency policy baseline `config/dependency-policy.json`.
- Added lockfile policy enforcement `tools/enforce-dependency-policy.mjs` and tests `tools/enforce-dependency-policy.test.mjs`.
- Enforced dependency policy checks in:
  - `npm run release:check`
  - `.github/workflows/ci.yml`
  - `.github/workflows/generator-contract-gate.yml`
  - `.github/workflows/security-scan.yml`

## Enterprise Ticket - OpenAPI Compatibility Gate
- Added required-operation compatibility policy `config/openapi-compat-policy.json`.
- Added compatibility checker `tools/check-openapi-compat.mjs` and tests `tools/check-openapi-compat.test.mjs`.
- Enforced compatibility checks in:
  - `npm run release:check`
  - `.github/workflows/ci.yml`
  - `.github/workflows/generator-contract-gate.yml`
  - `.github/workflows/openapi-contract.yml`

## Enterprise Ticket - Long-Run Performance Policy Gate
- Added load policy `config/perf-load-policy.json` for long-run p95 thresholds.
- Added validator `tools/validate-perf-report.mjs` and tests `tools/validate-perf-report.test.mjs`.
- Added `npm run perf:longrun:check` and enforced it in `.github/workflows/perf-trend.yml`.
