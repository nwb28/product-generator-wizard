import { useMemo, useState } from 'react';
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
          <button type='button' onClick={() => move('reported')}>
            Mark Reported
          </button>
        </section>
      ) : null}
    </main>
  );
}
