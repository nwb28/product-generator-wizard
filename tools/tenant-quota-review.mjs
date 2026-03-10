import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { loadTenantQuotaConfigOrThrow } from '../apps/generator-api/dist/tenant-quotas.js';

const path = process.argv[2] ?? 'config/tenant-quotas.json';
const config = loadTenantQuotaConfigOrThrow(path);

if (!config) {
  throw new Error(`Quota config not found at ${path}`);
}

const raw = JSON.parse(readFileSync(path, 'utf8'));
const tenants = raw.tenants && typeof raw.tenants === 'object' ? Object.keys(raw.tenants) : [];

const report = {
  reviewedAt: new Date().toISOString(),
  path,
  defaultPerMinute: raw.default?.perMinute ?? null,
  tenantCount: tenants.length,
  tenants
};

mkdirSync('.tmp/quota', { recursive: true });
writeFileSync('.tmp/quota/review.json', JSON.stringify(report, null, 2) + '\n', 'utf8');
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
