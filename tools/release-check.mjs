#!/usr/bin/env node
import { execSync } from 'node:child_process';

const steps = [
  'npm run build',
  'npm test',
  'npm run openapi:compat:check',
  'npm run deps:policy:check',
  'npm run slo:check',
  'npm run layout:check',
  'npm run workflow:check',
  'node tools/generator-cli/dist/index.js ci-check fixtures/golden/pilot-intake.json',
  'npm run perf:baseline',
  'npm run dr:check'
];

for (const step of steps) {
  process.stdout.write(`\n[release-check] ${step}\n`);
  execSync(step, { stdio: 'inherit' });
}

process.stdout.write('\n[release-check] all checks passed\n');
