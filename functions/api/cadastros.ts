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

async function proxyCatalogRequest(
  request: Request,
  env: Env,
  servicePayload: Record<string, unknown>,
  administrative: boolean,
): Promise<Response> {
  const identity = await authorizeGatewayRequest(request, env);

  if (!identity) {
    return jsonResponse(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessão da plataforma não autenticada.' } },
      401,
    );
  }

  if (administrative) {
    const denied = validateAreaAccess(identity, 'CADASTROS');
    if (denied) return denied;
  }

  if (!env.APPS_SCRIPT_URL || !env.APPS_SCRIPT_GATEWAY_TOKEN) {
    return jsonResponse(
      { ok: false, error: { code: 'GATEWAY_CONFIG_ERROR', message: 'Gateway não configurado no ambiente Cloudflare.' } },
      500,
    );
  }

  const targetUrl = new URL(env.APPS_SCRIPT_URL);
  targetUrl.searchParams.set('route', 'cadastros');

  const upstreamResponse = await fetch(targetUrl.toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...servicePayload,
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
      { ok: false, error: { code: 'UPSTREAM_INVALID_RESPONSE', message: 'Apps Script retornou uma resposta inválida.' } },
      502,
    );
  }

  const apiSucceeded =
    typeof upstreamPayload === 'object' &&
    upstreamPayload !== null &&
    'ok' in upstreamPayload &&
    (upstreamPayload as { ok?: unknown }).ok === true;

  return jsonResponse(upstreamPayload, apiSucceeded ? 200 : upstreamResponse.ok ? 400 : 502);
}

function optionalParam(url: URL, name: string): string {
  return String(url.searchParams.get(name) || '').trim();
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const adminMode = url.searchParams.get('mode') === 'admin';
  const scope = optionalParam(url, 'scope').toUpperCase();
  const pagina = optionalParam(url, 'pagina');
  const tamanhoPagina = optionalParam(url, 'tamanhoPagina');
  const busca = optionalParam(url, 'busca');

  return proxyCatalogRequest(
    context.request,
    context.env,
    adminMode
      ? scope
        ? {
            modo: 'ADMIN_SCOPE',
            escopo: scope,
            ...(pagina ? { pagina } : {}),
            ...(tamanhoPagina ? { tamanhoPagina } : {}),
            ...(busca ? { busca } : {}),
          }
        : { modo: 'ADMIN' }
      : {},
    adminMode,
  );
};

export const onRequestPost: PagesFunction<Env> = async (context) => {
  let payload: Record<string, unknown>;

  try {
    const parsed = await context.request.json();
    payload = typeof parsed === 'object' && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return jsonResponse(
      { ok: false, error: { code: 'INVALID_JSON', message: 'Corpo JSON inválido.' } },
      400,
    );
  }

  return proxyCatalogRequest(context.request, context.env, payload, true);
};
