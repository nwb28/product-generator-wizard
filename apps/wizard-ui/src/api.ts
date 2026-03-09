import type { GenerateResponse, ValidateResponse } from './types.js';

const WIZARD_ROLE = 'wizard-admin';

export async function validateIntakeApi(payload: unknown): Promise<ValidateResponse> {
  const response = await fetch('/validate', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      'x-wizard-role': WIZARD_ROLE
    },
    body: JSON.stringify(payload)
  });

  return (await response.json()) as ValidateResponse;
}

export async function generateArtifactsApi(payload: unknown): Promise<GenerateResponse> {
  const response = await fetch('/generate', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      'x-wizard-role': WIZARD_ROLE
    },
    body: JSON.stringify(payload)
  });

  return (await response.json()) as GenerateResponse;
}

export async function checkWizardEntryAuthorization(): Promise<boolean> {
  const response = await fetch('/authz/wizard-entry', {
    method: 'GET',
    credentials: 'include',
    headers: {
      'x-wizard-role': WIZARD_ROLE
    }
  });

  return response.ok;
}
