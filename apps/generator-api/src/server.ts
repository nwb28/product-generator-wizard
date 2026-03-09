import express from 'express';
import { compileManifest } from '@pgw/packages-compiler/dist/index.js';
import { generateHumanReviewDocument } from '@pgw/packages-review-doc/dist/index.js';
import { generatePilotScaffold } from '@pgw/packages-scaffold-templates/dist/index.js';
import { toHumanSummary, validateIntake } from '@pgw/packages-validator/dist/index.js';
import { authenticatePrincipal, hasWizardAccess } from './auth.js';
import { createAuditLogger, resolveRequestId, type AuditLogger, type AuditOutcome } from './audit.js';
import { createIdempotencyStore, fingerprintPayload } from './idempotency.js';
import { createRateLimiter, type RateLimiter } from './rate-limit.js';

type AppOptions = {
  rateLimiter?: RateLimiter;
  auditLogger?: AuditLogger;
};

export function createApp(options: AppOptions = {}) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  const auditLogger = options.auditLogger ?? createAuditLogger();
  const rateLimiter = options.rateLimiter ?? createRateLimiter({
    maxRequests: readEnvPositiveInteger('WIZARD_RATE_LIMIT_MAX_PER_MINUTE', process.env.NODE_ENV === 'test' ? 10_000 : 120),
    windowMs: 60_000
  });
  const idempotencyStore = createIdempotencyStore({
    ttlMs: readEnvPositiveInteger('WIZARD_IDEMPOTENCY_TTL_MS', 86_400_000)
  });

  app.get('/authz/wizard-entry', async (req, res) => {
    const principal = await authenticatePrincipal(req);
    const requestId = resolveRequestId(req.header('x-request-id'));
    const tenantId = resolveTenantId(req);

    if (!applyRateLimit(res, rateLimiter.check('authz:wizard-entry', resolveRequestIdentity(req, principal?.sub)))) {
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

  app.post('/validate', (req, res) => {
    if (!applyRateLimit(res, rateLimiter.check('validate', resolveRequestIdentity(req)))) {
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
    if (!applyRateLimit(res, rateLimiter.check('compile', resolveRequestIdentity(req, principal?.sub)))) {
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
    if (!applyRateLimit(res, rateLimiter.check('generate', resolveRequestIdentity(req, principal?.sub)))) {
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
      idempotencyStore,
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
    if (!applyRateLimit(res, rateLimiter.check('review-document', resolveRequestIdentity(req, principal?.sub)))) {
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
      idempotencyStore,
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

function applyRateLimit(res: express.Response, result: ReturnType<RateLimiter['check']>): boolean {
  res.setHeader('X-RateLimit-Limit', String(result.limit));
  res.setHeader('X-RateLimit-Remaining', String(result.remaining));
  res.setHeader('X-RateLimit-Reset', String(result.resetAtEpochSeconds));

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

type IdempotencyStore = ReturnType<typeof createIdempotencyStore>;

async function runIdempotentJson(
  req: express.Request,
  res: express.Response,
  store: IdempotencyStore,
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
  const lookup = store.lookup(scope, idempotencyKey, requestFingerprint);

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
    store.save(scope, idempotencyKey, requestFingerprint, {
      status: result.status,
      body: result.body,
      createdAtMs: Date.now()
    });
    onAudit({ outcome: 'success' });
    res.setHeader('X-Idempotency-Status', 'created');
    res.status(result.status).json(result.body);
  } catch (error) {
    store.discard(scope, idempotencyKey);
    onAudit({ outcome: 'failure', detail: asMessage(error) });
    res.status(400).json({ message: asMessage(error) });
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
