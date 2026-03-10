import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSessionId, createPreviewSession, transitionPreviewSession } from './session.js';

test('buildSessionId normalizes deterministic key', () => {
  const id = buildSessionId('Tenant A', 'Loan Product', 'Pilot Adapter', '1.0.0');
  assert.equal(id, 'preview:tenant-a:loan-product:pilot-adapter:1.0.0');
});

test('createPreviewSession creates new session status', () => {
  const now = new Date('2026-03-10T00:00:00.000Z');
  const session = createPreviewSession(
    { tenantId: 'tenant-a', principalSub: 'user-a' },
    'product-a',
    'pilot-adapter',
    '1.0.0',
    now
  );

  assert.equal(session.status, 'new');
  assert.equal(session.createdAt, '2026-03-10T00:00:00.000Z');
  assert.equal(session.updatedAt, '2026-03-10T00:00:00.000Z');
});

test('transitionPreviewSession updates status and timestamp', () => {
  const initial = createPreviewSession(
    { tenantId: 'tenant-a', principalSub: 'user-a' },
    'product-a',
    'pilot-adapter',
    '1.0.0',
    new Date('2026-03-10T00:00:00.000Z')
  );

  const moved = transitionPreviewSession(initial, 'validated', new Date('2026-03-10T00:01:00.000Z'));
  assert.equal(moved.status, 'validated');
  assert.equal(moved.updatedAt, '2026-03-10T00:01:00.000Z');
  assert.equal(moved.createdAt, '2026-03-10T00:00:00.000Z');
});
