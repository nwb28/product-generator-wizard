import { readFile } from 'node:fs/promises';

const isCli = process.argv[1] && process.argv[1].endsWith('/check-retention-purge-slo.mjs');

if (isCli) {
  const args = parseArgs(process.argv.slice(2));
  const maxAgeHours = Number(args.maxAgeHours ?? 26);
  const nowIso = args.now ?? new Date().toISOString();

  let runsPayload;
  if (args.runsJson) {
    runsPayload = JSON.parse(await readFile(args.runsJson, 'utf8'));
  } else {
    if (!args.owner || !args.repo || !process.env.GH_TOKEN) {
      throw new Error('Provide --runs-json, or provide --owner/--repo and GH_TOKEN for live mode.');
    }
    runsPayload = await fetchRuns({ owner: args.owner, repo: args.repo, workflow: args.workflow ?? 'preview-artifact-retention.yml', token: process.env.GH_TOKEN });
  }

  const result = evaluatePurgeSlo({ runsPayload, maxAgeHours, nowIso });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

export function evaluatePurgeSlo({ runsPayload, maxAgeHours, nowIso }) {
  const now = new Date(nowIso).getTime();
  const runs = runsPayload.workflow_runs ?? [];
  const successful = runs.find((run) => run.conclusion === 'success');

  if (!successful) {
    return {
      valid: false,
      reason: 'No successful purge run found',
      maxAgeHours
    };
  }

  const completedAt = new Date(successful.updated_at ?? successful.created_at).getTime();
  const ageHours = (now - completedAt) / (1000 * 60 * 60);

  return {
    valid: ageHours <= maxAgeHours,
    maxAgeHours,
    ageHours,
    latestSuccessfulRunId: successful.id,
    latestSuccessfulRunUrl: successful.html_url
  };
}

async function fetchRuns({ owner, repo, workflow, token }) {
  const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow}/runs?per_page=20`, {
    headers: {
      accept: 'application/vnd.github+json',
      authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch workflow runs: ${response.status} ${await response.text()}`);
  }

  return response.json();
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
    } else if (token === '--workflow') {
      args.workflow = argv[i + 1];
      i += 1;
    } else if (token === '--max-age-hours') {
      args.maxAgeHours = argv[i + 1];
      i += 1;
    } else if (token === '--now') {
      args.now = argv[i + 1];
      i += 1;
    } else if (token === '--runs-json') {
      args.runsJson = argv[i + 1];
      i += 1;
    }
  }
  return args;
}
