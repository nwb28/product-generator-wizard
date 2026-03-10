import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { createPreviewSession, transitionPreviewSession } from './session.js';
const defaultTenant = {
    tenantId: 'unknown-tenant',
    principalSub: 'anonymous'
};
export function App() {
    const [tenant, setTenant] = useState(defaultTenant);
    const [productId, setProductId] = useState('pilot-product');
    const [adapterId, setAdapterId] = useState('pilot-loan-adapter');
    const [adapterVersion, setAdapterVersion] = useState('1.0.0');
    const [session, setSession] = useState(null);
    const authState = useMemo(() => {
        const hasToken = Boolean(window.localStorage.getItem('previewSandboxToken'));
        return hasToken ? 'Authorized' : 'Read-Only';
    }, []);
    function createSession() {
        setSession(createPreviewSession(tenant, productId, adapterId, adapterVersion));
    }
    function move(status) {
        if (!session) {
            return;
        }
        setSession(transitionPreviewSession(session, status));
    }
    return (_jsxs("main", { children: [_jsx("h1", { children: "Preview Sandbox" }), _jsxs("p", { children: ["Auth State: ", authState] }), _jsxs("section", { children: [_jsx("h2", { children: "Tenant Context" }), _jsxs("label", { children: ["Tenant ID", _jsx("input", { value: tenant.tenantId, onChange: (event) => setTenant({ ...tenant, tenantId: event.target.value }) })] }), _jsxs("label", { children: ["Principal", _jsx("input", { value: tenant.principalSub, onChange: (event) => setTenant({ ...tenant, principalSub: event.target.value }) })] })] }), _jsxs("section", { children: [_jsx("h2", { children: "Session Setup" }), _jsxs("label", { children: ["Product ID", _jsx("input", { value: productId, onChange: (event) => setProductId(event.target.value) })] }), _jsxs("label", { children: ["Adapter ID", _jsx("input", { value: adapterId, onChange: (event) => setAdapterId(event.target.value) })] }), _jsxs("label", { children: ["Adapter Version", _jsx("input", { value: adapterVersion, onChange: (event) => setAdapterVersion(event.target.value) })] }), _jsx("button", { type: 'button', onClick: createSession, children: "Create Preview Session" })] }), session ? (_jsxs("section", { children: [_jsx("h2", { children: "Session Lifecycle" }), _jsxs("p", { children: ["ID: ", session.id] }), _jsxs("p", { children: ["Status: ", session.status] }), _jsx("button", { type: 'button', onClick: () => move('validated'), children: "Mark Validated" }), _jsx("button", { type: 'button', onClick: () => move('simulated'), children: "Mark Simulated" }), _jsx("button", { type: 'button', onClick: () => move('reported'), children: "Mark Reported" })] })) : null] }));
}
//# sourceMappingURL=App.js.map