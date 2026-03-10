# Alert Routing and Escalation Matrix

## Sources
1. Synthetic monitor failures from `.github/workflows/synthetic-monitor.yml`
2. Burn-rate alerts from `docs/slo-alert-runbook.md`
3. Security gate failures from `.github/workflows/security-scan.yml`

## Severity Mapping
1. Sev1:
   - sustained synthetic probe failures over 2 consecutive runs
   - fast-burn threshold breach
   - confirmed contract integrity break in production
2. Sev2:
   - intermittent synthetic failures
   - slow-burn threshold breach
   - degraded generation latency outside SLO
3. Sev3:
   - non-blocking security scan increases (moderate only)
   - non-critical monitor noise

## Routing
1. Sev1:
   - primary: on-call engineering lead
   - secondary: tech lead
   - notify: product/platform SME and devops lead
2. Sev2:
   - primary: owning service engineer
   - secondary: devops engineer
3. Sev3:
   - backlog triage during weekly reliability review

## Escalation Timers
1. Sev1:
   - acknowledge in 15 minutes
   - escalate to engineering manager at 20 minutes if unacknowledged
2. Sev2:
   - acknowledge in 30 minutes
   - escalate to tech lead at 60 minutes if unresolved
3. Sev3:
   - acknowledge within one business day

## Required Incident Artifacts
1. Synthetic report artifact (`.tmp/synthetic/latest.json`)
2. Relevant release check output (`npm run release:check`)
3. Remediation tracking entry in `docs/remediation-tracker.md`
