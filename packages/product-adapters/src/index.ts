import adaptersIndex from './adapters.index.json' with { type: 'json' };
import builtProductIntakeSchema from './schemas/built-product-intake.schema.json' with { type: 'json' };
import compatibilityReportSchema from './schemas/compatibility-report.schema.json' with { type: 'json' };
import previewSessionSchema from './schemas/preview-session.schema.json' with { type: 'json' };

export const ADAPTER_SCHEMA_V1 = '1.0.0' as const;

export { adaptersIndex, builtProductIntakeSchema, previewSessionSchema, compatibilityReportSchema };
export { createPilotLoanAdapter, PILOT_ADAPTER_ID, PILOT_ADAPTER_VERSION } from './pilot-adapter.js';
export { analyzePermissionMatrix } from './permissions.js';
export { analyzeCanonicalMappingCoverage } from './mapping-coverage.js';
export { validateBuiltProductIntake, validateBuiltProductWithRegistry } from './validator.js';

export type AdapterSeverity = 'blocking' | 'warning';

export type AdapterCompatibilityIndex = {
  activeBuiltProductIntakeSchemaVersion: string;
  activePreviewSessionSchemaVersion: string;
  activeCompatibilityReportSchemaVersion: string;
  compatibility: Record<
    string,
    {
      builtProductIntake: string[];
      previewSession: string[];
      compatibilityReport: string[];
    }
  >;
};

export type AdapterDiagnostic = {
  code: string;
  severity: AdapterSeverity;
  path: string;
  message: string;
};

export type BuiltProductAdapterInput = {
  adapterId: string;
  adapterVersion: string;
  tenantId: string;
  productId: string;
  metadata: Record<string, unknown>;
};

export type BuiltProductAdapterOutput = {
  compatibility: {
    blocking: number;
    warning: number;
  };
  diagnostics: AdapterDiagnostic[];
  previewSession: Record<string, unknown>;
};

export type ProductAdapter = {
  id: string;
  version: string;
  supports(input: BuiltProductAdapterInput): boolean;
  transform(input: BuiltProductAdapterInput): BuiltProductAdapterOutput;
};

export type ProductAdapterRegistry = {
  register(adapter: ProductAdapter): void;
  resolve(input: BuiltProductAdapterInput): ProductAdapter;
  list(): ProductAdapter[];
};

export type ActiveAdapterSchemaVersions = {
  builtProductIntake: string;
  previewSession: string;
  compatibilityReport: string;
};

export function createProductAdapterRegistry(seed: ProductAdapter[] = []): ProductAdapterRegistry {
  const adapters = new Map<string, ProductAdapter>();

  for (const adapter of seed) {
    registerAdapter(adapters, adapter);
  }

  return {
    register(adapter) {
      registerAdapter(adapters, adapter);
    },
    resolve(input) {
      const key = `${input.adapterId}@${input.adapterVersion}`;
      const adapter = adapters.get(key);
      if (!adapter) {
        throw new Error(`No product adapter registered for ${key}.`);
      }
      if (!adapter.supports(input)) {
        throw new Error(`Adapter ${key} does not support the provided input.`);
      }
      return adapter;
    },
    list() {
      return [...adapters.values()].sort((a, b) => `${a.id}@${a.version}`.localeCompare(`${b.id}@${b.version}`));
    }
  };
}

function registerAdapter(store: Map<string, ProductAdapter>, adapter: ProductAdapter): void {
  const key = `${adapter.id}@${adapter.version}`;
  if (store.has(key)) {
    throw new Error(`Product adapter already registered for ${key}.`);
  }
  store.set(key, adapter);
}

export function getActiveAdapterSchemaVersions(index: AdapterCompatibilityIndex = adaptersIndex): ActiveAdapterSchemaVersions {
  return {
    builtProductIntake: index.activeBuiltProductIntakeSchemaVersion,
    previewSession: index.activePreviewSessionSchemaVersion,
    compatibilityReport: index.activeCompatibilityReportSchemaVersion
  };
}

export function assertAdapterSchemaCompatibility(
  requestedVersion: string,
  schemas: ActiveAdapterSchemaVersions,
  index: AdapterCompatibilityIndex = adaptersIndex
): void {
  const supported = index.compatibility[requestedVersion];
  if (!supported) {
    throw new Error(`Adapter version ${requestedVersion} is not registered in compatibility index.`);
  }

  if (!supported.builtProductIntake.includes(schemas.builtProductIntake)) {
    throw new Error(
      `Adapter version ${requestedVersion} does not support built-product-intake schema ${schemas.builtProductIntake}.`
    );
  }
  if (!supported.previewSession.includes(schemas.previewSession)) {
    throw new Error(`Adapter version ${requestedVersion} does not support preview-session schema ${schemas.previewSession}.`);
  }
  if (!supported.compatibilityReport.includes(schemas.compatibilityReport)) {
    throw new Error(
      `Adapter version ${requestedVersion} does not support compatibility-report schema ${schemas.compatibilityReport}.`
    );
  }
}
