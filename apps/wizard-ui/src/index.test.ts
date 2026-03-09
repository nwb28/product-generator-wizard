import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDownloadFileName } from './download.js';
import { applyPrefill, parsePrefill } from './prefill.js';

test('buildDownloadFileName normalizes product id', () => {
  const name = buildDownloadFileName('Pilot Product 01');
  assert.equal(name, 'pilot-product-01-generated-package.json');
});

test('parsePrefill and applyPrefill map deep-link parameters to intake context', () => {
  const prefill = parsePrefill('?productType=note-payable&connectionType=api&tenant=contoso');
  const intake = applyPrefill({ schemaVersion: '1.0.0' }, prefill) as any;

  assert.equal(intake.product.productType, 'note-payable');
  assert.equal(intake.product.tenant, 'contoso');
  assert.equal(intake.controlPlane.connectionType, 'api');
});

test('parsePrefill handles missing query parameters', () => {
  const prefill = parsePrefill('');
  const intake = applyPrefill({ schemaVersion: '1.0.0' }, prefill) as any;

  assert.equal(intake.product.productType, undefined);
  assert.equal(intake.product.tenant, undefined);
  assert.equal(intake.controlPlane.connectionType, undefined);
});
