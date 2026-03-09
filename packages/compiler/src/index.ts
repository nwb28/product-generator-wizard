import Ajv2020Import from 'ajv/dist/2020.js';
import { manifestSchema } from '@pgw/packages-contracts/dist/index.js';

export type IntakeMapping = {
  sourceField: string;
  targetField: string;
  confidence: number;
};

export type IntakePayload = {
  schemaVersion: string;
  product: {
    id: string;
    productType: string;
    tenant: string;
  };
  permissions: {
    bucs: Array<{ role: string; permissions: string[] }>;
    firm: Array<{ role: string; permissions: string[] }>;
    company: Array<{ role: string; permissions: string[] }>;
  };
  canonicalModel: {
    mappings: IntakeMapping[];
  };
  integrations: {
    workforce: { enabled: boolean; provider?: string };
    excelPlugin: { enabled: boolean; templateVersion?: string };
  };
};

export type ManifestPayload = {
  schemaVersion: string;
  generatorVersion: string;
  intake: {
    schemaVersion: string;
    productId: string;
    productType: string;
    tenant: string;
  };
  artifactPlan: Array<{ path: string; kind: 'json' | 'markdown' | 'typescript' | 'directory' }>;
  permissions: {
    bucs: { roles: number; permissions: number };
    firm: { roles: number; permissions: number };
    company: { roles: number; permissions: number };
  };
  canonicalCoverage: {
    mappedFields: number;
    coveragePercent: number;
  };
  integrations: {
    workforce: { enabled: boolean; details?: string };
    excelPlugin: { enabled: boolean; details?: string };
  };
  determinism: {
    stableKeyOrder: true;
    stableFileOrder: true;
    timestampPolicy: 'none';
  };
};

type AjvError = { instancePath?: string; message?: string };
type AjvInstance = {
  compile: (schema: object) => {
    (payload: object): boolean;
    errors?: AjvError[];
  };
};
type AjvCtor = new (opts: object) => AjvInstance;
const Ajv2020 = Ajv2020Import as unknown as AjvCtor;
const manifestValidator = new Ajv2020({ allErrors: true, strict: false }).compile(manifestSchema as object);

export function compileManifest(intake: IntakePayload, generatorVersion = '0.1.0'): ManifestPayload {
  const manifest: ManifestPayload = {
    schemaVersion: '1.0.0',
    generatorVersion,
    intake: {
      schemaVersion: intake.schemaVersion,
      productId: intake.product.id,
      productType: intake.product.productType,
      tenant: intake.product.tenant
    },
    artifactPlan: [
      { path: 'docs/runbook.md', kind: 'markdown' },
      { path: 'manifest.json', kind: 'json' },
      { path: 'metadata/generation.json', kind: 'json' },
      { path: 'review/human-review.md', kind: 'markdown' },
      { path: 'src/', kind: 'directory' },
      { path: 'tests/', kind: 'directory' }
    ],
    permissions: {
      bucs: summarizePermissions(intake.permissions.bucs),
      firm: summarizePermissions(intake.permissions.firm),
      company: summarizePermissions(intake.permissions.company)
    },
    canonicalCoverage: {
      mappedFields: intake.canonicalModel.mappings.length,
      coveragePercent: intake.canonicalModel.mappings.length > 0 ? 100 : 0
    },
    integrations: {
      workforce: withOptionalDetails(
        intake.integrations.workforce.enabled,
        intake.integrations.workforce.provider
      ),
      excelPlugin: withOptionalDetails(
        intake.integrations.excelPlugin.enabled,
        intake.integrations.excelPlugin.templateVersion
      )
    },
    determinism: {
      stableKeyOrder: true,
      stableFileOrder: true,
      timestampPolicy: 'none'
    }
  };

  const valid = manifestValidator(manifest as object);
  if (!valid) {
    const details = (manifestValidator.errors ?? []).map((x) => `${x.instancePath ?? '/'} ${x.message ?? ''}`.trim());
    throw new Error(`Manifest compilation failed schema validation: ${details.join('; ')}`);
  }

  return manifest;
}

export function serializeManifestDeterministic(manifest: ManifestPayload): string {
  return stableStringify(manifest) + '\n';
}

function summarizePermissions(entries: Array<{ role: string; permissions: string[] }>): { roles: number; permissions: number } {
  const uniquePermissions = new Set(entries.flatMap((x) => x.permissions));
  return {
    roles: entries.length,
    permissions: uniquePermissions.size
  };
}

function withOptionalDetails(enabled: boolean, details: string | undefined): { enabled: boolean; details?: string } {
  return details ? { enabled, details } : { enabled };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
    const content = keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',');
    return `{${content}}`;
  }
  return JSON.stringify(value);
}
