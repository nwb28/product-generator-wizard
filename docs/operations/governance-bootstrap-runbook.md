# Governance Bootstrap Runbook

This runbook standardizes post-merge governance control bootstrap for repository policy surfaces.

## Prerequisites

1. `gh auth status` returns authenticated.
2. `GH_TOKEN` is exported in the shell.
3. Operator has repository admin permissions.

## Dry-Run Bootstrap

```bash
node tools/bootstrap-governance-controls.mjs --config config/governance-bootstrap.json
```

Dry-run executes:
1. Issue label bootstrap plan generation.
2. Environment protection plan generation.
3. Branch protection baseline dry-run verification.

## Apply Bootstrap

```bash
node tools/bootstrap-governance-controls.mjs --config config/governance-bootstrap.json --apply
```

Apply mode executes:
1. `tools/bootstrap-issue-labels.mjs --apply`
2. `tools/apply-environment-protection.mjs --apply`
3. `tools/apply-branch-protection-baseline.mjs` (without `--dry-run`)

## Override Target Repository

```bash
node tools/bootstrap-governance-controls.mjs \
  --owner <owner> \
  --repo <repo> \
  --branch main \
  --config config/governance-bootstrap.json
```

CLI flags override matching values in `config/governance-bootstrap.json`.
