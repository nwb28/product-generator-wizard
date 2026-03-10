import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderCodeowners } from './render-codeowners.mjs';

test('renderCodeowners writes rendered output', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pgw-codeowners-'));
  try {
    const template = join(dir, 'CODEOWNERS.template');
    const roles = join(dir, 'roles.json');
    const out = join(dir, 'CODEOWNERS');

    await writeFile(template, '* {{default_owner}}\n/apps/ {{backend}}\n', 'utf8');
    await writeFile(roles, JSON.stringify({ roles: { default_owner: '@a', backend: '@b' } }, null, 2), 'utf8');

    const result = await renderCodeowners({ templatePath: template, rolesPath: roles, outPath: out, check: false });
    assert.equal(result.valid, true);

    const rendered = await readFile(out, 'utf8');
    assert.equal(rendered, '* @a\n/apps/ @b\n');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('renderCodeowners fails when role alias is missing', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'pgw-codeowners-'));
  try {
    const template = join(dir, 'CODEOWNERS.template');
    const roles = join(dir, 'roles.json');

    await writeFile(template, '* {{default_owner}}\n/apps/ {{backend}}\n', 'utf8');
    await writeFile(roles, JSON.stringify({ roles: { default_owner: '@a' } }, null, 2), 'utf8');

    const result = await renderCodeowners({ templatePath: template, rolesPath: roles, outPath: join(dir, 'CODEOWNERS'), check: false });
    assert.equal(result.valid, false);
    assert.deepEqual(result.unresolved, ['backend']);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
