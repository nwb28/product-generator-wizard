import { test } from "node:test";
import assert from "node:assert/strict";

import { validatePerfReport } from "./validate-perf-report.mjs";

test("validatePerfReport passes when p95 values are within thresholds", () => {
  const result = validatePerfReport({
    policy: {
      longrun: {
        validateP95MaxMs: 750,
        generateP95MaxMs: 1500
      }
    },
    report: {
      metrics: {
        validate: { p95Ms: 50 },
        generate: { p95Ms: 60 }
      }
    }
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("validatePerfReport fails when p95 values exceed thresholds", () => {
  const result = validatePerfReport({
    policy: {
      longrun: {
        validateP95MaxMs: 100,
        generateP95MaxMs: 100
      }
    },
    report: {
      metrics: {
        validate: { p95Ms: 120 },
        generate: { p95Ms: 130 }
      }
    }
  });

  assert.equal(result.valid, false);
  assert.equal(result.errors.length, 2);
});
