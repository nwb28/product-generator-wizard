# Disaster Recovery Runbook

## Objective
Guarantee generated package artifacts can be backed up and restored without corruption or drift.

## Recovery Point and Time Targets
- RPO target: 15 minutes (artifact storage replication interval)
- RTO target: 60 minutes (restore and validation for generator package outputs)

## Backup Scope
- Generated package artifacts:
  - `manifest.json`
  - `src/`
  - `tests/`
  - `docs/runbook.md`
  - `review/human-review.md`
  - `metadata/generation.json`
- CI artifacts:
  - diagnostics output
  - review document output

## Validation Command
Run:

```bash
npm run dr:check
```

This command:
1. Generates a package from the golden fixture.
2. Copies output to backup and restore locations.
3. Verifies tree hash parity between source and restored output.
4. Verifies required restored files exist.
5. Generates preview evidence bundle inputs, backs them up, restores them, and verifies hash parity.

Drill report command:

```bash
npm run dr:report
```

Scheduled drill workflow:
- `.github/workflows/dr-drill.yml`

Preview DR artifacts included in drill evidence:
- `.tmp/dr/preview-check.json`
- `.tmp/dr/preview-restore/release-evidence.json`
- `.tmp/dr/preview-restore/release-evidence.md`

## Incident Procedure
1. Freeze release promotion while recovery is in progress.
2. Restore latest known-good artifact snapshot.
3. Run `npm run dr:check` and compare hashes.
4. Run contract gate (`generator-contract-gate`) against restored artifacts.
5. Document incident and remediation actions in `docs/operations/operations-log.md`.

## Ownership
- Primary: DevOps Engineer
- Secondary: Backend Engineer
- Approver: Tech Lead
