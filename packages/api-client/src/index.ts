export type ValidateResponse = {
  valid: boolean;
  diagnostics: Array<{
    code: string;
    severity: 'blocking' | 'warning';
    path: string;
    message: string;
  }>;
  summary: {
    blocking: number;
    warning: number;
  };
  humanSummary: string;
};

export type CompileResponse = {
  manifest: Record<string, unknown>;
};

export type GenerateResponse = {
  files: Array<{ path: string; content: string }>;
  deterministicHash: string;
};

export type ReviewDocumentResponse = {
  markdown: string;
  readinessScore: number;
  recommendation: 'Go' | 'No-Go';
};

export type WizardApiClientOptions = {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  token?: string;
};

export class WizardApiClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly token: string | undefined;

  constructor(options: WizardApiClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.token = options.token;
  }

  async validate(payload: unknown): Promise<ValidateResponse> {
    return this.postJson('/validate', payload);
  }

  async compile(payload: unknown): Promise<CompileResponse> {
    return this.postJson('/compile', payload);
  }

  async generate(payload: unknown, idempotencyKey?: string): Promise<GenerateResponse> {
    return this.postJson('/generate', payload, idempotencyKey);
  }

  async reviewDocument(payload: unknown, idempotencyKey?: string): Promise<ReviewDocumentResponse> {
    return this.postJson('/review-document', payload, idempotencyKey);
  }

  async health(): Promise<{ status: string }> {
    return this.getJson('/healthz');
  }

  async readiness(): Promise<{ ready: boolean; checks: Record<string, string> }> {
    return this.getJson('/readyz');
  }

  private async getJson<T>(path: string): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'GET',
      headers: this.headers()
    });
    return this.decode<T>(response, `GET ${path}`);
  }

  private async postJson<T>(path: string, payload: unknown, idempotencyKey?: string): Promise<T> {
    const headers = this.headers();
    headers['content-type'] = 'application/json';
    if (idempotencyKey) {
      headers['idempotency-key'] = idempotencyKey;
    }

    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    return this.decode<T>(response, `POST ${path}`);
  }

  private async decode<T>(response: Response, operation: string): Promise<T> {
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`${operation} failed with ${response.status}: ${body}`);
    }
    return (await response.json()) as T;
  }

  private headers(): Record<string, string> {
    const headers: Record<string, string> = {};
    if (this.token) {
      headers.authorization = `Bearer ${this.token}`;
    }
    return headers;
  }
}
