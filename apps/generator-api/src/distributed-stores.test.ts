import test from 'node:test';
import assert from 'node:assert/strict';
import { createRedisIdempotencyStore } from './idempotency.js';
import { createRedisRateLimiter } from './rate-limit.js';

class FakeRedis {
  private readonly data = new Map<string, { value: string | number; expiresAtMs: number | null }>();

  async incr(key: string): Promise<number> {
    const current = this.read(key);
    const next = (typeof current?.value === 'number' ? current.value : Number.parseInt(String(current?.value ?? '0'), 10) || 0) + 1;
    this.write(key, next, current?.expiresAtMs ?? null);
    return next;
  }

  async pExpire(key: string, ms: number): Promise<number> {
    const current = this.read(key);
    if (!current) {
      return 0;
    }
    this.write(key, current.value, Date.now() + ms);
    return 1;
  }

  async pTTL(key: string): Promise<number> {
    const current = this.read(key);
    if (!current) {
      return -2;
    }
    if (current.expiresAtMs === null) {
      return -1;
    }
    return Math.max(0, current.expiresAtMs - Date.now());
  }

  async set(
    key: string,
    value: string,
    options?: {
      NX?: boolean;
      XX?: boolean;
      PX?: number;
    }
  ): Promise<'OK' | null> {
    const current = this.read(key);
    if (options?.NX && current) {
      return null;
    }
    if (options?.XX && !current) {
      return null;
    }
    this.write(key, value, options?.PX ? Date.now() + options.PX : current?.expiresAtMs ?? null);
    return 'OK';
  }

  async get(key: string): Promise<string | null> {
    const current = this.read(key);
    if (!current) {
      return null;
    }
    return typeof current.value === 'string' ? current.value : String(current.value);
  }

  async del(key: string): Promise<number> {
    return this.data.delete(key) ? 1 : 0;
  }

  private read(key: string): { value: string | number; expiresAtMs: number | null } | null {
    const current = this.data.get(key);
    if (!current) {
      return null;
    }
    if (current.expiresAtMs !== null && current.expiresAtMs <= Date.now()) {
      this.data.delete(key);
      return null;
    }
    return current;
  }

  private write(key: string, value: string | number, expiresAtMs: number | null): void {
    this.data.set(key, { value, expiresAtMs });
  }
}

function fakeExecutor() {
  const client = new FakeRedis();
  return {
    run: async <T>(work: (redisClient: any) => Promise<T>) => await work(client)
  };
}

test('redis rate limiter enforces request threshold across keys', async () => {
  const limiter = createRedisRateLimiter({
    executor: fakeExecutor(),
    maxRequests: 1,
    windowMs: 60_000
  });

  const first = await limiter.check('generate', 'tenant-a:user-a');
  assert.equal(first.allowed, true);

  const second = await limiter.check('generate', 'tenant-a:user-a');
  assert.equal(second.allowed, false);

  const third = await limiter.check('generate', 'tenant-b:user-a');
  assert.equal(third.allowed, true);
});

test('redis idempotency store supports miss -> save -> hit lifecycle', async () => {
  const store = createRedisIdempotencyStore({
    executor: fakeExecutor(),
    ttlMs: 60_000
  });

  const lookup = await store.lookup('generate:tenant-a:user-a', 'idem-001', 'fingerprint-1');
  assert.equal(lookup.kind, 'miss');

  await store.save('generate:tenant-a:user-a', 'idem-001', 'fingerprint-1', {
    status: 200,
    body: { ok: true },
    createdAtMs: Date.now()
  });

  const replay = await store.lookup('generate:tenant-a:user-a', 'idem-001', 'fingerprint-1');
  assert.equal(replay.kind, 'hit');
  if (replay.kind === 'hit') {
    assert.equal(replay.response.status, 200);
  }
});

test('redis idempotency store detects fingerprint conflict', async () => {
  const store = createRedisIdempotencyStore({
    executor: fakeExecutor(),
    ttlMs: 60_000
  });

  const first = await store.lookup('generate:tenant-a:user-a', 'idem-002', 'fingerprint-a');
  assert.equal(first.kind, 'miss');

  const second = await store.lookup('generate:tenant-a:user-a', 'idem-002', 'fingerprint-b');
  assert.equal(second.kind, 'conflict');
});
