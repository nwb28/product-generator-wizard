import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzePermissionMatrix } from './permissions.js';

test('analyzePermissionMatrix reports valid coverage for complete scopes', () => {
  const result = analyzePermissionMatrix({
    bucs: [{ role: 'reader', permissions: ['read'] }],
    firm: [{ role: 'writer', permissions: ['read', 'write'] }],
    company: [{ role: 'admin', permissions: ['read', 'write', 'approve'] }]
  });

  assert.equal(result.valid, true);
  assert.equal(result.summary.blocking, 0);
  assert.equal(result.coverage.bucs.roles, 1);
  assert.equal(result.coverage.company.permissions, 3);
});

test('analyzePermissionMatrix emits blocking diagnostics for missing scope and empty permission list', () => {
  const result = analyzePermissionMatrix({
    bucs: [{ role: 'reader', permissions: [] }]
  });

  assert.equal(result.valid, false);
  assert.ok(result.diagnostics.some((entry) => entry.code === 'PERMISSION_SCOPE_EMPTY_FIRM'));
  assert.ok(result.diagnostics.some((entry) => entry.code === 'PERMISSION_LIST_EMPTY_BUCS'));
});

test('analyzePermissionMatrix emits warnings for duplicated roles', () => {
  const result = analyzePermissionMatrix({
    bucs: [
      { role: 'reader', permissions: ['read'] },
      { role: 'reader', permissions: ['read'] }
    ],
    firm: [{ role: 'writer', permissions: ['read'] }],
    company: [{ role: 'admin', permissions: ['read'] }]
  });

  assert.ok(result.diagnostics.some((entry) => entry.code === 'PERMISSION_ROLE_DUPLICATE_BUCS'));
  assert.equal(result.summary.warning, 1);
});
