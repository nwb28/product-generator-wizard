import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const path = 'docs/api/openapi.yaml';
const raw = readFileSync(path, 'utf8');
const spec = parse(raw);

const errors = [];
if (!spec || typeof spec !== 'object') {
  errors.push('OpenAPI spec must parse into an object.');
}

if (spec.openapi !== '3.0.3') {
  errors.push(`OpenAPI version must be 3.0.3 (received ${String(spec.openapi)})`);
}

if (!spec.paths || typeof spec.paths !== 'object') {
  errors.push('paths object is required.');
}

assertResponseCodes(spec, '/generate', 'post', ['200', '400', '403', '409', '429'], errors);
assertResponseCodes(spec, '/review-document', 'post', ['200', '400', '403', '409', '429'], errors);
assertResponseCodes(spec, '/compile', 'post', ['200', '400', '403', '429'], errors);
assertResponseCodes(spec, '/validate', 'post', ['200', '400', '429'], errors);

if (errors.length > 0) {
  process.stderr.write(`OpenAPI validation failed:\n- ${errors.join('\n- ')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`OpenAPI validation passed for ${path}.\n`);
}

function assertResponseCodes(specification, route, method, expectedCodes, errorsOut) {
  const operation = specification.paths?.[route]?.[method];
  if (!operation) {
    errorsOut.push(`Missing operation ${method.toUpperCase()} ${route}`);
    return;
  }

  const responses = operation.responses;
  if (!responses || typeof responses !== 'object') {
    errorsOut.push(`Operation ${method.toUpperCase()} ${route} must define responses`);
    return;
  }

  for (const code of expectedCodes) {
    if (!responses[code]) {
      errorsOut.push(`Operation ${method.toUpperCase()} ${route} missing response ${code}`);
    }
  }
}
