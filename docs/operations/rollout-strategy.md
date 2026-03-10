# Rollout Strategy (Canary + Rollback)

## Release Preconditions
1. `generator-contract-gate` passes.
2. `security-scan` passes vulnerability thresholds.
3. `npm run release:check` passes, including:
   - full build/test
   - contract CI check
   - performance baseline
   - DR restore validation

## Rollout Phases
1. Canary (5% internal tenant traffic)
2. Limited production (25% tenant cohort)
3. Broad production (100% tenant cohort)

Advance only when each phase is stable for one full business day and no Sev1/Sev2 incidents occur.

## Canary Checks
- Authz and generation success rate > 99.9%
- p95 latency remains within SLO thresholds
- No unexpected increases in `429`, `409`, or `5xx` rates
- Audit logs and telemetry traces emitted for critical paths

## Rollback Triggers
1. Any Sev1 incident linked to release.
2. Error budget burn rate exceeds 2x baseline for 15 minutes.
3. Contract failures or deterministic hash drift detected in generated outputs.

## Rollback Procedure
1. Halt rollout and route traffic to prior release version.
2. Validate restored service with:
   - `node tools/generator-cli/dist/index.js ci-check fixtures/golden/pilot-intake.json`
   - `npm run dr:check`
3. Confirm no new data contract drift.
4. Document incident in `docs/operations/operations-log.md` and open remediation tasks.

## Ownership
- Release manager: DevOps Engineer
- Technical approver: Tech Lead
- Incident commander: On-call Engineering Lead
