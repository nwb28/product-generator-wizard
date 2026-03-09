import test from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import Ajv2020Import from 'ajv/dist/2020.js';
import intake from '@pgw/packages-contracts/dist/examples/intake.valid.v1.json' with { type: 'json' };
import schema from './contracts/validate-response.schema.json' with { type: 'json' };
import { createApp } from './server.js';

const app = createApp();

type AjvInstance = {
  compile: (schema: object) => {
    (payload: object): boolean;
    errors?: unknown[];
  };
};

type AjvCtor = new (opts: object) => AjvInstance;
const Ajv2020 = Ajv2020Import as unknown as AjvCtor;
const validator = new Ajv2020({ allErrors: true, strict: false }).compile(schema as object);

test('validate response matches diagnostics contract on success', async () => {
  const response = await supertest(app).post('/validate').send(intake);
  assert.equal(response.status, 200);

  const valid = validator(response.body as object);
  assert.equal(valid, true, JSON.stringify(validator.errors));
});

test('validate response matches diagnostics contract on schema failure', async () => {
  const broken = structuredClone(intake) as any;
  delete broken.product.name;

  const response = await supertest(app).post('/validate').send(broken);
  assert.equal(response.status, 400);

  const valid = validator(response.body as object);
  assert.equal(valid, true, JSON.stringify(validator.errors));
  assert.ok(response.body.diagnostics.length > 0);
});
