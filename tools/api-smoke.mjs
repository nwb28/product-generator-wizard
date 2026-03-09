#!/usr/bin/env node
import process from 'node:process';
import supertest from 'supertest';
import intake from '../fixtures/golden/pilot-intake.json' with { type: 'json' };
import { signTestToken } from '../apps/generator-api/dist/auth.js';
import { createApp } from '../apps/generator-api/dist/server.js';

const app = createApp();

async function run() {
  const token = await signTestToken('smoke-user', ['wizard-admin']);
  const authz = await supertest(app).get('/authz/wizard-entry').set('authorization', `Bearer ${token}`);
  assertStatus(authz.status, 200, 'authz/wizard-entry');

  const validate = await supertest(app).post('/validate').send(intake);
  assertStatus(validate.status, 200, '/validate');

  const generate = await supertest(app).post('/generate').set('authorization', `Bearer ${token}`).send(intake);
  assertStatus(generate.status, 200, '/generate');

  const review = await supertest(app).post('/review-document').set('authorization', `Bearer ${token}`).send(intake);
  assertStatus(review.status, 200, '/review-document');

  process.stdout.write('api smoke checks passed\n');
}

function assertStatus(actual, expected, route) {
  if (actual !== expected) {
    throw new Error(`Smoke check failed for ${route}: expected ${expected}, got ${actual}`);
  }
}

run().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
