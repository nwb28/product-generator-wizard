import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const API = 'https://api.github.com';

const isCli = process.argv[1] && process.argv[1].endsWith('/bootstrap-issue-labels.mjs');

if (isCli) {
  const args = parseArgs(process.argv.slice(2));
  if (!args.owner || !args.repo || !args.config) {
    throw new Error('Usage: node tools/bootstrap-issue-labels.mjs --owner <owner> --repo <repo> --config <json> [--apply]');
  }

  const config = JSON.parse(await readFile(resolve(process.cwd(), args.config), 'utf8'));
  const result = await bootstrapIssueLabels({
    owner: args.owner,
    repo: args.repo,
    labels: config.labels ?? [],
    apply: Boolean(args.apply),
    token: process.env.GH_TOKEN
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

export async function bootstrapIssueLabels({ owner, repo, labels, apply, token }) {
  validateLabels(labels);

  if (!token && apply) {
    throw new Error('GH_TOKEN is required when --apply is set.');
  }

  const existing = apply ? await listLabels({ owner, repo, token }) : [];
  const byName = new Map(existing.map((label) => [label.name.toLowerCase(), label]));

  const plan = labels.map((label) => {
    const current = byName.get(label.name.toLowerCase());
    if (!current) {
      return { action: 'create', label };
    }

    const desiredColor = normalizeColor(label.color);
    const currentColor = normalizeColor(current.color);
    const desiredDescription = label.description ?? '';
    const currentDescription = current.description ?? '';

    if (desiredColor !== currentColor || desiredDescription !== currentDescription) {
      return { action: 'update', label };
    }

    return { action: 'none', label };
  });

  if (apply) {
    for (const item of plan) {
      if (item.action === 'create') {
        await createLabel({ owner, repo, token, label: item.label });
      }
      if (item.action === 'update') {
        await updateLabel({ owner, repo, token, label: item.label });
      }
    }
  }

  return {
    valid: true,
    apply,
    createCount: plan.filter((item) => item.action === 'create').length,
    updateCount: plan.filter((item) => item.action === 'update').length,
    unchangedCount: plan.filter((item) => item.action === 'none').length,
    plan
  };
}

export function validateLabels(labels) {
  if (!Array.isArray(labels) || labels.length === 0) {
    throw new Error('labels must be a non-empty array.');
  }
  for (const label of labels) {
    if (!label.name || !label.color) {
      throw new Error('Each label must include name and color.');
    }
  }
}

async function listLabels({ owner, repo, token }) {
  const response = await fetch(`${API}/repos/${owner}/${repo}/labels?per_page=100`, { headers: headers(token) });
  if (!response.ok) {
    throw new Error(`Failed to list labels: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function createLabel({ owner, repo, token, label }) {
  const response = await fetch(`${API}/repos/${owner}/${repo}/labels`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ name: label.name, color: normalizeColor(label.color), description: label.description ?? '' })
  });
  if (!response.ok) {
    throw new Error(`Failed to create label ${label.name}: ${response.status} ${await response.text()}`);
  }
}

async function updateLabel({ owner, repo, token, label }) {
  const response = await fetch(`${API}/repos/${owner}/${repo}/labels/${encodeURIComponent(label.name)}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ new_name: label.name, color: normalizeColor(label.color), description: label.description ?? '' })
  });
  if (!response.ok) {
    throw new Error(`Failed to update label ${label.name}: ${response.status} ${await response.text()}`);
  }
}

function headers(token) {
  return {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json'
  };
}

function normalizeColor(color) {
  return String(color).replace('#', '').toUpperCase();
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
