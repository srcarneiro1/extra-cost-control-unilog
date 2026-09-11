import { authorizeGatewayRequest, identityEmail, type GatewayAuthEnv } from '../_auth';
import { validateAdministrativeAction } from '../_access-control';

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

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const identity = await authorizeGatewayRequest(request, env);
  if (!identity) return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessão da plataforma não autenticada.' } }, 401);
  const denied = validateAdministrativeAction(identity);
  if (denied) return denied;

  if (!env.APPS_SCRIPT_URL || !env.APPS_SCRIPT_GATEWAY_TOKEN) {
    return jsonResponse({ ok: false, error: { code: 'GATEWAY_CONFIG_ERROR', message: 'Gateway não configurado no ambiente Cloudflare.' } }, 500);
  }

  let payload: Record<string, unknown>;
  try { payload = (await request.json()) as Record<string, unknown>; }
  catch { return jsonResponse({ ok: false, error: { code: 'INVALID_JSON', message: 'Corpo JSON inválido.' } }, 400); }

  const targetUrl = new URL(env.APPS_SCRIPT_URL);
  targetUrl.searchParams.set('route', 'jornada_parcial');
  const upstreamResponse = await fetch(targetUrl.toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...payload, usuarioAdministrativo: identityEmail(identity), _gatewayToken: env.APPS_SCRIPT_GATEWAY_TOKEN }),
    redirect: 'follow',
  });

  const upstreamText = await upstreamResponse.text();
  let upstreamPayload: unknown;
  try { upstreamPayload = JSON.parse(upstreamText); }
  catch { return jsonResponse({ ok: false, error: { code: 'UPSTREAM_INVALID_RESPONSE', message: 'Apps Script retornou uma resposta inválida.' } }, 502); }

  const apiSucceeded = typeof upstreamPayload === 'object' && upstreamPayload !== null && 'ok' in upstreamPayload && (upstreamPayload as { ok?: unknown }).ok === true;
  return jsonResponse(upstreamPayload, apiSucceeded ? 200 : upstreamResponse.ok ? 400 : 502);
};
