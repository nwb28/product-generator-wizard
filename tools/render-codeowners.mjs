import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const isCli = process.argv[1] && process.argv[1].endsWith('/render-codeowners.mjs');

if (isCli) {
  const args = parseArgs(process.argv.slice(2));
  const result = await renderCodeowners({
    templatePath: args.template ?? '.github/CODEOWNERS.template',
    rolesPath: args.roles ?? 'config/codeowners-roles.json',
    outPath: args.out ?? '.github/CODEOWNERS',
    check: args.check ?? false
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.valid) {
    process.exitCode = 1;
  }
}

export async function renderCodeowners({ templatePath, rolesPath, outPath, check }) {
  const resolvedTemplate = resolve(process.cwd(), templatePath);
  const resolvedRoles = resolve(process.cwd(), rolesPath);
  const resolvedOut = resolve(process.cwd(), outPath);

  const template = await readFile(resolvedTemplate, 'utf8');
  const rolesPayload = JSON.parse(await readFile(resolvedRoles, 'utf8'));
  const roles = rolesPayload.roles ?? {};

  const unresolved = [];
  const rendered = template.replace(/\{\{([a-zA-Z0-9_]+)\}\}/g, (_, key) => {
    const value = roles[key];
    if (!value) {
      unresolved.push(key);
      return `{{${key}}}`;
    }
    return value;
  });

  if (unresolved.length > 0) {
    return { valid: false, reason: 'Unresolved role aliases found', unresolved };
  }

  if (check) {
    const existing = await readFile(resolvedOut, 'utf8').catch(() => '');
    const valid = existing === rendered;
    return { valid, check: true, outPath: outPath, changed: !valid };
  }

  await writeFile(resolvedOut, rendered, 'utf8');
  return { valid: true, check: false, outPath: outPath };
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--template') {
      args.template = argv[i + 1];
      i += 1;
    } else if (token === '--roles') {
      args.roles = argv[i + 1];
      i += 1;
    } else if (token === '--out') {
      args.out = argv[i + 1];
      i += 1;
    } else if (token === '--check') {
      args.check = true;
    }
  }
  return args;
}
