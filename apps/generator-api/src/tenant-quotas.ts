import { readFileSync } from 'node:fs';
import { existsSync } from 'node:fs';

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

export function loadTenantQuotaConfigOrThrow(path: string): TenantQuotaConfig | undefined {
  if (!existsSync(path)) {
    return undefined;
  }

  const content = readFileSync(path, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`Tenant quota config at ${path} is not valid JSON: ${asMessage(error)}`);
  }

  const validation = validateTenantQuotaConfig(parsed);
  if (!validation.valid) {
    throw new Error(`Tenant quota config at ${path} is invalid: ${validation.errors.join('; ')}`);
  }

  return parsed as TenantQuotaConfig;
}

export function validateTenantQuotaConfig(value: unknown): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { valid: false, errors: ['root must be an object'] };
  }

  const root = value as Record<string, unknown>;
  validateQuotaEntry(root.default, 'default', errors);

  if (root.tenants !== undefined) {
    if (!root.tenants || typeof root.tenants !== 'object' || Array.isArray(root.tenants)) {
      errors.push('tenants must be an object when provided');
    } else {
      for (const [tenantId, entry] of Object.entries(root.tenants as Record<string, unknown>)) {
        if (tenantId.trim().length === 0) {
          errors.push('tenant id keys must be non-empty');
        }
        validateQuotaEntry(entry, `tenants.${tenantId}`, errors);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function positive(value: number | undefined): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 1) {
    return undefined;
  }
  return Math.floor(value);
}

function validateQuotaEntry(value: unknown, path: string, errors: string[]): void {
  if (value === undefined) {
    return;
  }

  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${path} must be an object`);
    return;
  }

  const entry = value as Record<string, unknown>;
  if (entry.perMinute !== undefined && !isPositiveNumber(entry.perMinute)) {
    errors.push(`${path}.perMinute must be a positive number`);
  }

  if (entry.endpointOverrides !== undefined) {
    const overrides = entry.endpointOverrides;
    if (!overrides || typeof overrides !== 'object' || Array.isArray(overrides)) {
      errors.push(`${path}.endpointOverrides must be an object`);
    } else {
      for (const [endpoint, quota] of Object.entries(overrides as Record<string, unknown>)) {
        if (endpoint.trim().length === 0) {
          errors.push(`${path}.endpointOverrides contains an empty endpoint key`);
        }
        if (!isPositiveNumber(quota)) {
          errors.push(`${path}.endpointOverrides.${endpoint} must be a positive number`);
        }
      }
    }
  }
}

function isPositiveNumber(value: unknown): boolean {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function asMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
