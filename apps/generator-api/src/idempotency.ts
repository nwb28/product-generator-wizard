import { createHash } from 'node:crypto';

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

export function createIdempotencyStore(config: Partial<IdempotencyStoreConfig> = {}) {
  const ttlMs = ensurePositiveInteger(config.ttlMs, DEFAULT_TTL_MS);
  const now = config.now ?? Date.now;
  const entries = new Map<string, CacheEntry>();

  return {
    lookup(scope: string, key: string, fingerprint: string): IdempotencyResult {
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
    save(scope: string, key: string, fingerprint: string, response: CachedResponse): void {
      entries.set(`${scope}:${key}`, { state: 'done', fingerprint, response, createdAtMs: now() });
    },
    discard(scope: string, key: string): void {
      entries.delete(`${scope}:${key}`);
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
