import type { GenerateResponse } from './types.js';

export function toDownloadBlob(payload: GenerateResponse): Blob {
  const normalized = JSON.stringify(payload, null, 2);
  return new Blob([normalized], { type: 'application/json' });
}

export function buildDownloadFileName(productId: string): string {
  return `${sanitize(productId)}-generated-package.json`;
}

function sanitize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-');
}
