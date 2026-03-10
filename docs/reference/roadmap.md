# Product Generator Wizard Roadmap

## Current Status
- Phase 1 is complete.
- MVP foundation work has progressed through the original Phase 2-6 scope and enterprise hardening items.

## Original MVP Phases
1. Phase 1 (Week 1): repo bootstrap, schema v1 draft, API/CLI skeleton.
2. Phase 2 (Week 2): validator implementation and diagnostics contract.
3. Phase 3 (Week 3): manifest compiler and deterministic serializer.
4. Phase 4 (Week 4): scaffold generation and review doc template.
5. Phase 5 (Week 5): CI gate, golden fixtures, and admin deep-link wiring.
6. Phase 6 (Week 6): pilot run, defect burn-down, and docs finalization.

## Added Next Phase
7. Phase 7 (Post-MVP): built-product simulation and preview harness.

### Phase 7 Goals
1. Add product adapter contracts for already-built products.
2. Add preview sandbox to render wizard UI and Excel/workforce integration previews before onboarding.
3. Add compatibility test harness for contract checks, permission matrix checks, and mapping coverage.
4. Add UI regression snapshots and Excel plugin integration checks.
5. Generate a pre-inclusion readiness report (go/no-go) before catalog inclusion.

### Phase 7 Deliverables
1. `packages/product-adapters` for built-product ingestion adapters.
2. `apps/preview-sandbox` for operator-facing simulation and UI preview.
3. `tests/preview-e2e` for end-to-end preview and compatibility flows.
4. CI workflow `preview-contract-gate` with artifact publishing.
5. `docs/operations/preview-runbook.md` and `docs/governance/pre-inclusion-policy.md`.
