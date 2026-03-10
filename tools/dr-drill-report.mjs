import { readFile, writeFile, mkdir } from 'node:fs/promises';

const expectedHashPath = process.env.DR_EXPECTED_HASH_PATH ?? 'fixtures/dr/expected-hash.json';
const generationMetaPath = '.tmp/dr/restore/metadata/generation.json';

const expected = JSON.parse(await readFile(expectedHashPath, 'utf8'));
const generation = JSON.parse(await readFile(generationMetaPath, 'utf8'));

const expectedHash = expected.deterministicHash;
const actualHash = generation.deterministicHash;
const pass = expectedHash === actualHash;

const report = {
  generatedAt: new Date().toISOString(),
  expectedHash,
  actualHash,
  pass
};

await mkdir('.tmp/dr', { recursive: true });
await writeFile('.tmp/dr/drill-report.json', JSON.stringify(report, null, 2) + '\n', 'utf8');
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (!pass) {
  process.stderr.write(`DR drill hash mismatch: expected ${expectedHash}, got ${actualHash}\n`);
  process.exitCode = 1;
}
