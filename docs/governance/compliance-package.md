# Compliance Package Baseline

## Purpose
Define minimum controls for operating Product Generator Wizard in regulated enterprise environments.

## Data Classification
1. Intake payloads: confidential business metadata.
2. Generated artifacts: internal confidential implementation outputs.
3. Audit logs: restricted operational security records.

## Retention Policy
1. Intake and generated artifact records: retain 365 days unless customer contract requires shorter duration.
2. CI diagnostics artifacts: retain 30 days.
3. Security scan artifacts: retain 14 days.
4. Audit logs: retain minimum 400 days for forensics and compliance reviews.

## Access Controls
1. Require role-based access at wizard entry and generation actions.
2. Enforce tenant scoping on rate limits and idempotency keys.
3. Restrict production secrets to environment-scoped secret stores.

## Audit Logging Controls
1. Log authz decisions (`allow`/`deny`) and generation actions (`success`/`failure`/`conflict`/`replayed`/`throttled`).
2. Include `requestId`, `tenantId`, endpoint, and principal subject when available.
3. Export logs to central immutable storage with retention lock.

## Incident Response Baseline
1. Severity model:
   - Sev1: broad outage, contract integrity risk, or confirmed data exposure
   - Sev2: major degradation impacting key customer workflows
2. Initial response target:
   - Sev1 acknowledgment within 15 minutes
   - Sev2 acknowledgment within 30 minutes
3. Required actions:
   - freeze rollout
   - preserve logs and artifacts
   - run rollback procedure from `docs/operations/rollout-strategy.md`
   - capture post-incident RCA within 5 business days

## Evidence Checklist
1. Latest passing `generator-contract-gate` run.
2. Latest passing `preview-contract-gate` run.
3. Latest passing `security-scan` report.
4. Latest passing `sbom` artifact.
5. Latest passing `release-evidence-bundle` artifact (`release-evidence.json` + `release-evidence.md`).
6. Latest passing `release:check` output.
7. Current environment config validation (`npm run config:check`).
8. Current DR validation (`npm run dr:check`).
