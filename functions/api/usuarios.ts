import { authorizeGatewayRequest, type GatewayAuthEnv } from '../_auth';
import { validateAreaAccess } from '../_access-control';

interface Env extends GatewayAuthEnv {
  APPS_SCRIPT_URL: string;
  APPS_SCRIPT_GATEWAY_TOKEN: string;
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

async function proxy(
  env: Env,
  payload: Record<string, unknown>,
): Promise<Response> {
  if (!env.APPS_SCRIPT_URL || !env.APPS_SCRIPT_GATEWAY_TOKEN) {
    return jsonResponse(
      { ok: false, error: { code: 'GATEWAY_CONFIG_ERROR', message: 'Gateway não configurado no ambiente Cloudflare.' } },
      500,
    );
  }

  const targetUrl = new URL(env.APPS_SCRIPT_URL);
  targetUrl.searchParams.set('route', 'usuarios');

  const upstreamResponse = await fetch(targetUrl.toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...payload, _gatewayToken: env.APPS_SCRIPT_GATEWAY_TOKEN }),
    redirect: 'follow',
  });

  const text = await upstreamResponse.text();
  let upstream: unknown;

  try {
    upstream = JSON.parse(text);
  } catch {
    return jsonResponse(
      { ok: false, error: { code: 'UPSTREAM_INVALID_RESPONSE', message: 'Apps Script retornou uma resposta inválida.' } },
      502,
    );
  }

  const ok = typeof upstream === 'object' && upstream !== null && 'ok' in upstream && (upstream as { ok?: unknown }).ok === true;
  return jsonResponse(upstream, ok ? 200 : upstreamResponse.ok ? 400 : 502);
}

async function authorize(request: Request, env: Env) {
  const identity = await authorizeGatewayRequest(request, env);
  if (!identity) {
    return { response: jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessão da plataforma não autenticada.' } }, 401) };
  }

  const denied = validateAreaAccess(identity, 'USUARIOS');
  if (denied) return { response: denied };
  return { identity };
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await authorize(request, env);
  if ('response' in auth) return auth.response;
  return proxy(env, { acao: 'LISTAR' });
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const auth = await authorize(request, env);
  if ('response' in auth) return auth.response;

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse({ ok: false, error: { code: 'INVALID_JSON', message: 'Corpo JSON inválido.' } }, 400);
  }

  return proxy(env, payload);
};
