import express from 'express';
import { compileManifest } from '@pgw/packages-compiler/dist/index.js';
import { generateHumanReviewDocument } from '@pgw/packages-review-doc/dist/index.js';
import { generatePilotScaffold } from '@pgw/packages-scaffold-templates/dist/index.js';
import { toHumanSummary, validateIntake } from '@pgw/packages-validator/dist/index.js';

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/authz/wizard-entry', (req, res) => {
    if (!hasWizardAccess(req)) {
      res.status(403).json({ authorized: false });
      return;
    }

    res.status(200).json({ authorized: true });
  });

  app.post('/validate', (req, res) => {
    const validation = validateIntake(req.body);
    res.status(validation.valid ? 200 : 400).json({
      valid: validation.valid,
      diagnostics: validation.diagnostics,
      summary: validation.summary,
      humanSummary: toHumanSummary(validation)
    });
  });

  app.post('/compile', (req, res) => {
    if (!hasWizardAccess(req)) {
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

  app.post('/generate', (req, res) => {
    if (!hasWizardAccess(req)) {
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

  app.post('/review-document', (req, res) => {
    if (!hasWizardAccess(req)) {
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

function hasWizardAccess(req: express.Request): boolean {
  const role = req.header('x-wizard-role');
  return role === 'wizard-admin' || role === 'product-generator';
}
