import test from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import intake from '@pgw/packages-contracts/dist/examples/intake.valid.v1.json' with { type: 'json' };
import { signTestToken } from '@pgw/apps-generator-api/dist/auth.js';
import { createApp } from '@pgw/apps-generator-api/dist/server.js';

const app = createApp();

async function bearer(): Promise<string> {
  const token = await signTestToken('e2e-user', ['wizard-admin']);
  return `Bearer ${token}`;
}

test('e2e happy path: entry auth -> validate -> generate -> review', async () => {
  const auth = await bearer();

  const entry = await supertest(app).get('/authz/wizard-entry').set('authorization', auth);
  assert.equal(entry.status, 200);

  const validate = await supertest(app).post('/validate').send(intake);
  assert.equal(validate.status, 200);
  assert.equal(validate.body.valid, true);

  const generate = await supertest(app).post('/generate').set('authorization', auth).send(intake);
  assert.equal(generate.status, 200);
  assert.equal(typeof generate.body.deterministicHash, 'string');

  const review = await supertest(app).post('/review-document').set('authorization', auth).send(intake);
  assert.equal(review.status, 200);
  assert.match(review.body.markdown, /Human Review Document/);
});

test('e2e auth failure: generation denied without auth', async () => {
  const response = await supertest(app).post('/generate').send(intake);
  assert.equal(response.status, 403);
});
