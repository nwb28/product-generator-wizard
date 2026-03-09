import { type ValidationResult } from '@pgw/packages-validator/dist/index.js';

type IntakeLike = {
  product?: { id?: string; name?: string; ownerTeam?: string; tenant?: string };
  controlPlane?: { connectionType?: string; apiSurface?: string; operations?: string[] };
  permissions?: Record<string, Array<{ role: string; permissions: string[] }>>;
  canonicalModel?: { mappings?: Array<{ sourceField: string; targetField: string; confidence: number }> };
  integrations?: {
    workforce?: { enabled?: boolean; provider?: string; syncMode?: string };
    excelPlugin?: { enabled?: boolean; templateVersion?: string; distributionChannel?: string };
  };
};

export type ReviewDocResult = {
  markdown: string;
  readinessScore: number;
  recommendation: 'Go' | 'No-Go';
};

export function generateHumanReviewDocument(intake: IntakeLike, validation: ValidationResult): ReviewDocResult {
  const blockingCount = validation.diagnostics.filter((d) => d.severity === 'blocking').length;
  const warningCodes = new Set(validation.diagnostics.filter((d) => d.severity === 'warning').map((d) => d.code));

  const readinessScore = Math.max(0, 100 - warningCodes.size * 5);
  const recommendation: 'Go' | 'No-Go' = blockingCount > 0 ? 'No-Go' : 'Go';

  const markdown = [
    '# Human Review Document',
    '',
    '## Intake Summary',
    `- Product: ${intake.product?.name ?? 'n/a'} (${intake.product?.id ?? 'n/a'})`,
    `- Owner Team: ${intake.product?.ownerTeam ?? 'n/a'}`,
    `- Tenant: ${intake.product?.tenant ?? 'n/a'}`,
    `- Control Plane: ${intake.controlPlane?.connectionType ?? 'n/a'} / ${intake.controlPlane?.apiSurface ?? 'n/a'}`,
    '',
    '## Contract Compliance Summary',
    `- Blocking diagnostics: ${blockingCount}`,
    `- Warning diagnostics: ${validation.diagnostics.filter((d) => d.severity === 'warning').length}`,
    '',
    '## Permission Matrix (BUCS/Firm/Company)',
    ...renderPermissionMatrix(intake),
    '',
    '## Canonical Mapping Coverage',
    `- Mapping count: ${intake.canonicalModel?.mappings?.length ?? 0}`,
    `- Low confidence mappings (<0.80): ${(intake.canonicalModel?.mappings ?? []).filter((x) => x.confidence < 0.8).length}`,
    '',
    '## Workforce/Excel Declarations',
    `- Workforce enabled: ${String(intake.integrations?.workforce?.enabled ?? false)}`,
    `- Workforce provider: ${intake.integrations?.workforce?.provider ?? 'n/a'}`,
    `- Excel enabled: ${String(intake.integrations?.excelPlugin?.enabled ?? false)}`,
    `- Excel template: ${intake.integrations?.excelPlugin?.templateVersion ?? 'n/a'}`,
    '',
    '## Blockers/Warnings',
    ...renderDiagnostics(validation),
    '',
    '## Manual Verification Checklist',
    '- Verify permission assignments in BUCS/Firm/Company admin UX.',
    '- Confirm canonical mappings with product/platform SME.',
    '- Confirm security evidence links are accessible and current.',
    '- Run generated contract tests in CI before promotion.',
    '',
    '## Readiness',
    `- Score: ${readinessScore}`,
    `- Recommendation: ${recommendation}`,
    ''
  ].join('\n');

  return { markdown, readinessScore, recommendation };
}

function renderPermissionMatrix(intake: IntakeLike): string[] {
  const rows: string[] = [];
  for (const scope of ['bucs', 'firm', 'company'] as const) {
    const entries = intake.permissions?.[scope] ?? [];
    rows.push(`- ${scope.toUpperCase()}: ${entries.length} role mappings`);
  }
  return rows;
}

function renderDiagnostics(validation: ValidationResult): string[] {
  if (validation.diagnostics.length === 0) {
    return ['- None'];
  }
  return validation.diagnostics.map((d) => `- [${d.severity.toUpperCase()}] ${d.code} ${d.path} - ${d.message}`);
}
