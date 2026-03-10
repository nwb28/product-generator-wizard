import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const isCli = process.argv[1] && process.argv[1].endsWith('/ensure-clean-worktree.mjs');

if (isCli) {
  const result = await verifyCleanWorktree();
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

export async function verifyCleanWorktree() {
  const [status, lsFiles] = await Promise.all([
    runGit(['status', '--porcelain']),
    runGit(['ls-files'])
  ]);

  const dirtyPaths = parseDirtyPaths(status);
  const trackedBuildArtifacts = findTrackedBuildArtifacts(lsFiles);

  const report = {
    dirtyPathCount: dirtyPaths.length,
    trackedBuildArtifactCount: trackedBuildArtifacts.length,
    dirtyPaths,
    trackedBuildArtifacts,
    valid: dirtyPaths.length === 0 && trackedBuildArtifacts.length === 0
  };

  if (!report.valid) {
    throw new Error(`Worktree cleanliness check failed: ${JSON.stringify(report, null, 2)}`);
  }

  return report;
}

export function parseDirtyPaths(statusOutput) {
  return statusOutput
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => line.slice(3));
}

export function findTrackedBuildArtifacts(lsFilesOutput) {
  return lsFilesOutput
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((path) => /(^|\/)dist\//.test(path) || /(^|\/)\.test-dist\//.test(path));
}

async function runGit(args) {
  const { stdout } = await execFileAsync('git', args, { encoding: 'utf8' });
  return stdout;
}
