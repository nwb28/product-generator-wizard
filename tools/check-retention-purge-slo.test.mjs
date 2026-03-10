import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePurgeSlo } from './check-retention-purge-slo.mjs';

test('evaluatePurgeSlo passes when latest successful run is fresh', () => {
  const result = evaluatePurgeSlo({
    nowIso: '2026-03-10T12:00:00.000Z',
    maxAgeHours: 26,
    runsPayload: {
      workflow_runs: [
        {
          id: 1,
          conclusion: 'success',
          updated_at: '2026-03-10T00:30:00.000Z',
          html_url: 'https://example.test/runs/1'
        }
      ]
    }
  });

  assert.equal(result.valid, true);
  assert.equal(result.latestSuccessfulRunId, 1);
});

test('evaluatePurgeSlo fails when latest successful run is stale', () => {
  const result = evaluatePurgeSlo({
    nowIso: '2026-03-10T12:00:00.000Z',
    maxAgeHours: 10,
    runsPayload: {
      workflow_runs: [
        {
          id: 2,
          conclusion: 'success',
          updated_at: '2026-03-09T00:30:00.000Z',
          html_url: 'https://example.test/runs/2'
        }
      ]
    }
  });

  assert.equal(result.valid, false);
});
