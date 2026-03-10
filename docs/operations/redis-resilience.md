# Redis Resilience and Fallback Policy

## Objective
Maintain API availability when Redis is degraded while preserving contract correctness.

## Controls
1. Redis operation timeout (`WIZARD_REDIS_TIMEOUT_MS`).
2. Circuit breaker on repeated failures:
   - threshold: `WIZARD_REDIS_CIRCUIT_BREAKER_THRESHOLD`
   - cooldown: `WIZARD_REDIS_CIRCUIT_BREAKER_COOLDOWN_MS`
3. Fallback behavior:
   - Rate limit falls back to local in-memory limiter.
   - Idempotency falls back to local in-memory store.

## Runtime Indicators
- Response header `X-RateLimit-Backend`: `primary` or `fallback`
- Response header `X-Idempotency-Backend`: `primary` or `fallback`

## Tradeoff
Fallback keeps service available but does not provide cross-instance consistency until Redis recovers.
