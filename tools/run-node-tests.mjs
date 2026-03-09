#!/usr/bin/env node
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const root = process.argv[2] ?? 'dist';
const files = [];

walk(root);

if (files.length === 0) {
  process.stderr.write(`No test files found under ${root}\n`);
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit'
});

process.exit(result.status ?? 1);

function walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry);
    const stat = statSync(full);

    if (stat.isDirectory()) {
      walk(full);
      continue;
    }

    if (entry.endsWith('.test.js')) {
      files.push(full);
    }
  }
}
