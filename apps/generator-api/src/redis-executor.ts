import { createClient } from 'redis';

export type RedisLikeClient = {
  ping(): Promise<string>;
  incr(key: string): Promise<number>;
  pExpire(key: string, milliseconds: number): Promise<number>;
  pTTL(key: string): Promise<number>;
  set(
    key: string,
    value: string,
    options?: {
      NX?: boolean;
      XX?: boolean;
      PX?: number;
    }
  ): Promise<'OK' | null>;
  get(key: string): Promise<string | null>;
  del(key: string): Promise<number>;
};

export type RedisExecutor = {
  run<T>(work: (client: RedisLikeClient) => Promise<T>): Promise<T>;
};

export class RedisCircuitOpenError extends Error {}

type RedisResilienceConfig = {
  timeoutMs: number;
  failureThreshold: number;
  cooldownMs: number;
};

export function createRedisExecutorFromEnv(env: NodeJS.ProcessEnv = process.env): RedisExecutor | null {
  const redisUrl = env.WIZARD_REDIS_URL;
  if (!redisUrl) {
    return null;
  }
  const resilience = readResilienceConfig(env);

  const client = createClient({ url: redisUrl });
  let connectPromise: Promise<unknown> | null = null;
  let failureCount = 0;
  let circuitOpenUntil = 0;

  client.on('error', (error) => {
    process.stderr.write(`redis-client-error: ${error instanceof Error ? error.message : String(error)}\n`);
  });

  async function ensureConnected(): Promise<void> {
    if (client.isOpen) {
      return;
    }

    if (!connectPromise) {
      connectPromise = client.connect().catch((error) => {
        connectPromise = null;
        throw error;
      });
    }

    await connectPromise;
  }

  return {
    async run<T>(work: (connectedClient: RedisLikeClient) => Promise<T>): Promise<T> {
      if (Date.now() < circuitOpenUntil) {
        throw new RedisCircuitOpenError('Redis circuit breaker is open.');
      }

      await ensureConnected();
      try {
        const result = await withTimeout(
          work(client as unknown as RedisLikeClient),
          resilience.timeoutMs,
          'Redis operation timed out.'
        );
        failureCount = 0;
        return result;
      } catch (error) {
        failureCount += 1;
        if (failureCount >= resilience.failureThreshold) {
          circuitOpenUntil = Date.now() + resilience.cooldownMs;
          failureCount = 0;
        }
        throw error;
      }
    }
  };
}

function readResilienceConfig(env: NodeJS.ProcessEnv): RedisResilienceConfig {
  return {
    timeoutMs: readPositiveInt(env.WIZARD_REDIS_TIMEOUT_MS, 250),
    failureThreshold: readPositiveInt(env.WIZARD_REDIS_CIRCUIT_BREAKER_THRESHOLD, 3),
    cooldownMs: readPositiveInt(env.WIZARD_REDIS_CIRCUIT_BREAKER_COOLDOWN_MS, 30_000)
  };
}

function readPositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw) {
    return fallback;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}
