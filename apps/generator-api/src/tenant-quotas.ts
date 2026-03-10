import { readFileSync } from 'node:fs';

type TenantQuotaConfig = {
  default?: {
    perMinute?: number;
    endpointOverrides?: Record<string, number>;
  };
  tenants?: Record<
    string,
    {
      perMinute?: number;
      endpointOverrides?: Record<string, number>;
    }
  >;
};

const DEFAULT_PER_MINUTE = 120;

export type TenantQuotaPolicy = {
  resolvePerMinute(tenantId: string, endpoint: string): number;
};

export function createTenantQuotaPolicy(
  config: TenantQuotaConfig | undefined,
  globalFallbackPerMinute = DEFAULT_PER_MINUTE
): TenantQuotaPolicy {
  return {
    resolvePerMinute(tenantId: string, endpoint: string): number {
      const base = positive(config?.default?.perMinute) ?? globalFallbackPerMinute;
      const defaultOverride = positive(config?.default?.endpointOverrides?.[endpoint]);
      const tenantConfig = config?.tenants?.[tenantId];
      const tenantBase = positive(tenantConfig?.perMinute);
      const tenantOverride = positive(tenantConfig?.endpointOverrides?.[endpoint]);

      return tenantOverride ?? tenantBase ?? defaultOverride ?? base;
    }
  };
}

export function loadTenantQuotaConfigFromFile(path: string): TenantQuotaConfig | undefined {
  try {
    const content = readFileSync(path, 'utf8');
    return JSON.parse(content) as TenantQuotaConfig;
  } catch {
    return undefined;
  }
}

function positive(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return undefined;
  }
  return Math.floor(value);
}
