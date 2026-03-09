import { createHash } from 'node:crypto';
import { type ManifestPayload, serializeManifestDeterministic } from '@pgw/packages-compiler/dist/index.js';

export type GeneratedFile = {
  path: string;
  content: string;
};

export type GenerationOutput = {
  files: GeneratedFile[];
  deterministicHash: string;
};

export function generatePilotScaffold(manifest: ManifestPayload, generatorVersion = '0.1.0'): GenerationOutput {
  const files: GeneratedFile[] = [
    {
      path: 'docs/runbook.md',
      content: renderRunbook(manifest)
    },
    {
      path: 'manifest.json',
      content: serializeManifestDeterministic(manifest)
    },
    {
      path: 'src/index.ts',
      content: renderSourceStub(manifest)
    },
    {
      path: 'tests/contract.test.ts',
      content: renderContractTestStub(manifest)
    }
  ];

  const deterministicHash = hashFiles(files);

  files.push({
    path: 'metadata/generation.json',
    content: serializeJsonDeterministic({
      schemaVersion: manifest.schemaVersion,
      generatorVersion,
      deterministicHash,
      timestampPolicy: 'none'
    }) + '\n'
  });

  return {
    files: files.sort((a, b) => a.path.localeCompare(b.path)),
    deterministicHash
  };
}

function renderRunbook(manifest: ManifestPayload): string {
  return [
    '# Generated Runbook',
    '',
    `Product ID: ${manifest.intake.productId}`,
    `Product Type: ${manifest.intake.productType}`,
    `Tenant: ${manifest.intake.tenant}`,
    '',
    '## Steps',
    '1. Validate intake and diagnostics.',
    '2. Review human-review.md output.',
    '3. Execute contract tests and address blockers.'
  ].join('\n') + '\n';
}

function renderSourceStub(manifest: ManifestPayload): string {
  return [
    "export const productProfile = {",
    `  id: '${manifest.intake.productId}',`,
    `  type: '${manifest.intake.productType}',`,
    "  profile: 'pilot'",
    '};',
    ''
  ].join('\n');
}

function renderContractTestStub(manifest: ManifestPayload): string {
  return [
    "import test from 'node:test';",
    "import assert from 'node:assert/strict';",
    '',
    `test('manifest product matches generated profile', () => {`,
    `  assert.equal('${manifest.intake.productId}'.length > 0, true);`,
    '});',
    ''
  ].join('\n');
}

function hashFiles(files: GeneratedFile[]): string {
  const normalized = files
    .slice()
    .sort((a, b) => a.path.localeCompare(b.path))
    .map((file) => `${file.path}\n${file.content}`)
    .join('\n---\n');

  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

function serializeJsonDeterministic(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => serializeJsonDeterministic(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
    const content = keys.map((k) => `${JSON.stringify(k)}:${serializeJsonDeterministic(obj[k])}`).join(',');
    return `{${content}}`;
  }
  return JSON.stringify(value);
}
