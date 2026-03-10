export type PreviewSimulateResponse = {
  validation: {
    valid: boolean;
    summary: {
      blocking: number;
      warning: number;
    };
  };
  output: {
    previewSession: {
      views: Array<{ id: string; title: string; payload: Record<string, unknown> }>;
      excelSimulation?: {
        enabled: boolean;
        capabilities: string[];
      };
      workforceSimulation?: {
        enabled: boolean;
        capabilities: string[];
      };
    };
  };
  artifacts?: {
    deterministicHash: string;
    files: Array<{ path: string; content: string }>;
  };
};

export async function simulatePreview(payload: unknown): Promise<PreviewSimulateResponse> {
  const response = await fetch('/preview/simulate', {
    method: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Preview simulate failed with ${response.status}: ${body}`);
  }

  return (await response.json()) as PreviewSimulateResponse;
}
