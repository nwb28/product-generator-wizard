# Tenant Quota Policy

## Config Source
- Default config file: `config/tenant-quotas.json`
- Optional override path: `WIZARD_TENANT_QUOTA_CONFIG_PATH`

## Resolution Order
For each request endpoint:
1. Tenant endpoint override
2. Tenant base per-minute quota
3. Default endpoint override
4. Default base per-minute quota
5. Global runtime fallback

## Notes
1. Quotas are enforced per tenant + principal identity key.
2. Distributed deployments should set `WIZARD_REDIS_URL` so quota enforcement is consistent across instances.
3. Keep tenant quota updates under change control and version review.
