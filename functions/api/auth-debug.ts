import { decodeJwt } from 'jose';
import { authorizeGatewayRequest, type GatewayAuthEnv } from '../_auth';

interface Env extends GatewayAuthEnv {}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const token = String(request.headers.get('cf-access-jwt-assertion') || '').trim();
  const cookie = String(request.headers.get('cookie') || '');

  let decoded: Record<string, unknown> | null = null;
  let decodeError = '';

  if (token) {
    try {
      decoded = decodeJwt(token) as Record<string, unknown>;
    } catch (error) {
      decodeError = error instanceof Error ? error.message : 'Falha ao decodificar JWT.';
    }
  }

  const identity = await authorizeGatewayRequest(request, env);

  return jsonResponse({
    accessHeaderPresent: Boolean(token),
    authorizationCookiePresent: /(?:^|;\s*)CF_Authorization=/.test(cookie),
    teamDomainConfigured: Boolean(String(env.CLOUDFLARE_ACCESS_TEAM_DOMAIN || '').trim()),
    audienceConfigured: Boolean(String(env.CLOUDFLARE_ACCESS_AUD || '').trim()),
    configuredTeamDomain: String(env.CLOUDFLARE_ACCESS_TEAM_DOMAIN || '').trim(),
    decodedIssuer: decoded?.iss || null,
    decodedAudience: decoded?.aud || null,
    decodedEmailPresent: Boolean(decoded?.email),
    decodeError: decodeError || null,
    authorized: Boolean(identity),
    authorizationMode: identity?.mode || null,
  });
};
