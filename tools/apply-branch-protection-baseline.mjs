import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const isCli = process.argv[1] && process.argv[1].endsWith('/apply-branch-protection-baseline.mjs');

if (isCli) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.owner || !args.repo || !args.branch || !args.baseline) {
    throw new Error('Usage: node tools/apply-branch-protection-baseline.mjs --owner <owner> --repo <repo> --branch <branch> --baseline <json> [--dry-run]');
  }

  const payload = await loadBaseline(args.baseline);
  if (!args.dryRun) {
    await applyBranchProtection({ owner: args.owner, repo: args.repo, branch: args.branch, payload, token: process.env.GH_TOKEN });
  }

  process.stdout.write(`${JSON.stringify({ valid: true, dryRun: Boolean(args.dryRun), owner: args.owner, repo: args.repo, branch: args.branch }, null, 2)}\n`);
}

export async function loadBaseline(path) {
  const payload = JSON.parse(await readFile(resolve(process.cwd(), path), 'utf8'));
  validateBaselinePayload(payload);
  return payload;
}

export function validateBaselinePayload(payload) {
  const checks = payload?.required_status_checks?.checks;
  if (!Array.isArray(checks) || checks.length === 0) {
    throw new Error('Baseline must declare required_status_checks.checks.');
  }
  if (typeof payload?.required_pull_request_reviews?.require_code_owner_reviews !== 'boolean') {
    throw new Error('Baseline must declare require_code_owner_reviews boolean.');
  }
}

export async function applyBranchProtection({ owner, repo, branch, payload, token }) {
  if (!token) {
    throw new Error('GH_TOKEN is required to apply branch protection baseline.');
  }

  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/branches/${branch}/protection`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`Branch protection apply failed (${response.status}): ${details}`);
  }
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--owner') {
      args.owner = argv[i + 1];
      i += 1;
    } else if (token === '--repo') {
      args.repo = argv[i + 1];
      i += 1;
    } else if (token === '--branch') {
      args.branch = argv[i + 1];
      i += 1;
    } else if (token === '--baseline') {
      args.baseline = argv[i + 1];
      i += 1;
    } else if (token === '--dry-run') {
      args.dryRun = true;
    }
  }
  return args;
}
