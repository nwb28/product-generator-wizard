# Tenant Quota Change Workflow

## Scope
Changes to `config/tenant-quotas.json`.

## Process
1. Open PR with quota changes.
2. `tenant-quota-governance` workflow runs automatically.
3. Workflow validates config and publishes `.tmp/quota/review.json` artifact.
4. Workflow posts/updates a PR comment containing quota diff markdown.
5. Required reviewers:
   - service tech lead
   - product/platform SME
6. Merge only after approval and successful governance check.

## Audit Trail
1. PR discussion and review approvals.
2. Workflow artifact with reviewed tenant quota summary.
3. Post-merge entry in `docs/operations-log.md` for material quota changes.
