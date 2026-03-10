import fs from "node:fs";
import path from "node:path";
import YAML from "yaml";

function extractRunCommands(workflowContent) {
  const commands = [];
  const workflow = YAML.parse(workflowContent);
  if (!workflow || typeof workflow !== "object") {
    return commands;
  }

  function visit(node) {
    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item);
      }
      return;
    }

    if (!node || typeof node !== "object") {
      return;
    }

    for (const [key, value] of Object.entries(node)) {
      if (key === "run" && typeof value === "string") {
        commands.push(value);
        continue;
      }
      visit(value);
    }
  }

  visit(workflow);

  return commands;
}

function extractNodeToolReferences(command) {
  const references = [];
  const regex = /\bnode\s+(['"]?)(tools\/[^\s'"`;|&]+)\1/gu;
  let match = regex.exec(command);
  while (match) {
    references.push(match[2]);
    match = regex.exec(command);
  }
  return references;
}

function extractNpmRunReferences(command) {
  const references = [];
  const regex = /\bnpm\s+run\s+([A-Za-z0-9:_-]+)/gu;
  let match = regex.exec(command);
  while (match) {
    references.push(match[1]);
    match = regex.exec(command);
  }
  return references;
}

function findWorkflowFiles(workflowsDirectory) {
  return fs
    .readdirSync(workflowsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && /\.ya?ml$/u.test(entry.name))
    .map((entry) => path.join(workflowsDirectory, entry.name))
    .sort();
}

function verifyWorkflowCommandReferences({
  repositoryRoot,
  workflowsDirectory = path.join(repositoryRoot, ".github", "workflows"),
  packageJsonPath = path.join(repositoryRoot, "package.json")
}) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const scripts = new Set(Object.keys(packageJson.scripts || {}));
  const workflowFiles = findWorkflowFiles(workflowsDirectory);

  const missingToolPaths = [];
  const missingScripts = [];

  for (const workflowFile of workflowFiles) {
    const content = fs.readFileSync(workflowFile, "utf8");
    const commands = extractRunCommands(content);

    for (const command of commands) {
      for (const toolPath of extractNodeToolReferences(command)) {
        if (toolPath.includes("/dist/")) {
          continue;
        }
        const absoluteToolPath = path.join(repositoryRoot, toolPath);
        if (!fs.existsSync(absoluteToolPath)) {
          missingToolPaths.push({ workflowFile, toolPath });
        }
      }

      for (const scriptName of extractNpmRunReferences(command)) {
        if (!scripts.has(scriptName)) {
          missingScripts.push({ workflowFile, scriptName });
        }
      }
    }
  }

  return { missingToolPaths, missingScripts, workflowFiles };
}

function parseFlagValue(flag, fallback) {
  const flagIndex = process.argv.indexOf(flag);
  if (flagIndex === -1) {
    return fallback;
  }
  return process.argv[flagIndex + 1] || fallback;
}

function main() {
  const repositoryRoot = process.cwd();
  const workflowsDirectory = parseFlagValue("--workflows", path.join(repositoryRoot, ".github", "workflows"));
  const packageJsonPath = parseFlagValue("--package", path.join(repositoryRoot, "package.json"));

  const result = verifyWorkflowCommandReferences({
    repositoryRoot,
    workflowsDirectory,
    packageJsonPath
  });

  if (result.workflowFiles.length === 0) {
    throw new Error(`No workflow files found in ${workflowsDirectory}`);
  }

  if (result.missingToolPaths.length === 0 && result.missingScripts.length === 0) {
    process.stdout.write(
      `Workflow command references verified across ${result.workflowFiles.length} workflow files.\n`
    );
    return;
  }

  for (const item of result.missingToolPaths) {
    process.stderr.write(
      `Missing workflow tool path: ${item.toolPath} (workflow: ${path.relative(repositoryRoot, item.workflowFile)})\n`
    );
  }

  for (const item of result.missingScripts) {
    process.stderr.write(
      `Missing npm script reference: ${item.scriptName} (workflow: ${path.relative(repositoryRoot, item.workflowFile)})\n`
    );
  }

  throw new Error("Workflow command reference verification failed.");
}

export {
  extractNpmRunReferences,
  extractNodeToolReferences,
  extractRunCommands,
  verifyWorkflowCommandReferences
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
