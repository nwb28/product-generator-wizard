import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useMemo, useState } from 'react';
import { simulatePreview } from './api.js';
import { normalizePreviewViews } from './preview.js';
import { buildSignoffRecord, isReviewerChecklistComplete } from './reviewer.js';
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
    const [views, setViews] = useState([]);
    const [excelSimulation, setExcelSimulation] = useState(null);
    const [workforceSimulation, setWorkforceSimulation] = useState(null);
    const [reviewer, setReviewer] = useState('');
    const [checklist, setChecklist] = useState({
        permissionsVerified: false,
        mappingsVerified: false,
        securityEvidenceVerified: false,
        testsVerified: false
    });
    const [error, setError] = useState('');
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
    async function runSimulation() {
        if (!session) {
            return;
        }
        try {
            setError('');
            const response = await simulatePreview({
                schemaVersion: '1.0.0',
                adapter: { id: adapterId, version: adapterVersion },
                tenant: { id: tenant.tenantId },
                product: { id: productId, type: 'loan', displayName: productId },
                integrations: {
                    workforce: { enabled: true, details: { profile: 'default' } },
                    excelPlugin: { enabled: true, details: { mode: 'refresh', capabilities: ['refresh', 'export'] } }
                },
                permissions: {
                    bucs: [{ role: 'reader', permissions: ['read'] }],
                    firm: [{ role: 'writer', permissions: ['read', 'write'] }],
                    company: [{ role: 'admin', permissions: ['read', 'write', 'approve'] }]
                },
                mappings: [{ canonicalModel: 'loan', sourcePath: '$.loan', confidence: 0.95 }],
                preview: {
                    uiScreens: [
                        { id: 'summary', title: 'Summary' },
                        { id: 'details', title: 'Details' }
                    ]
                }
            });
            setViews(normalizePreviewViews(response.output.previewSession.views));
            setExcelSimulation(response.output.previewSession.excelSimulation ?? { enabled: false, capabilities: [] });
            setWorkforceSimulation(response.output.previewSession.workforceSimulation ?? { enabled: false, capabilities: [] });
            setSession(transitionPreviewSession(session, 'simulated'));
        }
        catch (simulationError) {
            setError(simulationError instanceof Error ? simulationError.message : 'Simulation failed.');
        }
    }
    return (_jsxs("main", { children: [_jsx("h1", { children: "Preview Sandbox" }), _jsxs("p", { children: ["Auth State: ", authState] }), _jsxs("section", { children: [_jsx("h2", { children: "Tenant Context" }), _jsxs("label", { children: ["Tenant ID", _jsx("input", { value: tenant.tenantId, onChange: (event) => setTenant({ ...tenant, tenantId: event.target.value }) })] }), _jsxs("label", { children: ["Principal", _jsx("input", { value: tenant.principalSub, onChange: (event) => setTenant({ ...tenant, principalSub: event.target.value }) })] })] }), _jsxs("section", { children: [_jsx("h2", { children: "Session Setup" }), _jsxs("label", { children: ["Product ID", _jsx("input", { value: productId, onChange: (event) => setProductId(event.target.value) })] }), _jsxs("label", { children: ["Adapter ID", _jsx("input", { value: adapterId, onChange: (event) => setAdapterId(event.target.value) })] }), _jsxs("label", { children: ["Adapter Version", _jsx("input", { value: adapterVersion, onChange: (event) => setAdapterVersion(event.target.value) })] }), _jsx("button", { type: 'button', onClick: createSession, children: "Create Preview Session" })] }), session ? (_jsxs("section", { children: [_jsx("h2", { children: "Session Lifecycle" }), _jsxs("p", { children: ["ID: ", session.id] }), _jsxs("p", { children: ["Status: ", session.status] }), _jsx("button", { type: 'button', onClick: () => move('validated'), children: "Mark Validated" }), _jsx("button", { type: 'button', onClick: () => move('simulated'), children: "Mark Simulated" }), _jsx("button", { type: 'button', onClick: () => void runSimulation(), children: "Run Simulation" }), _jsx("button", { type: 'button', onClick: () => move('reported'), children: "Mark Reported" })] })) : null, views.length > 0 ? (_jsxs("section", { children: [_jsx("h2", { children: "Preview Renderer" }), _jsx("ul", { children: views.map((view) => (_jsxs("li", { children: [_jsx("strong", { children: view.title }), " (", view.id, ")"] }, view.id))) })] })) : null, excelSimulation ? (_jsxs("section", { children: [_jsx("h2", { children: "Excel Plugin Simulation" }), _jsxs("p", { children: ["Enabled: ", excelSimulation.enabled ? 'Yes' : 'No'] }), _jsx("ul", { children: excelSimulation.capabilities.map((capability) => (_jsx("li", { children: capability }, capability))) })] })) : null, workforceSimulation ? (_jsxs("section", { children: [_jsx("h2", { children: "Workforce Simulation" }), _jsxs("p", { children: ["Enabled: ", workforceSimulation.enabled ? 'Yes' : 'No'] }), _jsx("ul", { children: workforceSimulation.capabilities.map((capability) => (_jsx("li", { children: capability }, capability))) })] })) : null, _jsxs("section", { children: [_jsx("h2", { children: "Reviewer Sign-Off" }), _jsxs("label", { children: ["Reviewer", _jsx("input", { value: reviewer, onChange: (event) => setReviewer(event.target.value) })] }), _jsxs("label", { children: [_jsx("input", { type: 'checkbox', checked: checklist.permissionsVerified, onChange: (event) => setChecklist({ ...checklist, permissionsVerified: event.target.checked }) }), "Permissions verified"] }), _jsxs("label", { children: [_jsx("input", { type: 'checkbox', checked: checklist.mappingsVerified, onChange: (event) => setChecklist({ ...checklist, mappingsVerified: event.target.checked }) }), "Mappings verified"] }), _jsxs("label", { children: [_jsx("input", { type: 'checkbox', checked: checklist.securityEvidenceVerified, onChange: (event) => setChecklist({ ...checklist, securityEvidenceVerified: event.target.checked }) }), "Security evidence verified"] }), _jsxs("label", { children: [_jsx("input", { type: 'checkbox', checked: checklist.testsVerified, onChange: (event) => setChecklist({ ...checklist, testsVerified: event.target.checked }) }), "Tests verified"] }), _jsxs("p", { children: ["Checklist complete: ", isReviewerChecklistComplete(checklist) ? 'Yes' : 'No'] }), session ? (_jsx("pre", { children: JSON.stringify(buildSignoffRecord({
                            reviewer,
                            checklist,
                            recommendation: session.status === 'reported' ? 'Go' : 'No-Go'
                        }), null, 2) })) : null] }), error ? _jsx("p", { role: 'alert', children: error }) : null] }));
}
//# sourceMappingURL=App.js.map