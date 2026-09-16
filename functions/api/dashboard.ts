import {
  authorizeGatewayRequest,
  identityProfile,
  operationScope,
  type GatewayAuthEnv,
  type GatewayIdentity,
} from '../_auth'
import { enforceDashboardScope, validateAreaAccess } from '../_access-control'

interface Env extends GatewayAuthEnv {
  APPS_SCRIPT_URL: string
  APPS_SCRIPT_GATEWAY_TOKEN: string
}

const EDGE_CACHE_SECONDS = 120
const APPS_SCRIPT_EXECUTION_HOST = 'script.google.com'
const APPS_SCRIPT_CONTENT_HOST = 'script.googleusercontent.com'
const MAX_APPS_SCRIPT_REDIRECTS = 4

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

function edgeCache_(): Cache | null {
  if (typeof caches === 'undefined') return null
  return (caches as unknown as { default?: Cache }).default || null
}

function bypassEdgeCache_(request: Request): boolean {
  const cacheControl = String(request.headers.get('cache-control') || '').toLowerCase()
  return cacheControl.includes('no-cache') || cacheControl.includes('no-store')
}

function scopedCacheKey_(request: Request, identity: GatewayIdentity): Request {
  const cacheUrl = new URL(request.url)
  cacheUrl.searchParams.set('_profile', identityProfile(identity))
  cacheUrl.searchParams.set('_scope', operationScope(identity) || 'TODOS')
  return new Request(cacheUrl.toString(), { method: 'GET' })
}

function clientResponse_(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set('cache-control', 'no-store')
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })
}

async function matchEdgeCache_(request: Request, identity: GatewayIdentity): Promise<Response | null> {
  const cache = edgeCache_()
  if (!cache) return null

  try {
    const cached = await cache.match(scopedCacheKey_(request, identity))
    return cached ? clientResponse_(cached) : null
  } catch {
    return null
  }
}

function cacheSuccessfulResponse_(
  context: EventContext<Env, string, unknown>,
  request: Request,
  identity: GatewayIdentity,
  response: Response,
): void {
  if (response.status !== 200) return

  const cache = edgeCache_()
  if (!cache) return

  const headers = new Headers(response.headers)
  headers.set('cache-control', `public, max-age=${EDGE_CACHE_SECONDS}`)
  const cachedResponse = new Response(response.clone().body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  })

  try {
    context.waitUntil(
      cache.put(scopedCacheKey_(request, identity), cachedResponse).catch(() => undefined),
    )
  } catch {
    // Cache API é apenas otimização; falha não pode afetar a leitura.
  }
}

function isRedirectStatus_(status: number): boolean {
  return status === 301 || status === 302 || status === 303 || status === 307 || status === 308
}

async function fetchAppsScriptRead_(
  targetUrl: URL,
  payload: Record<string, unknown>,
  gatewayToken: string,
): Promise<{ response: Response; payload: unknown } | null> {
  let currentUrl = targetUrl.toString()
  const body = JSON.stringify({ ...payload, _gatewayToken: gatewayToken })

  try {
    for (let hop = 0; hop < MAX_APPS_SCRIPT_REDIRECTS; hop += 1) {
      const response = await fetch(currentUrl, {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body,
        redirect: 'manual',
      })

      if (!isRedirectStatus_(response.status)) {
        const text = await response.text()
        try {
          return { response, payload: JSON.parse(text) as unknown }
        } catch {
          return null
        }
      }

      const location = response.headers.get('location')
      if (!location) return null
      const nextUrl = new URL(location, currentUrl)

      if (nextUrl.hostname === APPS_SCRIPT_CONTENT_HOST) {
        const finalResponse = await fetch(nextUrl.toString(), {
          method: 'GET',
          headers: { accept: 'application/json' },
          redirect: 'follow',
        })
        const text = await finalResponse.text()
        try {
          return { response: finalResponse, payload: JSON.parse(text) as unknown }
        } catch {
          return null
        }
      }

      if (nextUrl.hostname === APPS_SCRIPT_EXECUTION_HOST) {
        currentUrl = nextUrl.toString()
        continue
      }

      return null
    }

    return null
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

  let upstream = await fetchAppsScriptRead_(targetUrl, payload, env.APPS_SCRIPT_GATEWAY_TOKEN)

  if (!upstream) {
    await delay(200)
    upstream = await fetchAppsScriptRead_(targetUrl, payload, env.APPS_SCRIPT_GATEWAY_TOKEN)
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

  const bypassCache = bypassEdgeCache_(request)
  if (!bypassCache) {
    const cached = await matchEdgeCache_(request, identity)
    if (cached) return cached
  }

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

  const response = await proxyToAppsScript(env, enforceDashboardScope(identity, payload))
  if (!bypassCache && response.status === 200) {
    cacheSuccessfulResponse_(context, request, identity, response)
  }
  return response
}
