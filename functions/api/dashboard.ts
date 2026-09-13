import { authorizeGatewayRequest, type GatewayAuthEnv } from '../_auth'
import { enforceDashboardScope, validateAreaAccess } from '../_access-control'

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

function optionalParam(url: URL, name: string): string {
  return String(url.searchParams.get(name) || '').trim()
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchAppsScript(
  targetUrl: URL,
  payload: Record<string, unknown>,
  gatewayToken: string,
): Promise<{ response: Response; payload: unknown } | null> {
  try {
    const response = await fetch(targetUrl.toString(), {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, _gatewayToken: gatewayToken }),
      redirect: 'follow',
    })

    const text = await response.text()
    try {
      return { response, payload: JSON.parse(text) as unknown }
    } catch {
      return null
    }
  } catch {
    return null
  }
}

async function proxyToAppsScript(
  env: Env,
  payload: Record<string, unknown>,
): Promise<Response> {
  if (!env.APPS_SCRIPT_URL || !env.APPS_SCRIPT_GATEWAY_TOKEN) {
    return jsonResponse(
      { ok: false, error: { code: 'GATEWAY_CONFIG_ERROR', message: 'Gateway não configurado no ambiente Cloudflare.' } },
      500,
    )
  }

  const targetUrl = new URL(env.APPS_SCRIPT_URL)
  targetUrl.searchParams.set('route', 'dashboard')

  let upstream = await fetchAppsScript(targetUrl, payload, env.APPS_SCRIPT_GATEWAY_TOKEN)

  // Dashboard é somente leitura. Uma repetição curta é segura e absorve respostas
  // transitórias do endpoint publicado do Apps Script sem duplicar qualquer escrita.
  if (!upstream) {
    await delay(200)
    upstream = await fetchAppsScript(targetUrl, payload, env.APPS_SCRIPT_GATEWAY_TOKEN)
  }

  if (!upstream) {
    return jsonResponse(
      { ok: false, error: { code: 'UPSTREAM_INVALID_RESPONSE', message: 'Apps Script retornou uma resposta inválida.' } },
      502,
    )
  }

  const apiSucceeded =
    typeof upstream.payload === 'object' &&
    upstream.payload !== null &&
    'ok' in upstream.payload &&
    (upstream.payload as { ok?: unknown }).ok === true

  return jsonResponse(
    upstream.payload,
    apiSucceeded ? 200 : upstream.response.ok ? 400 : 502,
  )
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env } = context
  const identity = await authorizeGatewayRequest(request, env)

  if (!identity) {
    return jsonResponse(
      { ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessão da plataforma não autenticada.' } },
      401,
    )
  }

  const denied = validateAreaAccess(identity, 'DASHBOARD')
  if (denied) return denied

  const url = new URL(request.url)
  const payload: Record<string, unknown> = {}

  const names = [
    'ano',
    'mesCompetencia',
    'operacao',
    'supervisor',
    'fornecedor',
    'tipo',
    'responsavelCusto',
    'atividade',
  ]

  names.forEach((name) => {
    const value = optionalParam(url, name)
    if (value) payload[name] = value
  })

  return proxyToAppsScript(env, enforceDashboardScope(identity, payload))
}
