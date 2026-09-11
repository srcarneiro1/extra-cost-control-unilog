import { SignJWT, createRemoteJWKSet, jwtVerify } from 'jose';

export interface GatewayAuthEnv {
  GATEWAY_TEST_TOKEN?: string;
  CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string;
  CLOUDFLARE_ACCESS_AUD?: string;
  APP_SESSION_SECRET?: string;
}

export type GatewayIdentity =
  | {
      mode: 'access';
      provider: 'session' | 'cloudflare';
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

const jwksByDomain = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function normalizeTeamDomain_(value: unknown): string {
  const normalized = String(value || '')
    .trim()
    .replace(/\/+$/, '');

  if (!normalized) return '';

  return /^https?:\/\//i.test(normalized)
    ? normalized
    : `https://${normalized}`;
}

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

function getJwks_(teamDomain: string): ReturnType<typeof createRemoteJWKSet> {
  const cached = jwksByDomain.get(teamDomain);
  if (cached) return cached;

  const jwks = createRemoteJWKSet(
    new URL(`${teamDomain}/cdn-cgi/access/certs`)
  );

  jwksByDomain.set(teamDomain, jwks);
  return jwks;
}

async function authorizeWithAccess_(
  request: Request,
  env: GatewayAuthEnv
): Promise<GatewayIdentity | null> {
  const token = String(request.headers.get('cf-access-jwt-assertion') || '').trim();
  if (!token) return null;

  const teamDomain = normalizeTeamDomain_(env.CLOUDFLARE_ACCESS_TEAM_DOMAIN);
  const audience = String(env.CLOUDFLARE_ACCESS_AUD || '').trim();

  if (!teamDomain || !audience) return null;

  try {
    const { payload } = await jwtVerify(token, getJwks_(teamDomain), {
      issuer: teamDomain,
      audience,
    });

    const email = typeof payload.email === 'string'
      ? payload.email.trim().toLowerCase()
      : '';

    if (!email) return null;

    return {
      mode: 'access',
      provider: 'cloudflare',
      email,
      subject: typeof payload.sub === 'string' && payload.sub.trim()
        ? payload.sub.trim()
        : email,
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

export async function authorizeAppSessionRequest(
  request: Request,
  env: GatewayAuthEnv,
): Promise<GatewayIdentity | null> {
  return authorizeWithSession_(request, env);
}

export async function authorizeGatewayRequest(
  request: Request,
  env: GatewayAuthEnv
): Promise<GatewayIdentity | null> {
  if (isAuthorizedForTest_(request, env)) {
    return {
      mode: 'test',
      subject: 'test-token',
    };
  }

  const sessionIdentity = await authorizeWithSession_(request, env);
  if (sessionIdentity) return sessionIdentity;

  return authorizeWithAccess_(request, env);
}
