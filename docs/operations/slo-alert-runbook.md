# SLO Burn-Rate Alert Runbook

## Signals
- Synthetic probe status from `.github/workflows/synthetic-monitor.yml`
- Preview probe status for `/preview/validate`, `/preview/simulate`, `/preview/report`
- API metrics:
  - `wizard_api_requests_total`
  - `wizard_api_request_duration_ms`

## Burn-Rate Alert Thresholds
Assuming 99.9% availability SLO:
1. Fast-burn alert:
   - Window: 5 minutes
   - Trigger: error ratio > 2%
2. Slow-burn alert:
   - Window: 1 hour
   - Trigger: error ratio > 0.5%

## Immediate Actions
1. Confirm synthetic probe failure details in `.tmp/synthetic/latest.json` artifact.
2. Check `429`, `409`, and `5xx` trends in telemetry dashboards.
3. If fast-burn threshold is hit:
   - halt active rollout
   - execute rollback procedure from `docs/operations/rollout-strategy.md`

## Investigation Checklist
1. Validate auth and config state (`npm run config:check`).
2. Validate contract path (`node tools/generator-cli/dist/index.js ci-check fixtures/golden/pilot-intake.json`).
3. Validate reliability baselines:
   - `npm run perf:baseline`
   - `npm run dr:check`

## Exit Criteria
1. Synthetic probe returns to green for at least 2 consecutive runs.
2. Fast-burn and slow-burn thresholds are below trigger levels.
3. Incident record created in `docs/operations/operations-log.md` with root cause and remediation.
4. Alert routing and escalation follow `docs/operations/alert-routing.md`.
