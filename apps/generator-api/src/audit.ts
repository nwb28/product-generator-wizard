import { randomUUID } from 'node:crypto';
import { appendFileSync } from 'node:fs';
import { createHash, createHmac } from 'node:crypto';

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

export type AuditSinkRecord = AuditEvent & {
  chain: {
    previousHash: string;
    eventHash: string;
    sequence: number;
    signature?: string;
  };
};

type AuditLoggerOptions = {
  secret?: string;
  sinks?: Array<(record: AuditSinkRecord) => void>;
};

export function createAuditLogger(options: AuditLoggerOptions = {}): AuditLogger {
  const sinks = options.sinks ?? createDefaultSinks(process.env);
  const secret = options.secret ?? process.env.WIZARD_AUDIT_HMAC_SECRET;
  let previousHash = createHash('sha256').update('wizard-audit-genesis').digest('hex');
  let sequence = 0;

  return {
    emit(event) {
      sequence += 1;
      const eventDigest = canonicalHash({
        eventType: event.eventType,
        action: event.action,
        outcome: event.outcome,
        requestId: event.requestId,
        endpoint: event.endpoint,
        principalSub: event.principalSub,
        tenantId: event.tenantId,
        detail: event.detail,
        at: event.at,
        previousHash,
        sequence
      });

      const record: AuditSinkRecord = {
        ...event,
        chain: {
          previousHash,
          eventHash: eventDigest,
          sequence,
          ...(secret ? { signature: signEvent(secret, eventDigest) } : {})
        }
      };
      previousHash = eventDigest;

      for (const sink of sinks) {
        sink(record);
      }
    }
  };
}

export function resolveRequestId(requestIdHeader: string | undefined): string {
  if (requestIdHeader && requestIdHeader.trim().length > 0) {
    return requestIdHeader.trim();
  }

  return randomUUID();
}

export function stdoutAuditSink(record: AuditSinkRecord): void {
  process.stdout.write(`${JSON.stringify(record)}\n`);
}

export function fileAppendAuditSink(path: string): (record: AuditSinkRecord) => void {
  return (record) => {
    appendFileSync(path, `${JSON.stringify(record)}\n`, 'utf8');
  };
}

function createDefaultSinks(env: NodeJS.ProcessEnv): Array<(record: AuditSinkRecord) => void> {
  const sinks = [stdoutAuditSink];
  const filePath = env.WIZARD_AUDIT_LOG_PATH;
  if (filePath) {
    sinks.push(fileAppendAuditSink(filePath));
  }
  return sinks;
}

function canonicalHash(value: unknown): string {
  return createHash('sha256').update(stableSerialize(value), 'utf8').digest('hex');
}

function stableSerialize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    const objectValue = value as Record<string, unknown>;
    const keys = Object.keys(objectValue).sort();
    const content = keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(objectValue[key])}`).join(',');
    return `{${content}}`;
  }

  return JSON.stringify(value);
}

function signEvent(secret: string, eventHash: string): string {
  return createHmac('sha256', secret).update(eventHash, 'utf8').digest('hex');
}
