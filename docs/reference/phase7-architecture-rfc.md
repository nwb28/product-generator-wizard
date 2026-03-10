# Phase 7 Architecture RFC: Built-Product Simulation and Preview

## Status
- Draft accepted for implementation baseline.

## Problem Statement
Current MVP validates structured intake and generates deterministic scaffolds. Enterprise onboarding now requires validating fully built products before adding them to the product catalog, including UI/Excel/Workforce behavior previews and compatibility risk checks.

## Goals
1. Ingest built-product metadata through versioned adapter contracts.
2. Run deterministic compatibility analysis with blocking and warning diagnostics.
3. Produce preview artifacts that simulate operator/user-visible behavior.
4. Enforce CI gate rules for pre-inclusion go/no-go.
5. Preserve tenant isolation, auditability, and enterprise-grade operational controls.

## Non-Goals
1. Runtime refactor of production ingestion services.
2. Production deployment automation for downstream products.
3. Full per-provider adapter library in first iteration beyond pilot adapter.

## High-Level Architecture
1. `packages/product-adapters`
   - Adapter contract interfaces.
   - Schema definitions and compatibility diagnostics model.
   - Registry for active adapter versions and compatibility policy.
2. `apps/preview-sandbox`
   - Operator web surface for loading built-product metadata and previewing flows.
   - Calls preview API endpoints for validation, simulation, and report generation.
3. `apps/generator-api` (preview endpoints)
   - `/preview/validate`
   - `/preview/simulate`
   - `/preview/report`
4. `tests/preview-e2e`
   - End-to-end coverage for adapter ingestion, simulation behavior, and report outputs.
5. CI `preview-contract-gate`
   - Fail on any blocking compatibility diagnostics.
   - Publish deterministic preview artifacts and report outputs.

## Contract-First Model
1. `built-product-intake.schema.json`
   - Source metadata contract for fully built products.
2. `preview-session.schema.json`
   - Canonical simulation payload format.
3. `compatibility-report.schema.json`
   - Diagnostics payload and readiness scoring contract.
4. `adapters.index.json`
   - Active adapter versions and compatibility/deprecation policy.

## Determinism Controls
1. Stable key ordering in JSON outputs.
2. Stable file ordering for preview artifact packages.
3. No raw wall-clock timestamps in hash inputs.
4. Version-pinned adapter and schema identifiers in report metadata.

## Security and Isolation
1. Tenant-scoped preview sessions and idempotency keys.
2. Same authz policy family as generator actions.
3. Tamper-evident audit chain events for preview operations.
4. Configurable retention and cleanup policy for preview artifacts.

## Operational Model
1. SLOs:
   - Preview validate p95 under 750ms baseline.
   - Preview simulate p95 under 1500ms baseline.
2. Alerting:
   - Error rate, latency, and dependency availability alerts.
3. Runbooks:
   - Preview operation runbook and pre-inclusion governance policy.

## Risks and Mitigations
1. Adapter drift risk:
   - Mitigation: versioned registry and CI gate on schema compatibility.
2. Preview fidelity risk:
   - Mitigation: snapshot/golden test suite and pilot product certification.
3. Multi-tenant leakage risk:
   - Mitigation: endpoint-level tenant scoping tests and audit verification.
4. Operational complexity risk:
   - Mitigation: bounded pilot scope and staged rollout with explicit kill switches.

## Acceptance Criteria
1. Pilot adapter validates one real built-product family.
2. Preview sandbox can render UI + Excel + Workforce declarations from simulation outputs.
3. CI blocks pre-inclusion when blocking diagnostics are present.
4. Deterministic artifact hash remains stable for identical input.
5. Governance report includes readiness score and explicit go/no-go result.
