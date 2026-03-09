import type { RedisExecutor } from './redis-executor.js';

export type RateLimitCheckResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAtEpochSeconds: number;
};

export type RateLimiter = {
  check(endpoint: string, key: string): Promise<RateLimitCheckResult>;
};

type RateLimitCounter = {
  count: number;
  resetAtMs: number;
};

type RateLimiterConfig = {
  windowMs: number;
  maxRequests: number;
  now?: () => number;
};

type RedisRateLimiterConfig = RateLimiterConfig & {
  executor: RedisExecutor;
  keyPrefix?: string;
};

const DEFAULT_WINDOW_MS = 60_000;
const DEFAULT_MAX_REQUESTS = 120;

export function createRateLimiter(config: Partial<RateLimiterConfig> = {}): RateLimiter {
  const now = config.now ?? Date.now;
  const windowMs = ensurePositiveInteger(config.windowMs, DEFAULT_WINDOW_MS);
  const maxRequests = ensurePositiveInteger(config.maxRequests, DEFAULT_MAX_REQUESTS);
  const counters = new Map<string, RateLimitCounter>();

  return {
    async check(endpoint, key) {
      const stamp = now();
      const mapKey = `${endpoint}:${key}`;
      const current = counters.get(mapKey);

      if (!current || stamp >= current.resetAtMs) {
        const next = { count: 1, resetAtMs: stamp + windowMs };
        counters.set(mapKey, next);
        cleanupCounters(counters, stamp);
        return {
          allowed: true,
          limit: maxRequests,
          remaining: Math.max(0, maxRequests - 1),
          resetAtEpochSeconds: Math.ceil(next.resetAtMs / 1000)
        };
      }

      current.count += 1;
      const allowed = current.count <= maxRequests;
      return {
        allowed,
        limit: maxRequests,
        remaining: Math.max(0, maxRequests - current.count),
        resetAtEpochSeconds: Math.ceil(current.resetAtMs / 1000)
      };
    }
  };
}

export function createRedisRateLimiter(config: Partial<RedisRateLimiterConfig> & Pick<RedisRateLimiterConfig, 'executor'>): RateLimiter {
  const now = config.now ?? Date.now;
  const windowMs = ensurePositiveInteger(config.windowMs, DEFAULT_WINDOW_MS);
  const maxRequests = ensurePositiveInteger(config.maxRequests, DEFAULT_MAX_REQUESTS);
  const keyPrefix = config.keyPrefix ?? 'wizard:rate-limit';
  const executor = config.executor;

  return {
    async check(endpoint, key) {
      const redisKey = `${keyPrefix}:${endpoint}:${key}`;
      const count = await executor.run(async (client) => await client.incr(redisKey));
      if (count === 1) {
        await executor.run(async (client) => await client.pExpire(redisKey, windowMs));
      }

      let ttlMs = await executor.run(async (client) => await client.pTTL(redisKey));
      if (ttlMs < 0) {
        ttlMs = windowMs;
        await executor.run(async (client) => await client.pExpire(redisKey, windowMs));
      }

      const resetAtEpochSeconds = Math.ceil((now() + ttlMs) / 1000);
      return {
        allowed: count <= maxRequests,
        limit: maxRequests,
        remaining: Math.max(0, maxRequests - count),
        resetAtEpochSeconds
      };
    }
  };
}

function ensurePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return fallback;
  }

  return Math.floor(value);
}

function cleanupCounters(counters: Map<string, RateLimitCounter>, nowMs: number): void {
  if (counters.size < 5_000) {
    return;
  }

  for (const [key, value] of counters) {
    if (value.resetAtMs <= nowMs) {
      counters.delete(key);
    }
  }
}
