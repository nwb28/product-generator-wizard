import type { BuiltProductAdapterInput, ProductAdapterRegistry } from './index.js';

export type ValidationSeverity = 'blocking' | 'warning';

export type ValidationDiagnostic = {
  code: string;
  severity: ValidationSeverity;
  path: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  diagnostics: ValidationDiagnostic[];
  summary: {
    blocking: number;
    warning: number;
  };
};

export type BuiltProductIntakePayload = {
  schemaVersion?: string;
  adapter?: { id?: string; version?: string };
  tenant?: { id?: string };
  product?: { id?: string; type?: string; displayName?: string };
  integrations?: {
    workforce?: { enabled?: boolean; details?: Record<string, unknown> };
    excelPlugin?: { enabled?: boolean; details?: Record<string, unknown> };
  };
  permissions?: {
    bucs?: Array<{ role?: string; permissions?: string[] }>;
    firm?: Array<{ role?: string; permissions?: string[] }>;
    company?: Array<{ role?: string; permissions?: string[] }>;
  };
  mappings?: Array<{ canonicalModel?: string; sourcePath?: string; confidence?: number }>;
};

export function validateBuiltProductIntake(payload: BuiltProductIntakePayload): ValidationResult {
  const diagnostics: ValidationDiagnostic[] = [];

  if (payload.schemaVersion !== '1.0.0') {
    diagnostics.push({
      code: 'SCHEMA_VERSION_UNSUPPORTED',
      severity: 'blocking',
      path: '/schemaVersion',
      message: 'Supported built-product intake schemaVersion is 1.0.0.'
    });
  }

  if (!payload.adapter?.id) {
    diagnostics.push({
      code: 'ADAPTER_ID_MISSING',
      severity: 'blocking',
      path: '/adapter/id',
      message: 'adapter.id is required.'
    });
  }
  if (!payload.adapter?.version) {
    diagnostics.push({
      code: 'ADAPTER_VERSION_MISSING',
      severity: 'blocking',
      path: '/adapter/version',
      message: 'adapter.version is required.'
    });
  }

  if (!payload.tenant?.id) {
    diagnostics.push({
      code: 'TENANT_ID_MISSING',
      severity: 'blocking',
      path: '/tenant/id',
      message: 'tenant.id is required.'
    });
  }

  if (!payload.product?.id) {
    diagnostics.push({
      code: 'PRODUCT_ID_MISSING',
      severity: 'blocking',
      path: '/product/id',
      message: 'product.id is required.'
    });
  }
  if (!payload.product?.type) {
    diagnostics.push({
      code: 'PRODUCT_TYPE_MISSING',
      severity: 'blocking',
      path: '/product/type',
      message: 'product.type is required.'
    });
  }

  if (!payload.permissions?.bucs || payload.permissions.bucs.length === 0) {
    diagnostics.push({
      code: 'PERMISSIONS_BUCS_MISSING',
      severity: 'blocking',
      path: '/permissions/bucs',
      message: 'BUCS role/permission matrix is required.'
    });
  }
  if (!payload.permissions?.firm || payload.permissions.firm.length === 0) {
    diagnostics.push({
      code: 'PERMISSIONS_FIRM_MISSING',
      severity: 'blocking',
      path: '/permissions/firm',
      message: 'Firm role/permission matrix is required.'
    });
  }
  if (!payload.permissions?.company || payload.permissions.company.length === 0) {
    diagnostics.push({
      code: 'PERMISSIONS_COMPANY_MISSING',
      severity: 'blocking',
      path: '/permissions/company',
      message: 'Company role/permission matrix is required.'
    });
  }

  if (!payload.mappings || payload.mappings.length === 0) {
    diagnostics.push({
      code: 'MAPPINGS_MISSING',
      severity: 'blocking',
      path: '/mappings',
      message: 'At least one canonical mapping is required.'
    });
  }

  const lowConfidenceMappings = (payload.mappings ?? []).filter((entry) => (entry.confidence ?? 0) < 0.8);
  if (lowConfidenceMappings.length > 0) {
    diagnostics.push({
      code: 'MAPPINGS_LOW_CONFIDENCE',
      severity: 'warning',
      path: '/mappings',
      message: `${lowConfidenceMappings.length} mapping entries have confidence below 0.80.`
    });
  }

  if (payload.integrations?.workforce?.enabled && !payload.integrations.workforce.details) {
    diagnostics.push({
      code: 'WORKFORCE_DETAILS_MISSING',
      severity: 'warning',
      path: '/integrations/workforce/details',
      message: 'Workforce is enabled but details were not provided.'
    });
  }

  if (payload.integrations?.excelPlugin?.enabled && !payload.integrations.excelPlugin.details) {
    diagnostics.push({
      code: 'EXCEL_DETAILS_MISSING',
      severity: 'warning',
      path: '/integrations/excelPlugin/details',
      message: 'Excel plugin is enabled but details were not provided.'
    });
  }

  return withSummary(diagnostics);
}

export function validateBuiltProductWithRegistry(
  payload: BuiltProductIntakePayload,
  registry: ProductAdapterRegistry
): ValidationResult {
  const result = validateBuiltProductIntake(payload);

  if (result.summary.blocking > 0) {
    return result;
  }

  const input: BuiltProductAdapterInput = {
    adapterId: payload.adapter?.id ?? '',
    adapterVersion: payload.adapter?.version ?? '',
    tenantId: payload.tenant?.id ?? '',
    productId: payload.product?.id ?? '',
    metadata: {
      productType: payload.product?.type,
      displayName: payload.product?.displayName,
      uiScreens: [],
      excelCapabilities: payload.integrations?.excelPlugin?.enabled ? ['enabled'] : [],
      workforceCapabilities: payload.integrations?.workforce?.enabled ? ['enabled'] : [],
      canonicalMappings: (payload.mappings ?? []).map((entry) => ({
        canonicalModel: entry.canonicalModel ?? 'unknown',
        confidence: entry.confidence ?? 0
      }))
    }
  };

  try {
    registry.resolve(input);
  } catch (error) {
    result.diagnostics.push({
      code: 'ADAPTER_NOT_RESOLVABLE',
      severity: 'blocking',
      path: '/adapter',
      message: error instanceof Error ? error.message : 'Unable to resolve adapter.'
    });
  }

  return withSummary(result.diagnostics);
}

function withSummary(diagnostics: ValidationDiagnostic[]): ValidationResult {
  const summary = {
    blocking: diagnostics.filter((entry) => entry.severity === 'blocking').length,
    warning: diagnostics.filter((entry) => entry.severity === 'warning').length
  };
  return {
    valid: summary.blocking === 0,
    diagnostics,
    summary
  };
}
