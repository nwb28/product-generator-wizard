import { test } from "node:test";
import assert from "node:assert/strict";

import { checkOpenApiCompatibility } from "./check-openapi-compat.mjs";

test("checkOpenApiCompatibility passes when required operations exist", () => {
  const result = checkOpenApiCompatibility({
    openapiDocument: {
      paths: {
        "/validate": {
          post: {}
        },
        "/healthz": {
          get: {}
        }
      }
    },
    policy: {
      requiredOperations: [
        { method: "post", path: "/validate" },
        { method: "get", path: "/healthz" }
      ]
    }
  });

  assert.equal(result.valid, true);
  assert.deepEqual(result.missingOperations, []);
});

test("checkOpenApiCompatibility fails when required operations are missing", () => {
  const result = checkOpenApiCompatibility({
    openapiDocument: {
      paths: {
        "/validate": {
          post: {}
        }
      }
    },
    policy: {
      requiredOperations: [
        { method: "post", path: "/validate" },
        { method: "post", path: "/generate" }
      ]
    }
  });

  assert.equal(result.valid, false);
  assert.deepEqual(result.missingOperations, ["post /generate"]);
});
