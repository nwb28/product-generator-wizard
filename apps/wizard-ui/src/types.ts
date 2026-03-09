export type Diagnostic = {
  code: string;
  severity: 'blocking' | 'warning';
  path: string;
  message: string;
};

export type ValidateResponse = {
  valid: boolean;
  diagnostics: Diagnostic[];
  summary: string;
  humanSummary: string;
};

export type GenerateResponse = {
  deterministicHash: string;
  files: Array<{ path: string; content: string }>;
};
