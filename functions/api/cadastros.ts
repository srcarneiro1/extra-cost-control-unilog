import {
  authorizeGatewayRequest,
  identityProfile,
  operationScope,
  type GatewayAuthEnv,
  type GatewayIdentity,
} from '../_auth';
import { validateAreaAccess } from '../_access-control';

interface Env extends GatewayAuthEnv {
  APPS_SCRIPT_URL: string;
  APPS_SCRIPT_GATEWAY_TOKEN: string;
}

const EDGE_CACHE_SECONDS = 300;

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  });
}

function edgeCache_(): Cache | null {
  if (typeof caches === 'undefined') return null;
  return (caches as unknown as { default?: Cache }).default || null;
}

function scopedCacheKey_(request: Request, identity: GatewayIdentity): Request {
  const cacheUrl = new URL(request.url);
  cacheUrl.searchParams.set('_profile', identityProfile(identity));
  cacheUrl.searchParams.set('_scope', operationScope(identity) || 'TODOS');
  return new Request(cacheUrl.toString(), { method: 'GET' });
}

function clientResponse_(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('cache-control', 'no-store');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function matchEdgeCache_(request: Request, identity: GatewayIdentity): Promise<Response | null> {
  const cache = edgeCache_();
  if (!cache) return null;
  try {
    const cached = await cache.match(scopedCacheKey_(request, identity));
    return cached ? clientResponse_(cached) : null;
  } catch {
    return null;
  }
}

function cacheSuccessfulResponse_(
  context: EventContext<Env, string, unknown>,
  request: Request,
  identity: GatewayIdentity,
  response: Response,
): void {
  if (response.status !== 200) return;
  const cache = edgeCache_();
  if (!cache) return;

  const headers = new Headers(response.headers);
  headers.set('cache-control', `public, max-age=${EDGE_CACHE_SECONDS}`);
  const cachedResponse = new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });

  try {
    context.waitUntil(cache.put(scopedCacheKey_(request, identity), cachedResponse).catch(() => undefined));
  } catch {
    // Cache de borda é apenas otimização.
  }
}

async function proxyCatalogRequest(
  env: Env,
  servicePayload: Record<string, unknown>,
): Promise<Response> {
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
  const { request, env } = context;
  const identity = await authorizeGatewayRequest(request, env);

  if (!identity) {
    return jsonResponse(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessão da plataforma não autenticada.' } },
      401,
    );
  }

  const url = new URL(request.url);
  const adminMode = url.searchParams.get('mode') === 'admin';
  if (adminMode) {
    const denied = validateAreaAccess(identity, 'CADASTROS');
    if (denied) return denied;
  }

  const cached = await matchEdgeCache_(request, identity);
  if (cached) return cached;

  const scope = optionalParam(url, 'scope').toUpperCase();
  const pagina = optionalParam(url, 'pagina');
  const tamanhoPagina = optionalParam(url, 'tamanhoPagina');
  const busca = optionalParam(url, 'busca');

  const payload = adminMode
    ? scope
      ? {
          modo: 'ADMIN_SCOPE',
          escopo: scope,
          ...(pagina ? { pagina } : {}),
          ...(tamanhoPagina ? { tamanhoPagina } : {}),
          ...(busca ? { busca } : {}),
        }
      : { modo: 'ADMIN' }
    : {};

  const response = await proxyCatalogRequest(env, payload);
  cacheSuccessfulResponse_(context, request, identity, response);
  return response;
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

  const identity = await authorizeGatewayRequest(context.request, context.env);
  if (!identity) {
    return jsonResponse(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessão da plataforma não autenticada.' } },
      401,
    );
  }

  const denied = validateAreaAccess(identity, 'CADASTROS');
  if (denied) return denied;

  return proxyCatalogRequest(context.env, payload);
};
