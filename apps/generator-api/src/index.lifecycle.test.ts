import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { installGracefulShutdown } from './index.js';

test('installGracefulShutdown exits 0 after server closes cleanly on signal', async () => {
  const signalSource = new EventEmitter();
  const exits: number[] = [];
  const logs: string[] = [];

  const server = {
    close(callback: (error?: Error) => void) {
      setTimeout(() => callback(), 0);
    },
    closeAllConnections() {
      logs.push('closeAllConnections');
    }
  };

  const dispose = installGracefulShutdown(server, {
    timeoutMs: 50,
    signalSource: signalSource as any,
    exit(code) {
      exits.push(code);
    },
    log(message) {
      logs.push(message);
    }
  });

  signalSource.emit('SIGTERM');
  await new Promise((resolve) => setTimeout(resolve, 10));

  assert.deepEqual(exits, [0]);
  assert.ok(logs.some((entry) => entry.includes('shutdown initiated by SIGTERM')));
  assert.ok(logs.some((entry) => entry === 'closeAllConnections'));

  dispose();
});

test('installGracefulShutdown exits 1 when shutdown timeout elapses', async () => {
  const signalSource = new EventEmitter();
  const exits: number[] = [];

  const server = {
    close() {
      // Intentionally never invokes callback to simulate stuck shutdown.
    }
  };

  const dispose = installGracefulShutdown(server as any, {
    timeoutMs: 5,
    signalSource: signalSource as any,
    exit(code) {
      exits.push(code);
    },
    log() {}
  });

  signalSource.emit('SIGINT');
  await new Promise((resolve) => setTimeout(resolve, 25));

  assert.deepEqual(exits, [1]);
  dispose();
});
