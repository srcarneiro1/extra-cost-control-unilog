import { authorizeGatewayRequest, type GatewayAuthEnv } from '../_auth'
import { enforceDashboardScope, validateAreaAccess } from '../_access-control'

interface Env extends GatewayAuthEnv {
  APPS_SCRIPT_URL: string
  APPS_SCRIPT_GATEWAY_TOKEN: string
}

const APPS_SCRIPT_EXECUTION_HOST = 'script.google.com'
const APPS_SCRIPT_CONTENT_HOST = 'script.googleusercontent.com'
const MAX_APPS_SCRIPT_REDIRECTS = 4

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function isRedirectStatus_(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

async function fetchAppsScriptRead_(
  env: Env,
  payload: Record<string, unknown>,
): Promise<Response> {
  let currentUrl = new URL(env.APPS_SCRIPT_URL)
  currentUrl.searchParams.set('route', 'dashboard_export')
  let current = currentUrl.toString()
  const body = JSON.stringify({ ...payload, _gatewayToken: env.APPS_SCRIPT_GATEWAY_TOKEN })

  for (let hop = 0; hop < MAX_APPS_SCRIPT_REDIRECTS; hop += 1) {
    const response = await fetch(current, {
      method: 'POST',
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body,
      redirect: 'manual',
    })

    if (!isRedirectStatus_(response.status)) return response

    const location = response.headers.get('location')
    if (!location) return response
    const nextUrl = new URL(location, current)

    if (nextUrl.hostname === APPS_SCRIPT_CONTENT_HOST) {
      return fetch(nextUrl.toString(), {
        method: 'GET',
        headers: { accept: 'application/json' },
        redirect: 'follow',
      })
    }

    if (nextUrl.hostname === APPS_SCRIPT_EXECUTION_HOST) {
      current = nextUrl.toString()
      continue
    }

    return response
  }

  throw new Error('Apps Script excedeu o limite de redirecionamentos no export do dashboard.')
}

async function proxyToAppsScript(env: Env, payload: Record<string, unknown>): Promise<Response> {
  if (!env.APPS_SCRIPT_URL || !env.APPS_SCRIPT_GATEWAY_TOKEN) {
    return jsonResponse({ ok: false, error: { code: 'GATEWAY_CONFIG_ERROR', message: 'Gateway não configurado no ambiente Cloudflare.' } }, 500)
  }

  let upstreamResponse: Response
  try {
    upstreamResponse = await fetchAppsScriptRead_(env, payload)
  } catch {
    return jsonResponse({ ok: false, error: { code: 'UPSTREAM_CONNECTION_ERROR', message: 'Não foi possível conectar ao Apps Script.' } }, 502)
  }

  const upstreamText = await upstreamResponse.text()
  let upstreamPayload: unknown
  try {
    upstreamPayload = JSON.parse(upstreamText)
  } catch {
    return jsonResponse({ ok: false, error: { code: 'UPSTREAM_INVALID_RESPONSE', message: 'Apps Script retornou uma resposta inválida.' } }, 502)
  }

  const ok = typeof upstreamPayload === 'object'
    && upstreamPayload !== null
    && 'ok' in upstreamPayload
    && (upstreamPayload as { ok?: unknown }).ok === true

  return jsonResponse(upstreamPayload, ok ? 200 : upstreamResponse.ok ? 400 : 502)
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const identity = await authorizeGatewayRequest(request, env)
  if (!identity) return jsonResponse({ ok: false, error: { code: 'UNAUTHORIZED', message: 'Sessão da plataforma não autenticada.' } }, 401)
  const denied = validateAreaAccess(identity, 'DASHBOARD')
  if (denied) return denied

  const url = new URL(request.url)
  const payload: Record<string, unknown> = {}
  const names = ['ano', 'mesCompetencia', 'operacao', 'supervisor', 'fornecedor', 'responsavelCusto', 'atividade', 'tipoExportacao']
  names.forEach((name) => {
    const value = String(url.searchParams.get(name) || '').trim()
    if (value) payload[name] = value
  })

  return proxyToAppsScript(env, enforceDashboardScope(identity, payload))
}
