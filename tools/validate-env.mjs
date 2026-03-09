const args = new Map(
  process.argv.slice(2).flatMap((arg) => {
    const [key, value] = arg.split('=');
    return key.startsWith('--') ? [[key.slice(2), value ?? '']] : [];
  })
);

const targetEnv = args.get('target') || process.env.NODE_ENV || 'development';

const errors = [];
const warnings = [];

if (!['development', 'test', 'staging', 'production'].includes(targetEnv)) {
  errors.push(`Unsupported target environment "${targetEnv}".`);
}

const requiredAuth = ['WIZARD_AUTH_JWT_SECRET', 'WIZARD_AUTH_JWT_ISSUER', 'WIZARD_AUTH_JWT_AUDIENCE'];
const hasStrictAuth = targetEnv === 'staging' || targetEnv === 'production';

if (hasStrictAuth) {
  for (const variable of requiredAuth) {
    if (!process.env[variable]) {
      errors.push(`Missing required variable ${variable} for ${targetEnv}.`);
    }
  }

  const secret = process.env.WIZARD_AUTH_JWT_SECRET ?? '';
  if (secret.length > 0 && secret.length < 32) {
    errors.push('WIZARD_AUTH_JWT_SECRET must be at least 32 characters for staging/production.');
  }

  if (secret === 'local-dev-auth-secret-change-me') {
    errors.push('WIZARD_AUTH_JWT_SECRET must not use the development default for staging/production.');
  }
}

for (const numeric of ['WIZARD_RATE_LIMIT_MAX_PER_MINUTE', 'WIZARD_IDEMPOTENCY_TTL_MS']) {
  const raw = process.env[numeric];
  if (!raw) {
    continue;
  }
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    errors.push(`${numeric} must be a positive integer when provided.`);
  }
}

if (targetEnv !== 'development' && targetEnv !== 'test') {
  warnings.push('Ensure secrets are sourced from Key Vault or encrypted GitHub environment secrets.');
}

if (errors.length > 0) {
  process.stderr.write(`Environment validation failed for ${targetEnv}:\n- ${errors.join('\n- ')}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`Environment validation passed for ${targetEnv}.\n`);
}

if (warnings.length > 0) {
  process.stdout.write(`Warnings:\n- ${warnings.join('\n- ')}\n`);
}
