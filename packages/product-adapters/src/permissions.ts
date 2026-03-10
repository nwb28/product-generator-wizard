export type PermissionScope = 'bucs' | 'firm' | 'company';

export type PermissionEntry = {
  role: string;
  permissions: string[];
};

export type PermissionDiagnostics = {
  code: string;
  severity: 'blocking' | 'warning';
  path: string;
  message: string;
};

export type PermissionMatrixAnalysis = {
  valid: boolean;
  summary: {
    blocking: number;
    warning: number;
  };
  diagnostics: PermissionDiagnostics[];
  coverage: Record<PermissionScope, { roles: number; permissions: number }>;
};

export function analyzePermissionMatrix(input: {
  bucs?: PermissionEntry[];
  firm?: PermissionEntry[];
  company?: PermissionEntry[];
}): PermissionMatrixAnalysis {
  const diagnostics: PermissionDiagnostics[] = [];

  const coverage = {
    bucs: summarizeScope('bucs', input.bucs ?? [], diagnostics),
    firm: summarizeScope('firm', input.firm ?? [], diagnostics),
    company: summarizeScope('company', input.company ?? [], diagnostics)
  };

  const summary = {
    blocking: diagnostics.filter((entry) => entry.severity === 'blocking').length,
    warning: diagnostics.filter((entry) => entry.severity === 'warning').length
  };

  return {
    valid: summary.blocking === 0,
    summary,
    diagnostics,
    coverage
  };
}

function summarizeScope(scope: PermissionScope, entries: PermissionEntry[], diagnostics: PermissionDiagnostics[]) {
  if (entries.length === 0) {
    diagnostics.push({
      code: `PERMISSION_SCOPE_EMPTY_${scope.toUpperCase()}`,
      severity: 'blocking',
      path: `/permissions/${scope}`,
      message: `Permission scope '${scope}' requires at least one role entry.`
    });
    return { roles: 0, permissions: 0 };
  }

  let totalPermissions = 0;
  const seenRoles = new Set<string>();

  for (const [index, entry] of entries.entries()) {
    const role = entry.role?.trim() ?? '';
    if (!role) {
      diagnostics.push({
        code: `PERMISSION_ROLE_MISSING_${scope.toUpperCase()}`,
        severity: 'blocking',
        path: `/permissions/${scope}/${index}/role`,
        message: `Role value is required for scope '${scope}'.`
      });
      continue;
    }

    if (seenRoles.has(role)) {
      diagnostics.push({
        code: `PERMISSION_ROLE_DUPLICATE_${scope.toUpperCase()}`,
        severity: 'warning',
        path: `/permissions/${scope}/${index}/role`,
        message: `Role '${role}' is duplicated in scope '${scope}'.`
      });
    }
    seenRoles.add(role);

    const filteredPermissions = (entry.permissions ?? []).filter((value) => value.trim().length > 0);
    totalPermissions += filteredPermissions.length;
    if (filteredPermissions.length === 0) {
      diagnostics.push({
        code: `PERMISSION_LIST_EMPTY_${scope.toUpperCase()}`,
        severity: 'blocking',
        path: `/permissions/${scope}/${index}/permissions`,
        message: `At least one permission is required for role '${role}'.`
      });
    }
  }

  return { roles: seenRoles.size, permissions: totalPermissions };
}
