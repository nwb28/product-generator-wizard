# Preview Sandbox Runbook

## Purpose
This runbook defines standard operating procedures for Phase 7 preview validation, simulation, and readiness report generation before product catalog inclusion.

## Scope
- `POST /preview/validate`
- `POST /preview/simulate`
- `POST /preview/report`
- CI workflow: `preview-contract-gate`

## Preconditions
1. Operator has `wizard.generate` authorization scope for the target tenant.
2. Built-product intake conforms to `built-product-intake.schema.json`.
3. Tenant quota allows preview requests.
4. Required production-like config is present:
   - `WIZARD_AUTH_JWT_SECRET`
   - `WIZARD_AUTH_JWT_ISSUER`
   - `WIZARD_AUTH_JWT_AUDIENCE`
   - `WIZARD_AUDIT_HMAC_SECRET`

## Standard Flow
1. Run local gate before PR:
   - `npm run preview:gate`
2. Run synthetic probes:
   - `npm run synthetic:probe`
3. Validate performance budget:
   - `npm run perf:preview`
4. Generate readiness report via preview report endpoint or UI export.
5. Attach diagnostics and report artifacts to change ticket/PR.

## Incident Triage
1. Verify alert channel and current incident state in `docs/operations/alert-routing.md`.
2. Check endpoint health and error diagnostics from API logs.
3. Reproduce with fixture input:
   - `fixtures/preview/pilot-built-product-intake.json`
4. Determine failure class:
   - Contract/schema failure
   - Tenant/authz failure
   - Adapter compatibility failure
   - Performance regression
5. Apply fix and rerun:
   - `npm run preview:gate`
   - `npm run perf:preview`

## Recovery Actions
1. For compatibility blockers, update adapter mappings and rerun golden tests.
2. For authz failures, verify tenant binding and role claims.
3. For performance failures, capture baseline diff and rollback the regressing change when required.
4. For repeated CI gate failures, halt rollout and open remediation item in governance tracker.
5. Run retention purge job for expired preview artifacts:
   - Workflow: `preview-artifact-retention`
   - Tool: `node tools/purge-preview-artifacts.mjs --root <path> --retention-days <n>`

## Escalation
1. P1 (tenant data isolation risk): immediate rollback and security incident process.
2. P2 (blocking CI gate regression): assign backend + platform owner, resolve within current sprint.
3. P3 (warning-only quality drop): track remediation with committed due date.

## Exit Criteria
A preview run is production-ready for inclusion review when:
1. No blocking diagnostics are present.
2. Performance thresholds pass in `perf:preview`.
3. Report recommendation is `Go`.
4. Audit chain records are complete for validate/simulate/report actions.
