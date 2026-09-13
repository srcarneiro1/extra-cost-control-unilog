import { SignJWT, jwtVerify } from 'jose';

export interface GatewayAuthEnv {
  GATEWAY_TEST_TOKEN?: string;
  APP_SESSION_SECRET?: string;
}

export type AppProfile = 'OWNER' | 'ADMINISTRATIVO' | 'OPERACIONAL';

export type GatewayIdentity =
  | {
      mode: 'access';
      provider: 'session';
      email: string;
      subject: string;
      name?: string;
      profile?: string;
      operation?: string;
    }
  | {
      mode: 'test';
      subject: 'test-token';
    };

export interface AppSessionUser {
  email: string;
  name: string;
  profile: string;
  operation: string;
}

export const APP_SESSION_COOKIE = 'extra_cost_session';
const APP_SESSION_ISSUER = 'extra-cost-control-unilog';
const APP_SESSION_AUDIENCE = 'extra-cost-control';
const APP_SESSION_SECONDS = 8 * 60 * 60;

function isAuthorizedForTest_(request: Request, env: GatewayAuthEnv): boolean {
  const configuredToken = String(env.GATEWAY_TEST_TOKEN || '').trim();
  const providedToken = String(request.headers.get('x-gateway-test-token') || '').trim();
  return Boolean(configuredToken && providedToken && configuredToken === providedToken);
}

function getCookie_(request: Request, name: string): string {
  const cookieHeader = String(request.headers.get('cookie') || '');
  const prefix = `${name}=`;

  for (const part of cookieHeader.split(';')) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(prefix)) continue;
    return decodeURIComponent(trimmed.slice(prefix.length));
  }

  return '';
}

function sessionSecret_(env: GatewayAuthEnv): Uint8Array | null {
  const secret = String(env.APP_SESSION_SECRET || '').trim();
  if (secret.length < 32) return null;
  return new TextEncoder().encode(secret);
}

async function authorizeWithSession_(
  request: Request,
  env: GatewayAuthEnv,
): Promise<GatewayIdentity | null> {
  const token = getCookie_(request, APP_SESSION_COOKIE);
  const secret = sessionSecret_(env);
  if (!token || !secret) return null;

  try {
    const { payload } = await jwtVerify(token, secret, {
      issuer: APP_SESSION_ISSUER,
      audience: APP_SESSION_AUDIENCE,
    });

    const email = typeof payload.email === 'string'
      ? payload.email.trim().toLowerCase()
      : '';
    if (!email) return null;

    return {
      mode: 'access',
      provider: 'session',
      email,
      subject: typeof payload.sub === 'string' && payload.sub.trim()
        ? payload.sub.trim()
        : email,
      name: typeof payload.name === 'string' ? payload.name.trim() : '',
      profile: typeof payload.profile === 'string' ? payload.profile.trim().toUpperCase() : '',
      operation: typeof payload.operation === 'string' ? payload.operation.trim().toUpperCase() : '',
    };
  } catch {
    return null;
  }
}

export async function createAppSessionToken(
  env: GatewayAuthEnv,
  user: AppSessionUser,
): Promise<string> {
  const secret = sessionSecret_(env);

  if (!secret) {
    throw new Error('APP_SESSION_SECRET precisa estar configurado com pelo menos 32 caracteres.');
  }

  return new SignJWT({
    email: user.email.trim().toLowerCase(),
    name: user.name.trim(),
    profile: user.profile.trim().toUpperCase(),
    operation: user.operation.trim().toUpperCase(),
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.email.trim().toLowerCase())
    .setIssuer(APP_SESSION_ISSUER)
    .setAudience(APP_SESSION_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${APP_SESSION_SECONDS}s`)
    .sign(secret);
}

export function appSessionCookie(token: string): string {
  return [
    `${APP_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${APP_SESSION_SECONDS}`,
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ');
}

export function clearAppSessionCookie(): string {
  return [
    `${APP_SESSION_COOKIE}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ].join('; ');
}

export function identityProfile(identity: GatewayIdentity): AppProfile {
  if (identity.mode === 'test') return 'OWNER';
  const profile = String(identity.profile || '').trim().toUpperCase();
  if (profile === 'OWNER' || profile === 'ADMINISTRATIVO' || profile === 'OPERACIONAL') {
    return profile;
  }
  return 'OPERACIONAL';
}

export function identityOperation(identity: GatewayIdentity): string {
  if (identity.mode === 'test') return 'TODOS';
  return String(identity.operation || '').trim().toUpperCase();
}

export function identityEmail(identity: GatewayIdentity): string {
  return identity.mode === 'access' ? identity.email : 'TEST_TOKEN';
}

export function isOwner(identity: GatewayIdentity): boolean {
  return identityProfile(identity) === 'OWNER';
}

export function canManageCatalogs(identity: GatewayIdentity): boolean {
  const profile = identityProfile(identity);
  return profile === 'OWNER' || profile === 'ADMINISTRATIVO';
}

export function canAdministerSolicitations(identity: GatewayIdentity): boolean {
  return canManageCatalogs(identity);
}

export function operationScope(identity: GatewayIdentity): string | null {
  if (isOwner(identity)) return null;
  const operation = identityOperation(identity);
  return operation && operation !== 'TODOS' ? operation : null;
}

export function hasValidOperationScope(identity: GatewayIdentity): boolean {
  if (identityProfile(identity) !== 'OPERACIONAL') return true;
  return Boolean(operationScope(identity));
}

export async function authorizeAppSessionRequest(
  request: Request,
  env: GatewayAuthEnv,
): Promise<GatewayIdentity | null> {
  return authorizeWithSession_(request, env);
}

export async function authorizeGatewayRequest(
  request: Request,
  env: GatewayAuthEnv,
): Promise<GatewayIdentity | null> {
  if (isAuthorizedForTest_(request, env)) {
    return {
      mode: 'test',
      subject: 'test-token',
    };
  }

  return authorizeWithSession_(request, env);
}
