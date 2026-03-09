import Ajv2020Import from 'ajv/dist/2020.js';
import { intakeSchema } from '@pgw/packages-contracts/dist/index.js';

export type Severity = 'blocking' | 'warning';

export type Diagnostic = {
  code: string;
  severity: Severity;
  path: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  diagnostics: Diagnostic[];
  summary: string;
};

type AjvError = {
  instancePath?: string;
  message?: string;
};

type IntakeMapping = {
  sourceField: string;
  targetField: string;
  confidence: number;
};

type IntakePayload = {
  canonicalModel?: { mappings?: IntakeMapping[] };
  permissions?: Record<string, Array<{ role: string; permissions: string[] }>>;
  securityEvidence?: {
    dataClassification?: string;
    threatModel?: string;
    evidenceLinks?: string[];
  };
};

type AjvInstance = {
  compile: (schema: object) => {
    (payload: object): boolean;
    errors?: AjvError[];
  };
};

type AjvCtor = new (opts: object) => AjvInstance;
const Ajv2020 = Ajv2020Import as unknown as AjvCtor;

const schemaValidator = new Ajv2020({ allErrors: true, strict: false }).compile(intakeSchema as object);

export function validateIntake(payload: unknown): ValidationResult {
  const diagnostics: Diagnostic[] = [];
  const isValidSchema = schemaValidator(payload as object);

  if (!isValidSchema) {
    for (const error of schemaValidator.errors ?? []) {
      diagnostics.push({
        code: 'SCHEMA_INVALID',
        severity: 'blocking',
        path: error.instancePath || '/',
        message: error.message ?? 'Schema validation failure'
      });
    }
  }

  applyDomainRules(payload as IntakePayload, diagnostics);

  const blockingCount = diagnostics.filter((x) => x.severity === 'blocking').length;
  const warningCount = diagnostics.filter((x) => x.severity === 'warning').length;

  return {
    valid: blockingCount === 0,
    diagnostics,
    summary: `Blocking: ${blockingCount}, Warnings: ${warningCount}`
  };
}

export function toHumanSummary(result: ValidationResult): string {
  const lines = [result.summary];
  for (const item of result.diagnostics) {
    lines.push(`[${item.severity.toUpperCase()}] ${item.code} ${item.path} - ${item.message}`);
  }
  return lines.join('\n');
}

function applyDomainRules(payload: IntakePayload, diagnostics: Diagnostic[]): void {
  const mappings = payload.canonicalModel?.mappings ?? [];
  if (mappings.length === 0) {
    diagnostics.push({
      code: 'MISSING_CANONICAL_MAPPING_REQUIREMENTS',
      severity: 'blocking',
      path: '/canonicalModel/mappings',
      message: 'At least one canonical mapping is required.'
    });
  }

  const permissions = payload.permissions;
  for (const scope of ['bucs', 'firm', 'company'] as const) {
    if (!permissions?.[scope]?.length) {
      diagnostics.push({
        code: 'MISSING_ROLE_PERMISSION_DECLARATIONS',
        severity: 'blocking',
        path: `/permissions/${scope}`,
        message: `Permission mappings for ${scope} are required.`
      });
    }
  }

  const evidence = payload.securityEvidence;
  if (!evidence?.dataClassification || !evidence?.threatModel || !evidence?.evidenceLinks?.length) {
    diagnostics.push({
      code: 'MISSING_SECURITY_EVIDENCE_FIELDS',
      severity: 'blocking',
      path: '/securityEvidence',
      message: 'Mandatory security evidence fields are incomplete.'
    });
  }

  for (const [index, mapping] of mappings.entries()) {
    if (mapping.confidence < 0.8) {
      diagnostics.push({
        code: 'LOW_CONFIDENCE_MAPPING_HINT',
        severity: 'warning',
        path: `/canonicalModel/mappings/${index}/confidence`,
        message: 'Mapping confidence is below recommended threshold (0.80).'
      });
    }

    if (!mapping.sourceField || !mapping.targetField) {
      diagnostics.push({
        code: 'OPTIONAL_PROFILE_FIELDS_INCOMPLETE',
        severity: 'warning',
        path: `/canonicalModel/mappings/${index}`,
        message: 'Mapping entry is missing optional profile detail.'
      });
    }
  }
}
