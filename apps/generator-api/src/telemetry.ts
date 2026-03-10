type TelemetryAttributes = Record<string, string | number | boolean>;

export type TelemetrySpan = {
  end(result: { statusCode: number; outcome: 'success' | 'error' | 'throttled' }): void;
};

export type TelemetryClient = {
  startSpan(name: string, attributes: TelemetryAttributes): TelemetrySpan;
  recordCounter(name: string, value: number, attributes: TelemetryAttributes): void;
  recordHistogram(name: string, value: number, attributes: TelemetryAttributes): void;
};

type TelemetryEvent =
  | { type: 'span-start'; name: string; attributes: TelemetryAttributes; at: string }
  | {
      type: 'span-end';
      name: string;
      attributes: TelemetryAttributes;
      statusCode: number;
      outcome: 'success' | 'error' | 'throttled';
      durationMs: number;
      at: string;
    }
  | { type: 'counter'; name: string; value: number; attributes: TelemetryAttributes; at: string }
  | { type: 'histogram'; name: string; value: number; attributes: TelemetryAttributes; at: string };

export function createTelemetryClient(emit: (event: TelemetryEvent) => void = emitStdout): TelemetryClient {
  return {
    startSpan(name, attributes) {
      const start = Date.now();
      emit({ type: 'span-start', name, attributes, at: new Date(start).toISOString() });
      return {
        end(result) {
          const end = Date.now();
          emit({
            type: 'span-end',
            name,
            attributes,
            statusCode: result.statusCode,
            outcome: result.outcome,
            durationMs: end - start,
            at: new Date(end).toISOString()
          });
        }
      };
    },
    recordCounter(name, value, attributes) {
      emit({ type: 'counter', name, value, attributes, at: new Date().toISOString() });
    },
    recordHistogram(name, value, attributes) {
      emit({ type: 'histogram', name, value, attributes, at: new Date().toISOString() });
    }
  };
}

function emitStdout(event: TelemetryEvent): void {
  if (process.env.WIZARD_TELEMETRY_STDOUT !== 'true') {
    return;
  }

  process.stdout.write(`${JSON.stringify(event)}\n`);
}
