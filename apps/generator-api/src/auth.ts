import type express from 'express';
import { jwtVerify, SignJWT } from 'jose';

export type WizardPrincipal = {
  sub: string;
  roles: string[];
};

const encoder = new TextEncoder();

export async function authenticatePrincipal(req: express.Request): Promise<WizardPrincipal | null> {
  const authHeader = req.header('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice('Bearer '.length);
  const secret = getAuthSecret();

  try {
    const verified = await jwtVerify(token, encoder.encode(secret), {
      algorithms: ['HS256'],
      issuer: 'product-generator-wizard',
      audience: 'wizard-api'
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
  const secret = getAuthSecret();

  return await new SignJWT({ roles })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(sub)
    .setIssuer('product-generator-wizard')
    .setAudience('wizard-api')
    .setExpirationTime('1h')
    .sign(encoder.encode(secret));
}

function getAuthSecret(): string {
  return process.env.WIZARD_AUTH_JWT_SECRET ?? 'local-dev-auth-secret-change-me';
}
