import test from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import intake from '@pgw/packages-contracts/dist/examples/intake.valid.v1.json' with { type: 'json' };
import { createApp } from './server.js';

const app = createApp();

test('POST /validate returns 200 for valid intake', async () => {
  const response = await supertest(app).post('/validate').send(intake);
  assert.equal(response.status, 200);
  assert.equal(response.body.valid, true);
});

test('GET /authz/wizard-entry returns 403 without role header', async () => {
  const response = await supertest(app).get('/authz/wizard-entry');
  assert.equal(response.status, 403);
});

test('GET /authz/wizard-entry returns 200 for product-generator role', async () => {
  const response = await supertest(app).get('/authz/wizard-entry').set('x-wizard-role', 'product-generator');
  assert.equal(response.status, 200);
  assert.equal(response.body.authorized, true);
});

test('POST /compile returns manifest', async () => {
  const response = await supertest(app)
    .post('/compile')
    .set('x-wizard-role', 'wizard-admin')
    .send(intake);
  assert.equal(response.status, 200);
  assert.equal(response.body.manifest.schemaVersion, '1.0.0');
});

test('POST /generate returns deterministic hash and files', async () => {
  const response = await supertest(app)
    .post('/generate')
    .set('x-wizard-role', 'wizard-admin')
    .send(intake);
  assert.equal(response.status, 200);
  assert.equal(typeof response.body.deterministicHash, 'string');
  assert.ok(Array.isArray(response.body.files));
});

test('POST /generate returns 403 without authorization role', async () => {
  const response = await supertest(app).post('/generate').send(intake);
  assert.equal(response.status, 403);
});

test('POST /review-document returns markdown', async () => {
  const response = await supertest(app)
    .post('/review-document')
    .set('x-wizard-role', 'wizard-admin')
    .send(intake);
  assert.equal(response.status, 200);
  assert.match(response.body.markdown, /Human Review Document/);
});
