import { randomUUID } from 'node:crypto';

export type AuditOutcome = 'allow' | 'deny' | 'success' | 'failure' | 'throttled' | 'conflict' | 'replayed';

export type AuditEvent = {
  eventType: 'wizard-authz' | 'wizard-operation';
  action: string;
  outcome: AuditOutcome;
  requestId: string;
  endpoint: string;
  principalSub?: string | undefined;
  tenantId: string;
  detail?: string | undefined;
  at: string;
};

export type AuditLogger = {
  emit(event: AuditEvent): void;
};

export function createAuditLogger(): AuditLogger {
  return {
    emit(event) {
      process.stdout.write(`${JSON.stringify(event)}\n`);
    }
  };
}

export function resolveRequestId(requestIdHeader: string | undefined): string {
  if (requestIdHeader && requestIdHeader.trim().length > 0) {
    return requestIdHeader.trim();
  }

  return randomUUID();
}
