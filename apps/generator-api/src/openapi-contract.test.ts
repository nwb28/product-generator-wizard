import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

test('openapi contract includes enterprise response codes for generation endpoints', () => {
  const openApiPath = resolve(process.cwd(), '../../docs/api/openapi.yaml');
  const content = readFileSync(openApiPath, 'utf8');

  assert.match(content, /\/generate:[\s\S]*'409':[\s\S]*'429':/);
  assert.match(content, /\/review-document:[\s\S]*'409':[\s\S]*'429':/);
  assert.match(content, /\/compile:[\s\S]*'403':[\s\S]*'429':/);
});
