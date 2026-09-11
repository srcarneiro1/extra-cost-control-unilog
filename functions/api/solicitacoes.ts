import {
  authorizeGatewayRequest,
  identityEmail,
  type GatewayAuthEnv,
} from '../_auth';
import {
  enforceCreationScope,
  enforceOperationScope,
  validateAreaAccess,
} from '../_access-control';

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

async function proxyToAppsScript(
  env: Env,
  route: string,
  payload: Record<string, unknown>
): Promise<Response> {
  if (!env.APPS_SCRIPT_URL || !env.APPS_SCRIPT_GATEWAY_TOKEN) {
    return jsonResponse(
      { ok: false, error: { code: 'GATEWAY_CONFIG_ERROR', message: 'Gateway não configurado no ambiente Cloudflare.' } },
      500
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
      502
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

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const identity = await authorizeGatewayRequest(request, env);

  if (!identity) {
    return jsonResponse(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessão da plataforma não autenticada.' } },
      401
    );
  }

  const denied = validateAreaAccess(identity, 'SOLICITACOES');
  if (denied) return denied;

  const url = new URL(request.url);
  const idSolicitacao = optionalParam(url, 'id');
  const metadata = optionalParam(url, 'metadata');

  let payload: Record<string, unknown>;

  if (idSolicitacao) {
    payload = { acao: 'DETALHAR', idSolicitacao };
  } else if (metadata === '1') {
    payload = { acao: 'METADADOS' };
  } else {
    const pagina = optionalParam(url, 'pagina');
    const tamanhoPagina = optionalParam(url, 'tamanhoPagina') || optionalParam(url, 'limite');
    const busca = optionalParam(url, 'busca');
    const tipo = optionalParam(url, 'tipo');
    const status = optionalParam(url, 'status');
    const anoRegistro = optionalParam(url, 'anoRegistro');
    const mesRegistro = optionalParam(url, 'mesRegistro');
    const dataRegistro = optionalParam(url, 'dataRegistro');

    payload = {
      acao: 'LISTAR',
      ...(pagina ? { pagina } : {}),
      ...(tamanhoPagina ? { tamanhoPagina } : {}),
      ...(busca ? { busca } : {}),
      ...(tipo ? { tipo } : {}),
      ...(status ? { status } : {}),
      ...(anoRegistro ? { anoRegistro } : {}),
      ...(mesRegistro ? { mesRegistro } : {}),
      ...(dataRegistro ? { dataRegistro } : {}),
    };
  }

  return proxyToAppsScript(env, 'solicitacoes_admin', enforceOperationScope(identity, payload));
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const identity = await authorizeGatewayRequest(request, env);

  if (!identity) {
    return jsonResponse(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessão da plataforma não autenticada.' } },
      401
    );
  }

  const denied = validateAreaAccess(identity, 'SOLICITACOES');
  if (denied) return denied;

  let payload: Record<string, unknown>;

  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return jsonResponse(
      { ok: false, error: { code: 'INVALID_JSON', message: 'Corpo JSON inválido.' } },
      400
    );
  }

  const url = new URL(request.url);
  const adminRead = optionalParam(url, 'admin') === '1';

  if (adminRead) {
    return proxyToAppsScript(env, 'solicitacoes_admin', enforceOperationScope(identity, payload));
  }

  const trustedPayload = enforceCreationScope(identity, {
    ...payload,
    usuarioCriacao: identityEmail(identity),
  });

  return proxyToAppsScript(env, 'solicitacoes', trustedPayload);
};
