import type { AdapterDiagnostic, BuiltProductAdapterInput, BuiltProductAdapterOutput, ProductAdapter } from './index.js';

type PilotMetadata = {
  productType?: string;
  displayName?: string;
  uiScreens?: Array<{ id: string; title: string; payload?: Record<string, unknown> }>;
  excelCapabilities?: string[];
  workforceCapabilities?: string[];
  canonicalMappings?: Array<{ canonicalModel: string; confidence: number }>;
};

export const PILOT_ADAPTER_ID = 'pilot-loan-adapter';
export const PILOT_ADAPTER_VERSION = '1.0.0';

export function createPilotLoanAdapter(): ProductAdapter {
  return {
    id: PILOT_ADAPTER_ID,
    version: PILOT_ADAPTER_VERSION,
    supports(input) {
      const metadata = asPilotMetadata(input.metadata);
      return metadata.productType === 'loan' || metadata.productType === 'pilot-loan';
    },
    transform(input) {
      const metadata = asPilotMetadata(input.metadata);
      const diagnostics = buildDiagnostics(metadata);
      const blocking = diagnostics.filter((entry) => entry.severity === 'blocking').length;
      const warning = diagnostics.filter((entry) => entry.severity === 'warning').length;

      const views = buildViews(input, metadata);
      const previewSession = {
        schemaVersion: '1.0.0',
        sessionId: `${input.tenantId}-${input.productId}-${PILOT_ADAPTER_ID}`,
        tenantId: input.tenantId,
        productId: input.productId,
        views,
        generatedArtifacts: views.map((view) => ({
          path: `preview/${view.id}.json`,
          hash: deterministicHashToken(view.id, view.title)
        }))
      };

      return {
        compatibility: { blocking, warning },
        diagnostics,
        previewSession
      } satisfies BuiltProductAdapterOutput;
    }
  };
}

function asPilotMetadata(value: Record<string, unknown>): PilotMetadata {
  return value as PilotMetadata;
}

function buildDiagnostics(metadata: PilotMetadata): AdapterDiagnostic[] {
  const diagnostics: AdapterDiagnostic[] = [];

  if (!metadata.displayName) {
    diagnostics.push({
      code: 'PILOT_DISPLAY_NAME_MISSING',
      severity: 'blocking',
      path: '/metadata/displayName',
      message: 'Display name is required for preview rendering.'
    });
  }

  if (!metadata.uiScreens || metadata.uiScreens.length === 0) {
    diagnostics.push({
      code: 'PILOT_UI_SCREENS_MISSING',
      severity: 'blocking',
      path: '/metadata/uiScreens',
      message: 'At least one UI screen definition is required for preview simulation.'
    });
  }

  const lowConfidenceMappings = (metadata.canonicalMappings ?? []).filter((entry) => entry.confidence < 0.8);
  if (lowConfidenceMappings.length > 0) {
    diagnostics.push({
      code: 'PILOT_LOW_CONFIDENCE_MAPPING',
      severity: 'warning',
      path: '/metadata/canonicalMappings',
      message: `${lowConfidenceMappings.length} canonical mappings have confidence below 0.80.`
    });
  }

  if (!metadata.excelCapabilities || metadata.excelCapabilities.length === 0) {
    diagnostics.push({
      code: 'PILOT_EXCEL_CAPABILITIES_EMPTY',
      severity: 'warning',
      path: '/metadata/excelCapabilities',
      message: 'Excel capabilities were not declared for preview simulation.'
    });
  }

  if (!metadata.workforceCapabilities || metadata.workforceCapabilities.length === 0) {
    diagnostics.push({
      code: 'PILOT_WORKFORCE_CAPABILITIES_EMPTY',
      severity: 'warning',
      path: '/metadata/workforceCapabilities',
      message: 'Workforce capabilities were not declared for preview simulation.'
    });
  }

  return diagnostics;
}

function buildViews(input: BuiltProductAdapterInput, metadata: PilotMetadata) {
  const uiScreens = metadata.uiScreens ?? [];
  const normalized = uiScreens
    .map((screen) => ({
      id: screen.id,
      title: screen.title,
      payload: screen.payload ?? {}
    }))
    .sort((a, b) => a.id.localeCompare(b.id));

  if (normalized.length > 0) {
    return normalized;
  }

  return [
    {
      id: `${input.productId}-default-screen`,
      title: metadata.displayName ?? input.productId,
      payload: {}
    }
  ];
}

function deterministicHashToken(id: string, title: string): string {
  const normalized = `${id}:${title}`;
  let hash = 0;
  for (let i = 0; i < normalized.length; i += 1) {
    hash = (hash * 31 + normalized.charCodeAt(i)) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
