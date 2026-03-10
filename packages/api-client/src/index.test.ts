import test from 'node:test';
import assert from 'node:assert/strict';
import { WizardApiClient } from './index.js';

test('WizardApiClient attaches authorization and idempotency headers', async () => {
  let capturedHeaders: Record<string, string> | undefined;
  const client = new WizardApiClient({
    baseUrl: 'https://api.example.com',
    token: 'token-123',
    fetchImpl: (async (_url: string, init?: RequestInit) => {
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response(
        JSON.stringify({
          files: [],
          deterministicHash: 'hash'
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' }
        }
      );
    }) as typeof fetch
  });

  await client.generate({ hello: 'world' }, 'idem-1');
  assert.equal(capturedHeaders?.authorization, 'Bearer token-123');
  assert.equal(capturedHeaders?.['idempotency-key'], 'idem-1');
});

test('WizardApiClient throws on non-2xx responses', async () => {
  const client = new WizardApiClient({
    baseUrl: 'https://api.example.com',
    fetchImpl: (async () => new Response('boom', { status: 500 })) as typeof fetch
  });

  await assert.rejects(() => client.health(), /GET \/healthz failed with 500/);
});
