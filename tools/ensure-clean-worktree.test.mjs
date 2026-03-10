import assert from 'node:assert/strict';
import test from 'node:test';
import { findTrackedBuildArtifacts, parseDirtyPaths } from './ensure-clean-worktree.mjs';

test('parseDirtyPaths returns changed file paths', () => {
  const output = ' M docs/README.md\nA  tools/new-tool.mjs\n?? ignored.tmp\n';
  assert.deepEqual(parseDirtyPaths(output), ['docs/README.md', 'tools/new-tool.mjs', 'ignored.tmp']);
});

test('findTrackedBuildArtifacts returns dist and .test-dist paths', () => {
  const output = [
    'apps/generator-api/src/index.ts',
    'apps/generator-api/dist/index.js',
    'apps/wizard-ui/.test-dist/App.js',
    'docs/README.md'
  ].join('\n');

  assert.deepEqual(findTrackedBuildArtifacts(output), [
    'apps/generator-api/dist/index.js',
    'apps/wizard-ui/.test-dist/App.js'
  ]);
});
