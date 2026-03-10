import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const DEFAULTS = {
  branch: "main",
  labelConfig: "config/issue-labels.json",
  environmentConfig: "config/environment-protection.json",
  branchProtectionBaseline: "config/branch-protection-baseline.json"
};

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--owner") {
      args.owner = argv[index + 1];
      index += 1;
    } else if (token === "--repo") {
      args.repo = argv[index + 1];
      index += 1;
    } else if (token === "--branch") {
      args.branch = argv[index + 1];
      index += 1;
    } else if (token === "--config") {
      args.config = argv[index + 1];
      index += 1;
    } else if (token === "--apply") {
      args.apply = true;
    }
  }
  return args;
}

function loadConfig(configPath) {
  if (!configPath) {
    return {};
  }
  const absolutePath = path.resolve(process.cwd(), configPath);
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
}

function quote(value) {
  return JSON.stringify(String(value));
}

export function buildBootstrapCommands(options) {
  const merged = { ...DEFAULTS, ...options };
  const { owner, repo, branch, labelConfig, environmentConfig, branchProtectionBaseline, apply } = merged;

  if (!owner || !repo) {
    throw new Error("owner and repo are required.");
  }

  const commands = [];
  commands.push(
    [
      "node tools/bootstrap-issue-labels.mjs",
      `--owner ${quote(owner)}`,
      `--repo ${quote(repo)}`,
      `--config ${quote(labelConfig)}`,
      apply ? "--apply" : ""
    ]
      .filter(Boolean)
      .join(" ")
  );

  commands.push(
    [
      "node tools/apply-environment-protection.mjs",
      `--owner ${quote(owner)}`,
      `--repo ${quote(repo)}`,
      `--config ${quote(environmentConfig)}`,
      apply ? "--apply" : ""
    ]
      .filter(Boolean)
      .join(" ")
  );

  commands.push(
    [
      "node tools/apply-branch-protection-baseline.mjs",
      `--owner ${quote(owner)}`,
      `--repo ${quote(repo)}`,
      `--branch ${quote(branch)}`,
      `--baseline ${quote(branchProtectionBaseline)}`,
      apply ? "" : "--dry-run"
    ]
      .filter(Boolean)
      .join(" ")
  );

  return commands;
}

function runCommands(commands) {
  for (const command of commands) {
    process.stdout.write(`[bootstrap] ${command}\n`);
    execSync(command, { stdio: "inherit" });
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.config);
  const merged = {
    ...config,
    ...args
  };

  const commands = buildBootstrapCommands(merged);
  runCommands(commands);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
