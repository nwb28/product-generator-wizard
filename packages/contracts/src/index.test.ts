import test from 'node:test';
import assert from 'node:assert/strict';
import Ajv2020Import from 'ajv/dist/2020.js';
import intake from './examples/intake.valid.v1.json' with { type: 'json' };
import { intakeSchema } from './index.js';

type AjvInstance = {
  compile: (schema: object) => {
    (payload: object): boolean;
    errors?: { instancePath: string }[];
  };
};

type AjvCtor = new (opts: object) => AjvInstance;
const Ajv2020 = Ajv2020Import as unknown as AjvCtor;

test('intake schema accepts valid v1 payload', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(intakeSchema as object);
  const valid = validate(intake as object);

  assert.equal(valid, true, JSON.stringify(validate.errors));
});

test('intake schema enforces workforce details when enabled', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(intakeSchema as object);
  const invalid = structuredClone(intake) as any;
  delete invalid.integrations.workforce.provider;
  const valid = validate(invalid);

  assert.equal(valid, false);
  assert.ok(validate.errors?.some((x) => x.instancePath === '/integrations/workforce'));
});

test('intake schema enforces excel details when enabled', () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  const validate = ajv.compile(intakeSchema as object);
  const invalid = structuredClone(intake) as any;
  delete invalid.integrations.excelPlugin.templateVersion;
  const valid = validate(invalid);

  assert.equal(valid, false);
  assert.ok(validate.errors?.some((x) => x.instancePath === '/integrations/excelPlugin'));
});
