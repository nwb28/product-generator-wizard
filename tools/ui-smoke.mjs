#!/usr/bin/env node
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const distRoot = path.resolve('apps/wizard-ui/dist');
const indexPath = path.join(distRoot, 'index.html');

const indexHtml = readFileSync(indexPath, 'utf8');
if (!indexHtml.includes('<div id="root"></div>')) {
  throw new Error('UI smoke failed: index.html missing root mount element.');
}

const assetsDir = path.join(distRoot, 'assets');
const assetFiles = readdirSync(assetsDir).filter((file) => file.endsWith('.js'));
if (assetFiles.length === 0) {
  throw new Error('UI smoke failed: no JS bundle found in dist/assets.');
}

for (const file of assetFiles) {
  const size = statSync(path.join(assetsDir, file)).size;
  if (size <= 0) {
    throw new Error(`UI smoke failed: empty bundle detected (${file}).`);
  }
}

process.stdout.write('ui smoke checks passed\n');
