import { authorizeGatewayRequest, type GatewayAuthEnv } from '../_auth'

interface Env extends GatewayAuthEnv {
  APPS_SCRIPT_URL: string
  APPS_SCRIPT_GATEWAY_TOKEN: string
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

async function proxyToAppsScript(env: Env, payload: Record<string, unknown>): Promise<Response> {
  if (!env.APPS_SCRIPT_URL || !env.APPS_SCRIPT_GATEWAY_TOKEN) {
    return jsonResponse({ ok: false, error: { code: 'GATEWAY_CONFIG_ERROR', message: 'Gateway não configurado no ambiente Cloudflare.' } }, 500)
  }

  const targetUrl = new URL(env.APPS_SCRIPT_URL)
  targetUrl.searchParams.set('route', 'dashboard_export')

  const upstreamResponse = await fetch(targetUrl.toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...payload, _gatewayToken: env.APPS_SCRIPT_GATEWAY_TOKEN }),
    redirect: 'follow',
  })

  const upstreamText = await upstreamResponse.text()
  let upstreamPayload: unknown

  try {
    upstreamPayload = JSON.parse(upstreamText)
  } catch {
    return jsonResponse({ ok: false, error: { code: 'UPSTREAM_INVALID_RESPONSE', message: 'Apps Script retornou uma resposta inválida.' } }, 502)
  }

  const apiSucceeded = typeof upstreamPayload === 'object' && upstreamPayload !== null && 'ok' in upstreamPayload && (upstreamPayload as { ok?: unknown }).ok === true
  return jsonResponse(upstreamPayload, apiSucceeded ? 200 : upstreamResponse.ok ? 400 : 502)
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const identity = await authorizeGatewayRequest(request, env)
  if (!identity) return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Acesso ao gateway não autorizado.' } }, 401)

  const url = new URL(request.url)
  const payload: Record<string, unknown> = {}
  const names = ['ano', 'mesCompetencia', 'operacao', 'supervisor', 'fornecedor', 'responsavelCusto', 'atividade', 'tipoExportacao']

  names.forEach((name) => {
    const value = String(url.searchParams.get(name) || '').trim()
    if (value) payload[name] = value
  })

  return proxyToAppsScript(env, payload)
}
