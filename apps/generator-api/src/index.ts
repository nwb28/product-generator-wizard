import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createApp } from './server.js';

type SignalProcessLike = {
  on(event: NodeJS.Signals, listener: () => void): SignalProcessLike;
  off(event: NodeJS.Signals, listener: () => void): SignalProcessLike;
};

type GracefulShutdownOptions = {
  timeoutMs?: number;
  signals?: NodeJS.Signals[];
  signalSource?: SignalProcessLike;
  exit?: (code: number) => void;
  log?: (message: string) => void;
};

type ApiServer = {
  close: (callback: (error?: Error) => void) => unknown;
  closeAllConnections?: () => void;
};

export function installGracefulShutdown(server: ApiServer, options: GracefulShutdownOptions = {}): () => void {
  const timeoutMs = options.timeoutMs ?? readEnvPositiveInteger('WIZARD_SHUTDOWN_TIMEOUT_MS', 10_000);
  const signals = options.signals ?? ['SIGTERM', 'SIGINT'];
  const signalSource = options.signalSource ?? process;
  const exit = options.exit ?? ((code: number) => process.exit(code));
  const log = options.log ?? ((message: string) => process.stdout.write(`${message}\n`));
  let shuttingDown = false;
  let timeoutHandle: NodeJS.Timeout | undefined;

  const shutdown = (signal: NodeJS.Signals) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    log(`generator-api shutdown initiated by ${signal}`);
    timeoutHandle = setTimeout(() => {
      log(`generator-api shutdown forced after ${timeoutMs}ms timeout`);
      exit(1);
    }, timeoutMs);

    server.close((error?: Error) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      if (error) {
        log(`generator-api shutdown error: ${error.message}`);
        exit(1);
        return;
      }
      log('generator-api shutdown complete');
      exit(0);
    });

    server.closeAllConnections?.();
  };

  const handlers = new Map<NodeJS.Signals, () => void>();
  for (const signal of signals) {
    const handler = () => shutdown(signal);
    handlers.set(signal, handler);
    signalSource.on(signal, handler);
  }

  return () => {
    for (const [signal, handler] of handlers) {
      signalSource.off(signal, handler);
    }
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  };
}

export function startApiServer(port = Number(process.env.PORT || '4000')) {
  const app = createApp();
  const server = app.listen(port, () => {
    process.stdout.write(`generator-api listening on ${port}\n`);
  });
  const dispose = installGracefulShutdown(server);
  return { server, dispose };
}

function readEnvPositiveInteger(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return parsed;
}

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) {
    return false;
  }
  return resolve(entry) === fileURLToPath(import.meta.url);
}

if (process.env.NODE_ENV !== 'test' && isDirectExecution()) {
  startApiServer();
}
