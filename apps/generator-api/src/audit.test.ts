import test from 'node:test';
import assert from 'node:assert/strict';
import { createAuditLogger, type AuditSinkRecord } from './audit.js';

test('createAuditLogger emits tamper-evident chain metadata', () => {
  const records: AuditSinkRecord[] = [];
  const logger = createAuditLogger({
    sinks: [
      (record) => {
        records.push(record);
      }
    ]
  });

  logger.emit({
    eventType: 'wizard-authz',
    action: 'wizard-entry',
    outcome: 'allow',
    requestId: 'req-1',
    endpoint: '/authz/wizard-entry',
    tenantId: 'tenant-a',
    at: '2026-03-09T00:00:00.000Z'
  });

  logger.emit({
    eventType: 'wizard-operation',
    action: 'generate',
    outcome: 'success',
    requestId: 'req-2',
    endpoint: '/generate',
    tenantId: 'tenant-a',
    at: '2026-03-09T00:00:01.000Z'
  });

  assert.equal(records.length, 2);
  const first = records[0];
  const second = records[1];
  assert.ok(first);
  assert.ok(second);
  assert.equal(first.chain.sequence, 1);
  assert.equal(second.chain.sequence, 2);
  assert.equal(second.chain.previousHash, first.chain.eventHash);
});

test('createAuditLogger signs events when secret is provided', () => {
  const records: AuditSinkRecord[] = [];
  const logger = createAuditLogger({
    secret: 'audit-signing-secret',
    sinks: [
      (record) => {
        records.push(record);
      }
    ]
  });

  logger.emit({
    eventType: 'wizard-operation',
    action: 'compile',
    outcome: 'success',
    requestId: 'req-3',
    endpoint: '/compile',
    tenantId: 'tenant-b',
    at: '2026-03-09T00:00:02.000Z'
  });

  assert.equal(records.length, 1);
  const first = records[0];
  assert.ok(first);
  assert.equal(typeof first.chain.signature, 'string');
  assert.ok((first.chain.signature?.length ?? 0) > 10);
});
