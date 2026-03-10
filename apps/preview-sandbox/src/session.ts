import type { PreviewSession, PreviewSessionStatus, TenantContext } from './types.js';

export function createPreviewSession(
  tenant: TenantContext,
  productId: string,
  adapterId: string,
  adapterVersion: string,
  now = new Date()
): PreviewSession {
  const stamp = now.toISOString();
  return {
    id: buildSessionId(tenant.tenantId, productId, adapterId, adapterVersion),
    productId,
    adapterId,
    adapterVersion,
    status: 'new',
    createdAt: stamp,
    updatedAt: stamp
  };
}

export function transitionPreviewSession(session: PreviewSession, nextStatus: PreviewSessionStatus, now = new Date()): PreviewSession {
  return {
    ...session,
    status: nextStatus,
    updatedAt: now.toISOString()
  };
}

export function buildSessionId(tenantId: string, productId: string, adapterId: string, adapterVersion: string): string {
  const normalized = [tenantId, productId, adapterId, adapterVersion].map((value) => sanitize(value)).join(':');
  return `preview:${normalized}`;
}

function sanitize(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '-');
}
