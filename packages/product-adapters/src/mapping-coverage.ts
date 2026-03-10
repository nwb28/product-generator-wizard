export type CanonicalMappingEntry = {
  canonicalModel: string;
  confidence: number;
};

export type MappingCoverageReport = {
  coveragePercent: number;
  uniqueCanonicalModels: number;
  lowConfidenceCount: number;
  diagnostics: Array<{
    code: string;
    severity: 'warning';
    path: string;
    message: string;
  }>;
};

export function analyzeCanonicalMappingCoverage(entries: CanonicalMappingEntry[]): MappingCoverageReport {
  const unique = new Set(entries.map((entry) => entry.canonicalModel).filter((value) => value.length > 0));
  const lowConfidence = entries.filter((entry) => entry.confidence < 0.8);
  const coveragePercent = unique.size === 0 ? 0 : Math.min(100, Math.round((entries.length / unique.size) * 100));

  const diagnostics: MappingCoverageReport['diagnostics'] = [];
  if (lowConfidence.length > 0) {
    diagnostics.push({
      code: 'CANONICAL_MAPPING_LOW_CONFIDENCE',
      severity: 'warning',
      path: '/mappings',
      message: `${lowConfidence.length} mapping entries are below 0.80 confidence.`
    });
  }

  return {
    coveragePercent,
    uniqueCanonicalModels: unique.size,
    lowConfidenceCount: lowConfidence.length,
    diagnostics
  };
}
