# Deployment Workflow

## Workflow
- `.github/workflows/deploy.yml`

## Trigger
- Manual dispatch only (`workflow_dispatch`)
- Inputs:
  - `target_environment`: `staging` or `production`
  - `deploy_ref`: branch/tag/SHA to deploy

## Gates
1. Preflight checks:
   - `npm run release:check`
   - `npm run config:check` (with environment secrets)
2. Environment protection:
   - Uses GitHub `environment` for approval policy and secret scope.

## Required Environment Secrets
- `WIZARD_AUTH_JWT_SECRET`
- `WIZARD_AUTH_JWT_ISSUER`
- `WIZARD_AUTH_JWT_AUDIENCE`
- `WIZARD_AUDIT_HMAC_SECRET`

## Enterprise Policy
1. Configure required reviewers on `production` environment.
2. Allow `staging` deployment without production approvers.
3. Keep deployment action manual until runtime deployment automation is explicitly approved.
