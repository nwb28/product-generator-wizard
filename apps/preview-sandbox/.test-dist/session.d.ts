import type { PreviewSession, PreviewSessionStatus, TenantContext } from './types.js';
export declare function createPreviewSession(tenant: TenantContext, productId: string, adapterId: string, adapterVersion: string, now?: Date): PreviewSession;
export declare function transitionPreviewSession(session: PreviewSession, nextStatus: PreviewSessionStatus, now?: Date): PreviewSession;
export declare function buildSessionId(tenantId: string, productId: string, adapterId: string, adapterVersion: string): string;
