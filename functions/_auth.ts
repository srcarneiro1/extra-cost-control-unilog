import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface GatewayAuthEnv {
  GATEWAY_TEST_TOKEN?: string;
  CLOUDFLARE_ACCESS_TEAM_DOMAIN?: string;
  CLOUDFLARE_ACCESS_AUD?: string;
}

export type GatewayIdentity =
  | {
      mode: 'access';
      email: string;
      subject: string;
    }
  | {
      mode: 'test';
      subject: 'test-token';
    };

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
      email,
      subject: typeof payload.sub === 'string' && payload.sub.trim()
        ? payload.sub.trim()
        : email,
    };
  } catch {
    return null;
  }
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

  return authorizeWithAccess_(request, env);
}
