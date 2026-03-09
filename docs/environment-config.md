# Environment Configuration

## Required Variables

### API Authentication
- `WIZARD_AUTH_JWT_SECRET`
- `WIZARD_AUTH_JWT_ISSUER`
- `WIZARD_AUTH_JWT_AUDIENCE`

Behavior:
- In `development` and `test`, defaults are allowed for local workflows.
- In any other `NODE_ENV`, all three variables are required; app auth fails fast if defaults are used.

### API Runtime
- `PORT` (default: `4000`)
- `NODE_ENV` (`development`, `test`, `staging`, `production`)

## Local Development
Example:
```bash
export NODE_ENV=development
export WIZARD_AUTH_JWT_SECRET=dev-secret
export WIZARD_AUTH_JWT_ISSUER=product-generator-wizard
export WIZARD_AUTH_JWT_AUDIENCE=wizard-api
npm run build
npm test
```

## Production Baseline
- Store JWT secret in secure secret manager (e.g., Key Vault/GitHub Encrypted Secrets).
- Do not use fallback defaults.
- Rotate secret on a scheduled cadence.
- Keep issuer and audience values immutable per environment.

## CI Notes
- CI checks run in `test` mode by default.
- Production config validation is covered by auth unit tests using explicit env simulation.
