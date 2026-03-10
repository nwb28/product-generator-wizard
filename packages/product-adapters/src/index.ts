export type AdapterSeverity = 'blocking' | 'warning';

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
