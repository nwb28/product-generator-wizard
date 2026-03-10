# Audit Forwarder

## Purpose
Forward signed/tamper-evident audit records from append-only NDJSON logs to SIEM with retry/backoff.

## Command
```bash
node tools/audit-forwarder.mjs
```

Dry run:
```bash
node tools/audit-forwarder.mjs --dry-run
```

## Environment Variables
- `WIZARD_AUDIT_LOG_PATH` (default `.tmp/audit/audit.ndjson`)
- `WIZARD_AUDIT_FORWARDER_STATE_PATH` (default `.tmp/audit/forwarder-state.json`)
- `WIZARD_AUDIT_FORWARDER_ENDPOINT` (required unless dry run)
- `WIZARD_AUDIT_FORWARDER_TOKEN` (optional bearer token)
- `WIZARD_AUDIT_FORWARDER_BATCH_SIZE` (default `100`)
- `WIZARD_AUDIT_FORWARDER_MAX_RETRIES` (default `5`)
- `WIZARD_AUDIT_FORWARDER_BASE_BACKOFF_MS` (default `500`)

## Retry Policy
Exponential backoff: `base * 2^(attempt-1)` until max retries.
