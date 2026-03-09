import type express from 'express';
import { jwtVerify, SignJWT } from 'jose';

export type WizardPrincipal = {
  sub: string;
  roles: string[];
};

type AuthConfig = {
  secret: string;
  issuer: string;
  audience: string;
};

const encoder = new TextEncoder();

export async function authenticatePrincipal(req: express.Request): Promise<WizardPrincipal | null> {
  const authHeader = req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length);
  const config = getAuthConfig();

  try {
    const verified = await jwtVerify(token, encoder.encode(config.secret), {
      algorithms: ['HS256'],
      issuer: config.issuer,
      audience: config.audience
    });

    const payload = verified.payload;
    const roleClaim = payload.roles;
    const roles = Array.isArray(roleClaim)
      ? roleClaim.filter((x): x is string => typeof x === 'string')
      : typeof payload.role === 'string'
        ? [payload.role]
        : [];

    if (!payload.sub || roles.length === 0) {
      return null;
    }

    return {
      sub: String(payload.sub),
      roles
    };
  } catch {
    return null;
  }
}

export function hasWizardAccess(principal: WizardPrincipal | null): boolean {
  if (!principal) {
    return false;
  }

  return principal.roles.includes('wizard-admin') || principal.roles.includes('product-generator');
}

export async function signTestToken(sub: string, roles: string[]): Promise<string> {
  const config = getAuthConfig();

  return await new SignJWT({ roles })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setExpirationTime('1h')
    .sign(encoder.encode(config.secret));
}

export function getAuthConfig(env: NodeJS.ProcessEnv = process.env): AuthConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';

  const secret = env.WIZARD_AUTH_JWT_SECRET ?? 'local-dev-auth-secret-change-me';
  const issuer = env.WIZARD_AUTH_JWT_ISSUER ?? 'product-generator-wizard';
  const audience = env.WIZARD_AUTH_JWT_AUDIENCE ?? 'wizard-api';

  const usingDefaults =
    secret === 'local-dev-auth-secret-change-me' ||
    issuer === 'product-generator-wizard' ||
    audience === 'wizard-api';

  if (!['development', 'test'].includes(nodeEnv) && usingDefaults) {
    throw new Error(
      'Auth configuration must set WIZARD_AUTH_JWT_SECRET, WIZARD_AUTH_JWT_ISSUER, and WIZARD_AUTH_JWT_AUDIENCE outside development/test.'
    );
  }

  return { secret, issuer, audience };
}
