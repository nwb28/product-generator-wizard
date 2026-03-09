import express from 'express';
import { compileManifest } from '@pgw/packages-compiler/dist/index.js';
import { generateHumanReviewDocument } from '@pgw/packages-review-doc/dist/index.js';
import { generatePilotScaffold } from '@pgw/packages-scaffold-templates/dist/index.js';
import { toHumanSummary, validateIntake } from '@pgw/packages-validator/dist/index.js';
import { authenticatePrincipal, hasWizardAccess } from './auth.js';
import { createRateLimiter, type RateLimiter } from './rate-limit.js';

type AppOptions = {
  rateLimiter?: RateLimiter;
};

export function createApp(options: AppOptions = {}) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  const rateLimiter = options.rateLimiter ?? createRateLimiter({
    maxRequests: readEnvPositiveInteger('WIZARD_RATE_LIMIT_MAX_PER_MINUTE', process.env.NODE_ENV === 'test' ? 10_000 : 120),
    windowMs: 60_000
  });

  app.get('/authz/wizard-entry', async (req, res) => {
    const principal = await authenticatePrincipal(req);
    if (!applyRateLimit(res, rateLimiter.check('authz:wizard-entry', resolveRequestIdentity(req, principal?.sub)))) {
      return;
    }

    if (!hasWizardAccess(principal)) {
      res.status(403).json({ authorized: false });
      return;
    }

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
    if (!applyRateLimit(res, rateLimiter.check('compile', resolveRequestIdentity(req, principal?.sub)))) {
      return;
    }

    if (!hasWizardAccess(principal)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    try {
      const manifest = compileManifest(req.body as any);
      res.status(200).json({ manifest });
    } catch (error) {
      res.status(400).json({ message: asMessage(error) });
    }
  });

  app.post('/generate', async (req, res) => {
    const principal = await authenticatePrincipal(req);
    if (!applyRateLimit(res, rateLimiter.check('generate', resolveRequestIdentity(req, principal?.sub)))) {
      return;
    }

    if (!hasWizardAccess(principal)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    try {
      const manifest = compileManifest(req.body as any);
      const output = generatePilotScaffold(manifest);
      res.status(200).json(output);
    } catch (error) {
      res.status(400).json({ message: asMessage(error) });
    }
  });

  app.post('/review-document', async (req, res) => {
    const principal = await authenticatePrincipal(req);
    if (!applyRateLimit(res, rateLimiter.check('review-document', resolveRequestIdentity(req, principal?.sub)))) {
      return;
    }

    if (!hasWizardAccess(principal)) {
      res.status(403).json({ message: 'Forbidden' });
      return;
    }

    try {
      const validation = validateIntake(req.body);
      const review = generateHumanReviewDocument(req.body as any, validation);
      res.status(200).json(review);
    } catch (error) {
      res.status(400).json({ message: asMessage(error) });
    }
  });

  return app;
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

function resolveRequestIdentity(req: express.Request, subject?: string): string {
  const tenant =
    req.header('x-tenant-id') ??
    req.header('x-tenant') ??
    req.query.tenant?.toString() ??
    'unknown-tenant';
  const principal = subject ?? req.ip ?? 'unknown-principal';
  return `${tenant}:${principal}`;
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
