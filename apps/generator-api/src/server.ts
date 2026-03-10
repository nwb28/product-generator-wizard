import express from 'express';
import { compileManifest } from '@pgw/packages-compiler/dist/index.js';
import { generateHumanReviewDocument } from '@pgw/packages-review-doc/dist/index.js';
import { generatePilotScaffold } from '@pgw/packages-scaffold-templates/dist/index.js';
import { toHumanSummary, validateIntake } from '@pgw/packages-validator/dist/index.js';
import { authenticatePrincipal, hasWizardAccess } from './auth.js';
import { createAuditLogger, resolveRequestId, type AuditLogger, type AuditOutcome } from './audit.js';
import {
  createIdempotencyStore,
  createRedisIdempotencyStore,
  fingerprintPayload,
  type IdempotencyStore
} from './idempotency.js';
import { createRateLimiter, createRedisRateLimiter, type RateLimitCheckResult, type RateLimiter } from './rate-limit.js';
import { createRedisExecutorFromEnv, type RedisExecutor } from './redis-executor.js';
import { createTelemetryClient, type TelemetryClient, type TelemetrySpan } from './telemetry.js';
import { createTenantQuotaPolicy, loadTenantQuotaConfigOrThrow } from './tenant-quotas.js';

type AppOptions = {
  rateLimiter?: RateLimiter;
  idempotencyStore?: IdempotencyStore;
  auditLogger?: AuditLogger;
  telemetry?: TelemetryClient;
  redisExecutor?: RedisExecutor | null;
};

export function createApp(options: AppOptions = {}) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  const auditLogger = options.auditLogger ?? createAuditLogger();
  const telemetry = options.telemetry ?? createTelemetryClient();
  const redisExecutor = options.redisExecutor === undefined ? createRedisExecutorFromEnv() : options.redisExecutor;
  const maxRatePerMinute = readEnvPositiveInteger(
    'WIZARD_RATE_LIMIT_MAX_PER_MINUTE',
    process.env.NODE_ENV === 'test' ? 10_000 : 120
  );
  const tenantQuotaPath = process.env.WIZARD_TENANT_QUOTA_CONFIG_PATH ?? 'config/tenant-quotas.json';
  const tenantQuotaConfig = loadTenantQuotaConfigOrThrow(tenantQuotaPath);
  const tenantQuotaPolicy = createTenantQuotaPolicy(tenantQuotaConfig, maxRatePerMinute);
  const idempotencyTtlMs = readEnvPositiveInteger('WIZARD_IDEMPOTENCY_TTL_MS', 86_400_000);
  const distributedRateLimiterEnabled = Boolean(redisExecutor) && !options.rateLimiter;
  const distributedIdempotencyEnabled = Boolean(redisExecutor) && !options.idempotencyStore;
  const limiterByPerMinute = new Map<number, RateLimiter>();
  const fallbackLimiterByPerMinute = new Map<number, RateLimiter>();
  const rateLimiterFactory = (perMinute: number): RateLimiter => {
    if (options.rateLimiter) {
      return options.rateLimiter;
    }
    if (redisExecutor) {
      return createRedisRateLimiter({ executor: redisExecutor, maxRequests: perMinute, windowMs: 60_000 });
    }
    return createRateLimiter({ maxRequests: perMinute, windowMs: 60_000 });
  };
  const resolveRateLimiter = (perMinute: number): RateLimiter => {
    const existing = limiterByPerMinute.get(perMinute);
    if (existing) {
      return existing;
    }
    const next = rateLimiterFactory(perMinute);
    limiterByPerMinute.set(perMinute, next);
    return next;
  };
  const resolveFallbackRateLimiter = (perMinute: number): RateLimiter => {
    const existing = fallbackLimiterByPerMinute.get(perMinute);
    if (existing) {
      return existing;
    }
    const next = createRateLimiter({ maxRequests: perMinute, windowMs: 60_000 });
    fallbackLimiterByPerMinute.set(perMinute, next);
    return next;
  };
  const idempotencyStore =
    options.idempotencyStore ??
    (redisExecutor
      ? createRedisIdempotencyStore({ executor: redisExecutor, ttlMs: idempotencyTtlMs })
      : createIdempotencyStore({ ttlMs: idempotencyTtlMs }));
  const fallbackIdempotencyStore = createIdempotencyStore({ ttlMs: idempotencyTtlMs });

  app.use((req, res, next) => {
    const span = telemetry.startSpan('http.server.request', {
      method: req.method,
      path: req.path
    });
    const started = Date.now();

    res.once('finish', () => {
      const statusCode = res.statusCode;
      const outcome = statusCode === 429 ? 'throttled' : statusCode >= 500 ? 'error' : 'success';
      finalizeTelemetry(telemetry, span, started, statusCode, req.path, req.method, outcome);
    });

    next();
  });

  app.get('/healthz', (_req, res) => {
    res.status(200).json({ status: 'ok' });
  });

  app.get('/readyz', async (_req, res) => {
    const checks: Record<string, 'ok' | 'failed' | 'not-configured'> = {
      api: 'ok',
      redis: 'not-configured'
    };

    if (redisExecutor) {
      try {
        await redisExecutor.run(async (client) => {
          await client.ping();
        });
        checks.redis = 'ok';
      } catch {
        checks.redis = 'failed';
      }
    }

    const ready = Object.values(checks).every((status) => status === 'ok' || status === 'not-configured');
    res.status(ready ? 200 : 503).json({ ready, checks });
  });

  app.get('/authz/wizard-entry', async (req, res) => {
    const principal = await authenticatePrincipal(req);
    const requestId = resolveRequestId(req.header('x-request-id'));
    const tenantId = resolveTenantId(req);
    const rateLimitPerMinute = tenantQuotaPolicy.resolvePerMinute(tenantId, 'authz:wizard-entry');
    const rateLimit = await checkRateLimit(
      'authz:wizard-entry',
      resolveRequestIdentity(req, principal?.sub),
      rateLimitPerMinute
    );
    if (!applyRateLimit(res, rateLimit.result, rateLimit.backend)) {
      emitAudit(auditLogger, {
        requestId,
        tenantId,
        endpoint: '/authz/wizard-entry',
        action: 'wizard-entry',
        outcome: 'throttled',
        principalSub: principal?.sub
      });
      return;
    }

    if (!hasWizardAccess(principal)) {
      emitAudit(auditLogger, {
        requestId,
        tenantId,
        endpoint: '/authz/wizard-entry',
        action: 'wizard-entry',
        outcome: 'deny',
        principalSub: principal?.sub
      });
      res.status(403).json({ authorized: false });
      return;
    }

    emitAudit(auditLogger, {
      requestId,
      tenantId,
      endpoint: '/authz/wizard-entry',
      action: 'wizard-entry',
      outcome: 'allow',
      principalSub: principal?.sub
    });
    res.status(200).json({ authorized: true, sub: principal?.sub });
  });

  app.post('/validate', async (req, res) => {
    const tenantId = resolveTenantId(req);
    const rateLimitPerMinute = tenantQuotaPolicy.resolvePerMinute(tenantId, 'validate');
    const rateLimit = await checkRateLimit('validate', resolveRequestIdentity(req), rateLimitPerMinute);
    if (!applyRateLimit(res, rateLimit.result, rateLimit.backend)) {
      return;
    }

    const validation = validateIntake(req.body);
    res.status(validation.valid ? 200 : 400).json({
      valid: validation.valid,
      diagnostics: validation.diagnostics,
      summary: validation.summary,
      humanSummary: toHumanSummary(validation)
    });
  });

  app.post('/compile', async (req, res) => {
    const principal = await authenticatePrincipal(req);
    const requestId = resolveRequestId(req.header('x-request-id'));
    const tenantId = resolveTenantId(req);
    const rateLimitPerMinute = tenantQuotaPolicy.resolvePerMinute(tenantId, 'compile');
    const rateLimit = await checkRateLimit('compile', resolveRequestIdentity(req, principal?.sub), rateLimitPerMinute);
    if (!applyRateLimit(res, rateLimit.result, rateLimit.backend)) {
      emitAudit(auditLogger, {
        requestId,
        tenantId,
        endpoint: '/compile',
        action: 'compile',
        outcome: 'throttled',
        principalSub: principal?.sub
      });
      return;
    }

    if (!principal || !hasWizardAccess(principal)) {
      emitAudit(auditLogger, {
        requestId,
        tenantId,
        endpoint: '/compile',
        action: 'compile',
        outcome: 'deny',
        principalSub: principal?.sub
      });
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    try {
      const manifest = compileManifest(req.body as any);
      emitAudit(auditLogger, {
        requestId,
        tenantId,
        endpoint: '/compile',
        action: 'compile',
        outcome: 'success',
        principalSub: principal.sub
      });
      res.status(200).json({ manifest });
    } catch (error) {
      emitAudit(auditLogger, {
        requestId,
        tenantId,
        endpoint: '/compile',
        action: 'compile',
        outcome: 'failure',
        principalSub: principal.sub,
        detail: asMessage(error)
      });
      res.status(400).json({ message: asMessage(error) });
    }
  });

  app.post('/generate', async (req, res) => {
    const principal = await authenticatePrincipal(req);
    const requestId = resolveRequestId(req.header('x-request-id'));
    const tenantId = resolveTenantId(req);
    const rateLimitPerMinute = tenantQuotaPolicy.resolvePerMinute(tenantId, 'generate');
    const rateLimit = await checkRateLimit('generate', resolveRequestIdentity(req, principal?.sub), rateLimitPerMinute);
    if (!applyRateLimit(res, rateLimit.result, rateLimit.backend)) {
      emitAudit(auditLogger, {
        requestId,
        tenantId,
        endpoint: '/generate',
        action: 'generate',
        outcome: 'throttled',
        principalSub: principal?.sub
      });
      return;
    }

    if (!principal || !hasWizardAccess(principal)) {
      emitAudit(auditLogger, {
        requestId,
        tenantId,
        endpoint: '/generate',
        action: 'generate',
        outcome: 'deny',
        principalSub: principal?.sub
      });
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    await runIdempotentJson(
      req,
      res,
      { primary: idempotencyStore, fallback: distributedIdempotencyEnabled ? fallbackIdempotencyStore : undefined },
      'generate',
      resolveRequestIdentity(req, principal.sub),
      async () => {
        const manifest = compileManifest(req.body as any);
        const output = generatePilotScaffold(manifest);
        return { status: 200, body: output };
      },
      ({ outcome, detail }) => {
        emitAudit(auditLogger, {
          requestId,
          tenantId,
          endpoint: '/generate',
          action: 'generate',
          outcome,
          principalSub: principal.sub,
          detail
        });
      }
    );
  });

  app.post('/review-document', async (req, res) => {
    const principal = await authenticatePrincipal(req);
    const requestId = resolveRequestId(req.header('x-request-id'));
    const tenantId = resolveTenantId(req);
    const rateLimitPerMinute = tenantQuotaPolicy.resolvePerMinute(tenantId, 'review-document');
    const rateLimit = await checkRateLimit('review-document', resolveRequestIdentity(req, principal?.sub), rateLimitPerMinute);
    if (!applyRateLimit(res, rateLimit.result, rateLimit.backend)) {
      emitAudit(auditLogger, {
        requestId,
        tenantId,
        endpoint: '/review-document',
        action: 'review-document',
        outcome: 'throttled',
        principalSub: principal?.sub
      });
      return;
    }

    if (!principal || !hasWizardAccess(principal)) {
      emitAudit(auditLogger, {
        requestId,
        tenantId,
        endpoint: '/review-document',
        action: 'review-document',
        outcome: 'deny',
        principalSub: principal?.sub
      });
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    await runIdempotentJson(
      req,
      res,
      { primary: idempotencyStore, fallback: distributedIdempotencyEnabled ? fallbackIdempotencyStore : undefined },
      'review-document',
      resolveRequestIdentity(req, principal.sub),
      async () => {
        const validation = validateIntake(req.body);
        const review = generateHumanReviewDocument(req.body as any, validation);
        return { status: 200, body: review };
      },
      ({ outcome, detail }) => {
        emitAudit(auditLogger, {
          requestId,
          tenantId,
          endpoint: '/review-document',
          action: 'review-document',
          outcome,
          principalSub: principal.sub,
          detail
        });
      }
    );
  });

  return app;

  async function checkRateLimit(endpoint: string, identity: string, perMinute: number) {
    const primary = resolveRateLimiter(perMinute);
    if (!distributedRateLimiterEnabled) {
      return { result: await primary.check(endpoint, identity), backend: 'primary' as const };
    }

    try {
      return { result: await primary.check(endpoint, identity), backend: 'primary' as const };
    } catch {
      return {
        result: await resolveFallbackRateLimiter(perMinute).check(endpoint, identity),
        backend: 'fallback' as const
      };
    }
  }
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function resolveRequestIdentity(req: express.Request, subject?: string): string {
  const tenant = resolveTenantId(req);
  const principal = subject ?? req.ip ?? 'unknown-principal';
  return `${tenant}:${principal}`;
}

function resolveTenantId(req: express.Request): string {
  return req.header('x-tenant-id') ?? req.header('x-tenant') ?? req.query.tenant?.toString() ?? 'unknown-tenant';
}

function applyRateLimit(res: express.Response, result: RateLimitCheckResult, backend: 'primary' | 'fallback'): boolean {
  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(result.resetAtEpochSeconds));
  res.setHeader('X-RateLimit-Backend', backend);

  if (result.allowed) {
    return true;
  }

  const nowEpochSeconds = Math.ceil(Date.now() / 1000);
  const retryAfter = Math.max(1, result.resetAtEpochSeconds - nowEpochSeconds);
  res.setHeader('Retry-After', String(retryAfter));
  res.status(429).json({ message: 'Rate limit exceeded. Retry later.' });
  return false;
}

function readEnvPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

async function runIdempotentJson(
  req: express.Request,
  res: express.Response,
  stores: { primary: IdempotencyStore; fallback?: IdempotencyStore | undefined },
  endpoint: string,
  identityScope: string,
  execute: () => Promise<{ status: number; body: unknown }>,
  onAudit: (event: { outcome: AuditOutcome; detail?: string | undefined }) => void
): Promise<void> {
  const idempotencyKey = req.header('idempotency-key');
  if (!idempotencyKey) {
    await sendJsonResponse(res, execute, onAudit);
    return;
  }

  const requestFingerprint = fingerprintPayload(req.body);
  const scope = `${endpoint}:${identityScope}`;
  const selected = await selectIdempotencyStore(stores, scope, idempotencyKey, requestFingerprint);
  const lookup = selected.lookup;
  res.setHeader('X-Idempotency-Backend', selected.backend);

  if (lookup.kind === 'hit') {
    onAudit({ outcome: 'replayed' });
    res.setHeader('X-Idempotency-Status', 'replayed');
    res.status(lookup.response.status).json(lookup.response.body);
    return;
  }

  if (lookup.kind === 'conflict') {
    onAudit({ outcome: 'conflict', detail: lookup.message });
    res.setHeader('X-Idempotency-Status', 'conflict');
    res.status(409).json({ message: lookup.message });
    return;
  }

  try {
    const result = await execute();
    await selected.store.save(scope, idempotencyKey, requestFingerprint, {
      status: result.status,
      body: result.body,
      createdAtMs: Date.now()
    });
    onAudit({ outcome: 'success' });
    res.setHeader('X-Idempotency-Status', 'created');
    res.status(result.status).json(result.body);
  } catch (error) {
    await selected.store.discard(scope, idempotencyKey);
    onAudit({ outcome: 'failure', detail: asMessage(error) });
    res.status(400).json({ message: asMessage(error) });
  }
}

async function selectIdempotencyStore(
  stores: { primary: IdempotencyStore; fallback?: IdempotencyStore | undefined },
  scope: string,
  key: string,
  requestFingerprint: string
): Promise<{
  store: IdempotencyStore;
  backend: 'primary' | 'fallback';
  lookup: Awaited<ReturnType<IdempotencyStore['lookup']>>;
}> {
  try {
    return {
      store: stores.primary,
      backend: 'primary',
      lookup: await stores.primary.lookup(scope, key, requestFingerprint)
    };
  } catch {
    if (!stores.fallback) {
      throw new Error('Idempotency backend unavailable.');
    }
    return {
      store: stores.fallback,
      backend: 'fallback',
      lookup: await stores.fallback.lookup(scope, key, requestFingerprint)
    };
  }
}

async function sendJsonResponse(
  res: express.Response,
  execute: () => Promise<{ status: number; body: unknown }>,
  onAudit: (event: { outcome: AuditOutcome; detail?: string | undefined }) => void
): Promise<void> {
  try {
    const result = await execute();
    onAudit({ outcome: 'success' });
    res.status(result.status).json(result.body);
  } catch (error) {
    onAudit({ outcome: 'failure', detail: asMessage(error) });
    res.status(400).json({ message: asMessage(error) });
  }
}

function emitAudit(
  auditLogger: AuditLogger,
  details: {
    endpoint: string;
    action: string;
    outcome: AuditOutcome;
    requestId: string;
    tenantId: string;
    principalSub?: string | undefined;
    detail?: string | undefined;
  }
): void {
  auditLogger.emit({
    eventType: details.action === 'wizard-entry' ? 'wizard-authz' : 'wizard-operation',
    action: details.action,
    outcome: details.outcome,
    endpoint: details.endpoint,
    requestId: details.requestId,
    tenantId: details.tenantId,
    principalSub: details.principalSub,
    detail: details.detail,
    at: new Date().toISOString()
  });
}

function finalizeTelemetry(
  telemetry: TelemetryClient,
  span: TelemetrySpan,
  startedAtMs: number,
  statusCode: number,
  path: string,
  method: string,
  outcome: 'success' | 'error' | 'throttled'
): void {
  const durationMs = Math.max(0, Date.now() - startedAtMs);
  const attrs = { method, path, statusCode, outcome };
  telemetry.recordCounter('wizard_api_requests_total', 1, attrs);
  telemetry.recordHistogram('wizard_api_request_duration_ms', durationMs, attrs);
  span.end({ statusCode, outcome });
}
