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

export function createRedisExecutorFromEnv(env: NodeJS.ProcessEnv = process.env): RedisExecutor | null {
  const redisUrl = env.WIZARD_REDIS_URL;
  if (!redisUrl) {
    return null;
  }

  const client = createClient({ url: redisUrl });
  let connectPromise: Promise<unknown> | null = null;

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
      await ensureConnected();
      return work(client as unknown as RedisLikeClient);
    }
  };
}
