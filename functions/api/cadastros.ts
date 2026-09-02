interface Env {
  APPS_SCRIPT_URL: string;
  APPS_SCRIPT_GATEWAY_TOKEN: string;
  GATEWAY_TEST_TOKEN: string;
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function isAuthorizedForTest(request: Request, env: Env): boolean {
  const configuredToken = String(env.GATEWAY_TEST_TOKEN || '').trim();
  const providedToken = String(request.headers.get('x-gateway-test-token') || '').trim();

  return Boolean(configuredToken && providedToken && configuredToken === providedToken);
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  if (!isAuthorizedForTest(request, env)) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Acesso temporário ao gateway não autorizado.',
        },
      },
      401
    );
  }

  if (!env.APPS_SCRIPT_URL || !env.APPS_SCRIPT_GATEWAY_TOKEN) {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: 'GATEWAY_CONFIG_ERROR',
          message: 'Gateway não configurado no ambiente Cloudflare.',
        },
      },
      500
    );
  }

  const targetUrl = new URL(env.APPS_SCRIPT_URL);
  targetUrl.searchParams.set('route', 'cadastros');

  const upstreamResponse = await fetch(targetUrl.toString(), {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      _gatewayToken: env.APPS_SCRIPT_GATEWAY_TOKEN,
    }),
    redirect: 'follow',
  });

  const upstreamText = await upstreamResponse.text();

  let upstreamPayload: unknown;
  try {
    upstreamPayload = JSON.parse(upstreamText);
  } catch {
    return jsonResponse(
      {
        ok: false,
        error: {
          code: 'UPSTREAM_INVALID_RESPONSE',
          message: 'Apps Script retornou uma resposta inválida.',
        },
      },
      502
    );
  }

  const apiSucceeded =
    typeof upstreamPayload === 'object' &&
    upstreamPayload !== null &&
    'ok' in upstreamPayload &&
    (upstreamPayload as { ok?: unknown }).ok === true;

  return jsonResponse(
    upstreamPayload,
    apiSucceeded ? 200 : upstreamResponse.ok ? 400 : 502
  );
};
