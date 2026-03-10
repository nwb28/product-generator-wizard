import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const API = 'https://api.github.com';

const isCli = process.argv[1] && process.argv[1].endsWith('/apply-environment-protection.mjs');

if (isCli) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.owner || !args.repo || !args.config) {
    throw new Error('Usage: node tools/apply-environment-protection.mjs --owner <owner> --repo <repo> --config <json> [--apply]');
  }

  const payload = JSON.parse(await readFile(resolve(process.cwd(), args.config), 'utf8'));
  const result = await applyEnvironmentProtection({
    owner: args.owner,
    repo: args.repo,
    config: payload,
    token: process.env.GH_TOKEN,
    apply: Boolean(args.apply)
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

export async function applyEnvironmentProtection({ owner, repo, config, token, apply }) {
  validateConfig(config);

  const reviewers = [];
  if (apply) {
    if (!token) {
      throw new Error('GH_TOKEN is required when --apply is set.');
    }
    for (const reviewer of config.reviewers) {
      const id = await resolveReviewerId({ owner, token, reviewer });
      reviewers.push({ type: reviewer.type, id });
    }

    await upsertEnvironment({ owner, repo, config, reviewers, token });
  }

  return {
    valid: true,
    apply,
    environment: config.environment,
    reviewerCount: config.reviewers.length,
    preventSelfReview: Boolean(config.preventSelfReview)
  };
}

export function validateConfig(config) {
  if (!config.environment) {
    throw new Error('environment is required.');
  }
  if (!Array.isArray(config.reviewers) || config.reviewers.length === 0) {
    throw new Error('at least one reviewer is required.');
  }
}

async function resolveReviewerId({ owner, token, reviewer }) {
  if (reviewer.type === 'User') {
    const response = await fetch(`${API}/users/${reviewer.login}`, { headers: headers(token) });
    if (!response.ok) {
      throw new Error(`Failed to resolve reviewer user ${reviewer.login}: ${response.status} ${await response.text()}`);
    }
    const user = await response.json();
    return user.id;
  }

  if (reviewer.type === 'Team') {
    const response = await fetch(`${API}/orgs/${owner}/teams/${reviewer.slug}`, { headers: headers(token) });
    if (!response.ok) {
      throw new Error(`Failed to resolve reviewer team ${reviewer.slug}: ${response.status} ${await response.text()}`);
    }
    const team = await response.json();
    return team.id;
  }

  throw new Error(`Unsupported reviewer type: ${reviewer.type}`);
}

async function upsertEnvironment({ owner, repo, config, reviewers, token }) {
  const body = {
    wait_timer: Number(config.waitTimer ?? 0),
    reviewers: reviewers.map((reviewer) => ({ type: reviewer.type, id: reviewer.id })),
    deployment_branch_policy: null,
    prevent_self_review: Boolean(config.preventSelfReview)
  };

  const response = await fetch(`${API}/repos/${owner}/${repo}/environments/${encodeURIComponent(config.environment)}`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Failed to upsert environment: ${response.status} ${await response.text()}`);
  }
}

function headers(token) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json'
  };
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
    } else if (token === '--config') {
      args.config = argv[i + 1];
      i += 1;
    } else if (token === '--apply') {
      args.apply = true;
    }
  }
  return args;
}
