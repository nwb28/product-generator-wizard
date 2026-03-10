import { useMemo, useState } from 'react';
import { simulatePreview } from './api.js';
import { normalizePreviewViews } from './preview.js';
import { createPreviewSession, transitionPreviewSession } from './session.js';
import type { PreviewSession, PreviewSessionStatus, TenantContext } from './types.js';

const defaultTenant: TenantContext = {
  tenantId: 'unknown-tenant',
  principalSub: 'anonymous'
};

export function App() {
  const [tenant, setTenant] = useState<TenantContext>(defaultTenant);
  const [productId, setProductId] = useState('pilot-product');
  const [adapterId, setAdapterId] = useState('pilot-loan-adapter');
  const [adapterVersion, setAdapterVersion] = useState('1.0.0');
  const [session, setSession] = useState<PreviewSession | null>(null);
  const [views, setViews] = useState<Array<{ id: string; title: string; payload: Record<string, unknown> }>>([]);
  const [excelSimulation, setExcelSimulation] = useState<{ enabled: boolean; capabilities: string[] } | null>(null);
  const [workforceSimulation, setWorkforceSimulation] = useState<{ enabled: boolean; capabilities: string[] } | null>(
    null
  );
  const [error, setError] = useState('');

  const authState = useMemo(() => {
    const hasToken = Boolean(window.localStorage.getItem('previewSandboxToken'));
    return hasToken ? 'Authorized' : 'Read-Only';
  }, []);

  function createSession() {
    setSession(createPreviewSession(tenant, productId, adapterId, adapterVersion));
  }

  function move(status: PreviewSessionStatus) {
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
    } catch (simulationError) {
      setError(simulationError instanceof Error ? simulationError.message : 'Simulation failed.');
    }
  }

  return (
    <main>
      <h1>Preview Sandbox</h1>
      <p>Auth State: {authState}</p>

      <section>
        <h2>Tenant Context</h2>
        <label>
          Tenant ID
          <input value={tenant.tenantId} onChange={(event) => setTenant({ ...tenant, tenantId: event.target.value })} />
        </label>
        <label>
          Principal
          <input
            value={tenant.principalSub}
            onChange={(event) => setTenant({ ...tenant, principalSub: event.target.value })}
          />
        </label>
      </section>

      <section>
        <h2>Session Setup</h2>
        <label>
          Product ID
          <input value={productId} onChange={(event) => setProductId(event.target.value)} />
        </label>
        <label>
          Adapter ID
          <input value={adapterId} onChange={(event) => setAdapterId(event.target.value)} />
        </label>
        <label>
          Adapter Version
          <input value={adapterVersion} onChange={(event) => setAdapterVersion(event.target.value)} />
        </label>
        <button type='button' onClick={createSession}>
          Create Preview Session
        </button>
      </section>

      {session ? (
        <section>
          <h2>Session Lifecycle</h2>
          <p>ID: {session.id}</p>
          <p>Status: {session.status}</p>
          <button type='button' onClick={() => move('validated')}>
            Mark Validated
          </button>
          <button type='button' onClick={() => move('simulated')}>
            Mark Simulated
          </button>
          <button type='button' onClick={() => void runSimulation()}>
            Run Simulation
          </button>
          <button type='button' onClick={() => move('reported')}>
            Mark Reported
          </button>
        </section>
      ) : null}

      {views.length > 0 ? (
        <section>
          <h2>Preview Renderer</h2>
          <ul>
            {views.map((view) => (
              <li key={view.id}>
                <strong>{view.title}</strong> ({view.id})
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {excelSimulation ? (
        <section>
          <h2>Excel Plugin Simulation</h2>
          <p>Enabled: {excelSimulation.enabled ? 'Yes' : 'No'}</p>
          <ul>
            {excelSimulation.capabilities.map((capability) => (
              <li key={capability}>{capability}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {workforceSimulation ? (
        <section>
          <h2>Workforce Simulation</h2>
          <p>Enabled: {workforceSimulation.enabled ? 'Yes' : 'No'}</p>
          <ul>
            {workforceSimulation.capabilities.map((capability) => (
              <li key={capability}>{capability}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {error ? <p role='alert'>{error}</p> : null}
    </main>
  );
}
