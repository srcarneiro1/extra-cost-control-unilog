import { authorizeGatewayRequest, type GatewayAuthEnv } from '../../_auth';

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
  const identity = await authorizeGatewayRequest(request, env);

  if (!identity) {
    return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessão não autenticada.' } }, 401);
  }

  if (identity.mode === 'test') {
    return jsonResponse({
      ok: true,
      data: {
        email: 'test-token',
        name: 'Teste do gateway',
        profile: 'OWNER',
        operation: '',
        provider: 'test',
      },
    });
  }

  return jsonResponse({
    ok: true,
    data: {
      email: identity.email,
      name: identity.name || identity.email,
      profile: identity.profile || 'ADMINISTRATIVO',
      operation: identity.operation || '',
      provider: identity.provider,
    },
  });
};
