import { readFileSync, writeFileSync } from 'node:fs';

const basePath = process.argv[2];
const headPath = process.argv[3];
const outputPath = process.argv[4] ?? '.tmp/quota/diff.md';

if (!basePath || !headPath) {
  throw new Error('Usage: node tools/tenant-quota-diff.mjs <base-json> <head-json> [output-md]');
}

const base = parse(readFileSync(basePath, 'utf8'));
const head = parse(readFileSync(headPath, 'utf8'));

const lines = ['## Tenant Quota Diff', '', '| Scope | Base | Head |', '|---|---:|---:|'];
addRow(lines, 'default.perMinute', base.default?.perMinute, head.default?.perMinute);

const baseTenants = new Set(Object.keys(base.tenants ?? {}));
const headTenants = new Set(Object.keys(head.tenants ?? {}));
const allTenants = [...new Set([...baseTenants, ...headTenants])].sort();

for (const tenantId of allTenants) {
  const before = base.tenants?.[tenantId];
  const after = head.tenants?.[tenantId];
  addRow(lines, `tenants.${tenantId}.perMinute`, before?.perMinute, after?.perMinute);

  const beforeOverrides = before?.endpointOverrides ?? {};
  const afterOverrides = after?.endpointOverrides ?? {};
  const endpoints = [...new Set([...Object.keys(beforeOverrides), ...Object.keys(afterOverrides)])].sort();
  for (const endpoint of endpoints) {
    addRow(
      lines,
      `tenants.${tenantId}.endpointOverrides.${endpoint}`,
      beforeOverrides[endpoint],
      afterOverrides[endpoint]
    );
  }
}

const markdown = lines.join('\n') + '\n';
writeFileSync(outputPath, markdown, 'utf8');
process.stdout.write(markdown);

function parse(raw) {
  return JSON.parse(raw);
}

function addRow(lines, scope, baseValue, headValue) {
  const before = format(baseValue);
  const after = format(headValue);
  if (before === after) {
    return;
  }
  lines.push(`| ${scope} | ${before} | ${after} |`);
}

function format(value) {
  if (value === undefined) {
    return '`-`';
  }
  return `\`${String(value)}\``;
}
