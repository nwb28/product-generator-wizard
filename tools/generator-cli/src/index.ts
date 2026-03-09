#!/usr/bin/env node
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { compileManifest } from '@pgw/packages-compiler/dist/index.js';
import { generateHumanReviewDocument } from '@pgw/packages-review-doc/dist/index.js';
import { generatePilotScaffold } from '@pgw/packages-scaffold-templates/dist/index.js';
import { toHumanSummary, validateIntake } from '@pgw/packages-validator/dist/index.js';

export type CliIO = {
  log: (message: string) => void;
  error: (message: string) => void;
};

const defaultIO: CliIO = {
  log: (msg) => process.stdout.write(`${msg}\n`),
  error: (msg) => process.stderr.write(`${msg}\n`)
};

export async function runCli(args: string[], io: CliIO = defaultIO): Promise<number> {
  const [command, ...rest] = args;

  if (!command || command === '--help' || command === '-h') {
    io.log('Usage: wizard <validate|generate|ci-check> <intake> [--out <dir>]');
    return 2;
  }

  if (command === 'validate') {
    const intakePath = rest[0];
    if (!intakePath) {
      io.error('Missing intake file path.');
      return 2;
    }

    const intake = await loadJson(intakePath);
    const validation = validateIntake(intake);
    io.log(toHumanSummary(validation));
    return validation.valid ? 0 : 1;
  }

  if (command === 'generate') {
    const intakePath = rest[0];
    const outIdx = rest.indexOf('--out');
    const outDir = outIdx >= 0 ? rest[outIdx + 1] : undefined;
    if (!intakePath || !outDir) {
      io.error('Usage: wizard generate <intake> --out <dir>');
      return 2;
    }

    const intake = await loadJson(intakePath);
    const validation = validateIntake(intake);
    if (!validation.valid) {
      io.error(toHumanSummary(validation));
      return 1;
    }

    const manifest = compileManifest(intake as any);
    const scaffold = generatePilotScaffold(manifest);
    const review = generateHumanReviewDocument(intake as any, validation);

    await mkdir(outDir, { recursive: true });
    for (const file of scaffold.files) {
      const target = path.join(outDir, file.path);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, file.content, 'utf8');
    }

    const reviewPath = path.join(outDir, 'review/human-review.md');
    await mkdir(path.dirname(reviewPath), { recursive: true });
    await writeFile(reviewPath, review.markdown, 'utf8');

    io.log(`Generated ${scaffold.files.length + 1} files`);
    return 0;
  }

  if (command === 'ci-check') {
    const intakePath = rest[0];
    if (!intakePath) {
      io.error('Usage: wizard ci-check <intake>');
      return 2;
    }

    const intake = await loadJson(intakePath);
    const validation = validateIntake(intake);
    io.log(toHumanSummary(validation));
    if (!validation.valid) {
      return 1;
    }

    const manifest = compileManifest(intake as any);
    const scaffold = generatePilotScaffold(manifest);
    if (!scaffold.deterministicHash || scaffold.files.length === 0) {
      io.error('Scaffold generation failed deterministic checks.');
      return 1;
    }

    io.log(`CI check passed with hash ${scaffold.deterministicHash}`);
    return 0;
  }

  io.error(`Unknown command: ${command}`);
  return 2;
}

async function loadJson(filePath: string): Promise<unknown> {
  const raw = await readFile(filePath, 'utf8');
  return JSON.parse(raw) as unknown;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCli(process.argv.slice(2)).then((exitCode) => {
    process.exitCode = exitCode;
  });
}
