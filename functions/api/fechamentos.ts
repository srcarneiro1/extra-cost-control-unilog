import {
  authorizeGatewayRequest,
  identityEmail,
  type GatewayAuthEnv,
  type GatewayIdentity,
} from '../_auth';
import { validateAdministrativeAction } from '../_access-control';

interface Env extends GatewayAuthEnv {
  APPS_SCRIPT_URL: string;
  APPS_SCRIPT_GATEWAY_TOKEN: string;
}

const READ_EDGE_CACHE_SECONDS = 30;
const CLOSEOUT_MUTATION_ACTIONS = new Set(['FECHAR', 'SALVAR_NF', 'CONCILIAR', 'ENCERRAR']);
const EXCEPTION_MUTATION_ACTIONS = new Set(['DECIDIR']);

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
  const url = new URL(request.url);
  url.searchParams.set('_financial', '1');
  url.searchParams.set('_subject', identityEmail(identity));
  return new Request(url.toString(), { method: 'GET' });
}

async function matchEdgeCache_(request: Request, identity: GatewayIdentity): Promise<Response | null> {
  const cache = edgeCache_();
  if (!cache) return null;
  try {
    const cached = await cache.match(scopedCacheKey_(request, identity));
    if (!cached) return null;
    const headers = new Headers(cached.headers);
    headers.set('cache-control', 'no-store');
    return new Response(cached.body, { status: cached.status, statusText: cached.statusText, headers });
  } catch {
    return null;
  }
}

function cacheSuccessful_(
  context: EventContext<Env, string, unknown>,
  request: Request,
  identity: GatewayIdentity,
  response: Response,
): void {
  if (response.status !== 200) return;
  const cache = edgeCache_();
  if (!cache) return;
  const headers = new Headers(response.headers);
  headers.set('cache-control', `public, max-age=${READ_EDGE_CACHE_SECONDS}`);
  const copy = new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
  try {
    context.waitUntil(cache.put(scopedCacheKey_(request, identity), copy).catch(() => undefined));
  } catch {
    // Cache é apenas otimização.
  }
}

async function proxyToAppsScript(
  env: Env,
  payload: Record<string, unknown>,
  route = 'fechamentos',
): Promise<Response> {
  if (!env.APPS_SCRIPT_URL || !env.APPS_SCRIPT_GATEWAY_TOKEN) {
    return jsonResponse(
      { ok: false, error: { code: 'GATEWAY_CONFIG_ERROR', message: 'Gateway não configurado no ambiente Cloudflare.' } },
      500,
    );
  }

  const targetUrl = new URL(env.APPS_SCRIPT_URL);
  targetUrl.searchParams.set('route', route);

  const upstreamResponse = await fetch(targetUrl.toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...payload, _gatewayToken: env.APPS_SCRIPT_GATEWAY_TOKEN }),
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

async function authorizeAdministrative_(request: Request, env: Env) {
  const identity = await authorizeGatewayRequest(request, env);
  if (!identity) {
    return {
      identity: null,
      denied: jsonResponse(
        { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessão da plataforma não autenticada.' } },
        401,
      ),
    };
  }
  const denied = validateAdministrativeAction(identity);
  return { identity, denied };
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const { identity, denied } = await authorizeAdministrative_(request, env);
  if (denied || !identity) return denied!;

  const cached = await matchEdgeCache_(request, identity);
  if (cached) return cached;

  const url = new URL(request.url);
  const competencia = String(url.searchParams.get('competencia') || '').trim();
  const metadata = String(url.searchParams.get('metadata') || '').trim() === '1';
  const exceptions = String(url.searchParams.get('excecoes') || '').trim() === '1';
  const fornecedor = String(url.searchParams.get('fornecedor') || '').trim();

  const response = exceptions
    ? await proxyToAppsScript(env, {
        acao: 'LISTAR',
        ...(competencia ? { competencia } : {}),
        ...(fornecedor ? { fornecedor } : {}),
      }, 'excecoes_financeiras')
    : await proxyToAppsScript(env, metadata
      ? { acao: 'METADADOS' }
      : { acao: 'LISTAR', competencia });

  cacheSuccessful_(context, request, identity, response);
  return response;
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const { identity, denied } = await authorizeAdministrative_(request, env);
  if (denied || !identity) return denied!;

  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(
      { ok: false, error: { code: 'INVALID_JSON', message: 'Corpo JSON inválido.' } },
      400,
    );
  }

  const action = String(payload.acao || 'FECHAR').trim().toUpperCase();
  const isException = EXCEPTION_MUTATION_ACTIONS.has(action);
  if (!isException && !CLOSEOUT_MUTATION_ACTIONS.has(action)) {
    return jsonResponse(
      { ok: false, error: { code: 'INVALID_ACTION', message: 'Ação financeira inválida.' } },
      400,
    );
  }

  return proxyToAppsScript(env, {
    ...payload,
    acao: action,
    usuarioAdministrativo: identityEmail(identity),
  }, isException ? 'excecoes_financeiras' : 'fechamentos');
};
