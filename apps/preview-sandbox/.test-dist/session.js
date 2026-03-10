export function createPreviewSession(tenant, productId, adapterId, adapterVersion, now = new Date()) {
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
export function transitionPreviewSession(session, nextStatus, now = new Date()) {
    return {
        ...session,
        status: nextStatus,
        updatedAt: now.toISOString()
    };
}
export function buildSessionId(tenantId, productId, adapterId, adapterVersion) {
    const normalized = [tenantId, productId, adapterId, adapterVersion].map((value) => sanitize(value)).join(':');
    return `preview:${normalized}`;
}
function sanitize(value) {
    return value.trim().toLowerCase().replace(/[^a-z0-9_.-]+/g, '-');
}
//# sourceMappingURL=session.js.map