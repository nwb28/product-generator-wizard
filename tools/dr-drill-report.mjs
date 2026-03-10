import { readFile, writeFile, mkdir } from 'node:fs/promises';

const expectedHashPath = process.env.DR_EXPECTED_HASH_PATH ?? 'fixtures/dr/expected-hash.json';
const generationMetaPath = '.tmp/dr/restore/metadata/generation.json';
const previewCheckPath = '.tmp/dr/preview-check.json';

const expected = JSON.parse(await readFile(expectedHashPath, 'utf8'));
const generation = JSON.parse(await readFile(generationMetaPath, 'utf8'));
const previewCheck = JSON.parse(await readFile(previewCheckPath, 'utf8'));

const expectedHash = expected.deterministicHash;
const actualHash = generation.deterministicHash;
const corePass = expectedHash === actualHash;
const previewPass = Boolean(previewCheck.pass);

const report = {
  generatedAt: new Date().toISOString(),
  core: {
    expectedHash,
    actualHash,
    pass: corePass
  },
  previewEvidence: {
    sourceHash: previewCheck.sourceHash,
    restoreHash: previewCheck.restoreHash,
    pass: previewPass
  },
  pass: corePass && previewPass
};

await mkdir('.tmp/dr', { recursive: true });
await writeFile('.tmp/dr/drill-report.json', JSON.stringify(report, null, 2) + '\n', 'utf8');
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

if (!report.pass) {
  process.stderr.write(
    `DR drill mismatch: core expected ${expectedHash}, core actual ${actualHash}, preview pass ${previewPass}\n`
  );
  process.exitCode = 1;
}
