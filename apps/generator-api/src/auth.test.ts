import test from 'node:test';
import assert from 'node:assert/strict';
import { getAuthConfig } from './auth.js';

test('getAuthConfig allows defaults in test mode', () => {
  const config = getAuthConfig({ NODE_ENV: 'test' });
  assert.equal(config.issuer, 'product-generator-wizard');
  assert.equal(config.audience, 'wizard-api');
});

test('getAuthConfig rejects defaults in production mode', () => {
  assert.throws(
    () => getAuthConfig({ NODE_ENV: 'production' }),
    /Auth configuration must set WIZARD_AUTH_JWT_SECRET/
  );
});

test('getAuthConfig accepts explicit production settings', () => {
  const config = getAuthConfig({
    NODE_ENV: 'production',
    WIZARD_AUTH_JWT_SECRET: 'prod-secret-which-is-at-least-32-chars',
    WIZARD_AUTH_JWT_ISSUER: 'issuer-prod',
    WIZARD_AUTH_JWT_AUDIENCE: 'aud-prod'
  });

  assert.equal(config.secret, 'prod-secret-which-is-at-least-32-chars');
  assert.equal(config.issuer, 'issuer-prod');
  assert.equal(config.audience, 'aud-prod');
});

test('getAuthConfig rejects short production secrets', () => {
  assert.throws(
    () =>
      getAuthConfig({
        NODE_ENV: 'production',
        WIZARD_AUTH_JWT_SECRET: 'short-secret',
        WIZARD_AUTH_JWT_ISSUER: 'issuer-prod',
        WIZARD_AUTH_JWT_AUDIENCE: 'aud-prod'
      }),
    /at least 32 characters/
  );
});
