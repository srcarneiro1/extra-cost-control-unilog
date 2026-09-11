import { authorizeAppSessionRequest, type GatewayAuthEnv } from '../../_auth';

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

export const onRequestGet: PagesFunction<GatewayAuthEnv> = async ({ request, env }) => {
  const identity = await authorizeAppSessionRequest(request, env);

  if (!identity || identity.mode !== 'access' || identity.provider !== 'session') {
    return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessão da plataforma não autenticada.' } }, 401);
  }

  return jsonResponse({
    ok: true,
    data: {
      email: identity.email,
      name: identity.name || identity.email,
      profile: identity.profile || 'OPERACIONAL',
      operation: identity.operation || '',
      provider: 'session',
    },
  });
};
