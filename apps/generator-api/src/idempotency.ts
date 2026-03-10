import { createHash } from 'node:crypto';
import type { RedisExecutor } from './redis-executor.js';

export type IdempotencyResult =
  | { kind: 'miss' }
  | { kind: 'hit'; response: CachedResponse }
  | { kind: 'conflict'; message: string };

export type CachedResponse = {
  status: number;
  body: unknown;
  createdAtMs: number;
};

type CacheEntry =
  | { state: 'inflight'; fingerprint: string; createdAtMs: number }
  | { state: 'done'; fingerprint: string; createdAtMs: number; response: CachedResponse };

type IdempotencyStoreConfig = {
  ttlMs: number;
  now?: () => number;
};

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

type RedisIdempotencyStoreConfig = IdempotencyStoreConfig & {
  executor: RedisExecutor;
  keyPrefix?: string;
};

export type IdempotencyStore = {
  lookup(scope: string, key: string, fingerprint: string): Promise<IdempotencyResult>;
  save(scope: string, key: string, fingerprint: string, response: CachedResponse): Promise<void>;
  discard(scope: string, key: string): Promise<void>;
};

export function createIdempotencyStore(config: Partial<IdempotencyStoreConfig> = {}): IdempotencyStore {
  const ttlMs = ensurePositiveInteger(config.ttlMs, DEFAULT_TTL_MS);
  const now = config.now ?? Date.now;
  const entries = new Map<string, CacheEntry>();

  return {
    async lookup(scope: string, key: string, fingerprint: string): Promise<IdempotencyResult> {
      const mapKey = `${scope}:${key}`;
      const stamp = now();
      const current = entries.get(mapKey);

      if (!current || current.createdAtMs + ttlMs <= stamp) {
        entries.set(mapKey, { state: 'inflight', fingerprint, createdAtMs: stamp });
        cleanupEntries(entries, stamp, ttlMs);
        return { kind: 'miss' };
      }

      if (current.fingerprint !== fingerprint) {
        return { kind: 'conflict', message: 'Idempotency key has already been used with a different request payload.' };
      }

      if (current.state === 'inflight') {
        return { kind: 'conflict', message: 'An operation with this idempotency key is currently in progress.' };
      }

      return { kind: 'hit', response: current.response };
    },
    async save(scope: string, key: string, fingerprint: string, response: CachedResponse): Promise<void> {
      entries.set(`${scope}:${key}`, { state: 'done', fingerprint, response, createdAtMs: now() });
    },
    async discard(scope: string, key: string): Promise<void> {
      entries.delete(`${scope}:${key}`);
    }
  };
}

export function createRedisIdempotencyStore(
  config: Partial<RedisIdempotencyStoreConfig> & Pick<RedisIdempotencyStoreConfig, 'executor'>
): IdempotencyStore {
  const ttlMs = ensurePositiveInteger(config.ttlMs, DEFAULT_TTL_MS);
  const now = config.now ?? Date.now;
  const keyPrefix = config.keyPrefix ?? 'wizard:idempotency';
  const executor = config.executor;

  return {
    async lookup(scope: string, key: string, fingerprint: string): Promise<IdempotencyResult> {
      const redisKey = `${keyPrefix}:${scope}:${key}`;
      const stamp = now();
      const inflightValue = JSON.stringify({ state: 'inflight', fingerprint, createdAtMs: stamp });

      const created = await executor.run(async (client) => await client.set(redisKey, inflightValue, { NX: true, PX: ttlMs }));
      if (created === 'OK') {
        return { kind: 'miss' };
      }

      const raw = await executor.run(async (client) => await client.get(redisKey));
      if (!raw) {
        return { kind: 'miss' };
      }

      const current = parseCacheEntry(raw);
      if (!current) {
        return { kind: 'conflict', message: 'Idempotency key has invalid cache state. Retry with a new key.' };
      }

      if (current.fingerprint !== fingerprint) {
        return { kind: 'conflict', message: 'Idempotency key has already been used with a different request payload.' };
      }

      if (current.state === 'inflight') {
        return { kind: 'conflict', message: 'An operation with this idempotency key is currently in progress.' };
      }

      return { kind: 'hit', response: current.response };
    },
    async save(scope: string, key: string, fingerprint: string, response: CachedResponse): Promise<void> {
      const redisKey = `${keyPrefix}:${scope}:${key}`;
      const value = JSON.stringify({
        state: 'done',
        fingerprint,
        createdAtMs: now(),
        response
      });

      const updated = await executor.run(async (client) => await client.set(redisKey, value, { XX: true, PX: ttlMs }));
      if (!updated) {
        await executor.run(async (client) => await client.set(redisKey, value, { PX: ttlMs }));
      }
    },
    async discard(scope: string, key: string): Promise<void> {
      const redisKey = `${keyPrefix}:${scope}:${key}`;
      await executor.run(async (client) => await client.del(redisKey));
    }
  };
}

export function fingerprintPayload(payload: unknown): string {
  return createHash('sha256').update(stableSerialize(payload), 'utf8').digest('hex');
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue).sort();
    const serialized = keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(objectValue[key])}`);
    return `{${serialized.join(',')}}`;
  }

  return JSON.stringify(value);
}

function ensurePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return fallback;
  }

  return Math.floor(value);
}

function cleanupEntries(entries: Map<string, CacheEntry>, nowMs: number, ttlMs: number): void {
  if (entries.size < 10_000) {
    return;
  }

  for (const [key, value] of entries) {
    if (value.createdAtMs + ttlMs <= nowMs) {
      entries.delete(key);
    }
  }
}

function parseCacheEntry(raw: string): CacheEntry | null {
  try {
    const parsed = JSON.parse(raw) as Partial<CacheEntry>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    if (parsed.state === 'inflight' && typeof parsed.fingerprint === 'string' && typeof parsed.createdAtMs === 'number') {
      return parsed as CacheEntry;
    }

    if (
      parsed.state === 'done' &&
      typeof parsed.fingerprint === 'string' &&
      typeof parsed.createdAtMs === 'number' &&
      parsed.response &&
      typeof parsed.response === 'object'
    ) {
      const response = parsed.response as Partial<CachedResponse>;
      if (typeof response.status === 'number' && 'body' in response && typeof response.createdAtMs === 'number') {
        return {
          state: 'done',
          fingerprint: parsed.fingerprint,
          createdAtMs: parsed.createdAtMs,
          response: {
            status: response.status,
            body: response.body,
            createdAtMs: response.createdAtMs
          }
        };
      }
    }

    return null;
  } catch {
    return null;
  }
}
