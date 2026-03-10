# Typed API Client

Package: `@pgw/packages-api-client`

## Purpose
Provide a typed fetch-based client wrapper for Wizard API endpoints.

## Covered Endpoints
1. `validate`
2. `compile`
3. `generate`
4. `review-document`
5. `healthz`
6. `readyz`

## Notes
1. Supports bearer auth token injection.
2. Supports idempotency key headers for generation endpoints.
3. Throws typed errors on non-2xx responses.
