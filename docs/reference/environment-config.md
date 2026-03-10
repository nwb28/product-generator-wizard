# Environment Configuration

## Required Variables

### API Authentication
- `WIZARD_AUTH_JWT_SECRET`
- `WIZARD_AUTH_JWT_ISSUER`
- `WIZARD_AUTH_JWT_AUDIENCE`

Behavior:
- In `development` and `test`, defaults are allowed for local workflows.
- In `staging` and `production`, all three variables are required.
- In `staging` and `production`, `WIZARD_AUTH_JWT_SECRET` must be at least 32 characters.
- In `staging` and `production`, app auth fails fast if defaults are used.

### API Runtime
- `PORT` (default: `4000`)
- `NODE_ENV` (`development`, `test`, `staging`, `production`)
- `WIZARD_RATE_LIMIT_MAX_PER_MINUTE` (optional, positive integer)
- `WIZARD_IDEMPOTENCY_TTL_MS` (optional, positive integer)

### Distributed Store (Recommended for multi-instance deployments)
- `WIZARD_REDIS_URL` (Redis connection URL, enables distributed rate limit and idempotency stores)
- `WIZARD_TENANT_QUOTA_CONFIG_PATH` (optional, path to tenant quota config JSON; default `config/tenant-quotas.json`)
- `WIZARD_REDIS_TIMEOUT_MS` (optional, Redis operation timeout in milliseconds; default `250`)
- `WIZARD_REDIS_CIRCUIT_BREAKER_THRESHOLD` (optional, consecutive failure threshold before opening circuit; default `3`)
- `WIZARD_REDIS_CIRCUIT_BREAKER_COOLDOWN_MS` (optional, circuit cooldown duration in milliseconds; default `30000`)
- `WIZARD_REDIS_FALLBACK_MODE` (`fail-open` default, or `fail-closed`)

### Audit Logging Hardening
- `WIZARD_AUDIT_HMAC_SECRET` (optional but recommended in staging/production; signs audit chain records)
- `WIZARD_AUDIT_LOG_PATH` (optional append-only NDJSON file sink for local/file-based forwarding)

## Local Development
Example:
```bash
export NODE_ENV=development
export WIZARD_AUTH_JWT_SECRET=dev-secret
export WIZARD_AUTH_JWT_ISSUER=product-generator-wizard
export WIZARD_AUTH_JWT_AUDIENCE=wizard-api
export WIZARD_REDIS_URL=redis://127.0.0.1:6379
npm run build
npm test
```

## Production Baseline
- Store JWT secret in secure secret manager (e.g., Key Vault/GitHub Encrypted Secrets).
- Do not use fallback defaults.
- Rotate secret on a scheduled cadence.
- Keep issuer and audience values immutable per environment.
- Run `npm run config:check` in deployment pipelines before releasing.
- Set `WIZARD_AUDIT_HMAC_SECRET` for tamper-evident signed audit records.
- Configure Redis resilience values and verify fallback behavior in synthetic/release checks.

## Secret Sources
Recommended secret flow:
1. Store canonical secrets in cloud secret manager (Azure Key Vault or equivalent).
2. Mirror only deployment-required values to GitHub Environment Secrets (`staging`/`production`).
3. Scope GitHub environments with approval rules and branch protections.
4. Avoid repository-level secrets when environment-scoped values are available.

## Validation Command
- Production/staging style validation:
  - `npm run config:check`
- Alternate explicit target:
  - `node tools/validate-env.mjs --target=staging`

## CI Notes
- CI checks run in `test` mode by default.
- Production config validation is covered by auth unit tests using explicit env simulation.
