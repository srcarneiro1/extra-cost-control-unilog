// Tela aberta de solicitação (05/11/2026): rota PÚBLICA, sem login.
// GET  → opções lidas dos cadastros (supervisores, operações, produtos, responsáveis, centros…)
// POST → envio da solicitação (mão de obra, lanche ou os dois)
// Proteções: só cria solicitações e lê opções (nenhum dado lançado sai por aqui); campos em lista
// fechada e com tamanho máximo; anti-robô invisível (campo-isca + tempo mínimo de preenchimento);
// limite de envios por origem. O token do Apps Script fica só no servidor (variável de ambiente).

interface Env {
  APPS_SCRIPT_URL: string
  APPS_SCRIPT_GATEWAY_TOKEN: string
}

const ROUTE = 'solicitacao_publica'
const OPTIONS_CACHE_SECONDS = 60
const MAX_BODY_BYTES = 8 * 1024
const MIN_FILL_MS = 3000
const MAX_FILL_MS = 24 * 60 * 60 * 1000
const RATE_LIMIT = 10
const RATE_WINDOW_SECONDS = 10 * 60
const APPS_SCRIPT_EXECUTION_HOST = 'script.google.com'
const APPS_SCRIPT_CONTENT_HOST = 'script.googleusercontent.com'

function json(payload: unknown, status = 200, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra },
  })
}

function fail(message: string, status = 400): Response {
  return json({ ok: false, error: { message } }, status)
}

async function callAppsScript(env: Env, payload: Record<string, unknown>): Promise<Response> {
  if (!env.APPS_SCRIPT_URL || !env.APPS_SCRIPT_GATEWAY_TOKEN) return fail('Serviço indisponível no momento.', 500)
  const url = new URL(env.APPS_SCRIPT_URL)
  url.searchParams.set('route', ROUTE)
  const body = JSON.stringify({ ...payload, _gatewayToken: env.APPS_SCRIPT_GATEWAY_TOKEN })
  let current = url.toString()
  let response: Response | null = null
  try {
    for (let hop = 0; hop < 4; hop += 1) {
      response = await fetch(current, { method: 'POST', headers: { 'content-type': 'application/json', accept: 'application/json' }, body, redirect: 'manual' })
      if (![301, 302, 303, 307, 308].includes(response.status)) break
      const location = response.headers.get('location')
      if (!location) break
      const next = new URL(location, current)
      if (next.hostname === APPS_SCRIPT_CONTENT_HOST) {
        response = await fetch(next.toString(), { method: 'GET', headers: { accept: 'application/json' }, redirect: 'follow' })
        break
      }
      if (next.hostname !== APPS_SCRIPT_EXECUTION_HOST) break
      current = next.toString()
    }
  } catch {
    return fail('Não foi possível conectar ao serviço. Tente novamente em alguns instantes.', 502)
  }
  if (!response) return fail('Serviço indisponível no momento.', 502)
  const text = await response.text()
  let data: { ok?: boolean; data?: unknown; error?: { message?: string } }
  try {
    data = JSON.parse(text)
  } catch {
    return fail('O serviço respondeu de forma inesperada. Tente novamente.', 502)
  }
  if (data && data.ok === true) return json({ ok: true, data: data.data })
  return fail((data && data.error && data.error.message) || 'Não foi possível concluir a solicitação.', 400)
}

// Limite de envios por origem (IP), usando o cache do próprio Cloudflare (sem serviço extra).
async function rateLimited(request: Request): Promise<boolean> {
  const cache = (caches as unknown as { default?: Cache }).default
  if (!cache) return false
  const ip = request.headers.get('cf-connecting-ip') || 'desconhecido'
  const key = new Request(`https://limite.extra-cost.invalid/solicitacao/${encodeURIComponent(ip)}`)
  const now = Date.now()
  let state = { count: 0, resetAt: now + RATE_WINDOW_SECONDS * 1000 }
  const hit = await cache.match(key)
  if (hit) {
    try {
      const saved = await hit.json() as { count: number; resetAt: number }
      if (saved.resetAt > now) state = saved
    } catch { /* recomeça a contagem */ }
  }
  if (state.count >= RATE_LIMIT) return true
  state.count += 1
  const ttl = Math.max(1, Math.ceil((state.resetAt - now) / 1000))
  await cache.put(key, new Response(JSON.stringify(state), { headers: { 'cache-control': `max-age=${ttl}` } }))
  return false
}

const text = (value: unknown, max: number) => String(value ?? '').slice(0, max).trim()

function pickLabor(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  return {
    atividade: text(v.atividade, 120), funcao: text(v.funcao, 120), turno: text(v.turno, 20),
    quantidade: text(v.quantidade, 6), volumeReferencia: text(v.volumeReferencia, 20), unidadeVolume: text(v.unidadeVolume, 40),
  }
}

function pickFood(value: unknown) {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  return {
    produtoAlimentacao: text(v.produtoAlimentacao, 120), qtdAlimentacao: text(v.qtdAlimentacao, 6),
    produtoBebida: text(v.produtoBebida, 120), qtdBebida: text(v.qtdBebida, 6),
  }
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const cache = (caches as unknown as { default?: Cache }).default
  const key = new Request(new URL('/api/publico/solicitacao?opcoes=1', context.request.url).toString())
  if (cache) {
    const hit = await cache.match(key)
    if (hit) return hit
  }
  const response = await callAppsScript(context.env, { acao: 'OPCOES' })
  if (response.ok && cache) {
    const copy = new Response(await response.clone().text(), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `max-age=${OPTIONS_CACHE_SECONDS}` } })
    context.waitUntil(cache.put(key, copy))
  }
  return response
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const raw = await context.request.text()
  if (raw.length > MAX_BODY_BYTES) return fail('Envio grande demais.', 413)
  let body: Record<string, unknown>
  try {
    body = JSON.parse(raw)
  } catch {
    return fail('Envio inválido.')
  }

  // Anti-robô invisível: campo-isca preenchido ou envio rápido demais = robô (resposta genérica).
  const openedAt = Number(body.abertoEm || 0)
  const elapsed = Date.now() - openedAt
  if (text(body.site, 200) || !openedAt || elapsed < MIN_FILL_MS || elapsed > MAX_FILL_MS) {
    return fail('Não foi possível validar o envio. Recarregue a página e tente novamente.')
  }

  if (await rateLimited(context.request)) {
    return fail('Muitos envios em pouco tempo. Aguarde alguns minutos e tente novamente.', 429)
  }

  return callAppsScript(context.env, {
    acao: 'ENVIAR',
    idEnvio: text(body.idEnvio, 64),
    nomeSolicitante: text(body.nomeSolicitante, 120),
    supervisor: text(body.supervisor, 120),
    operacao: text(body.operacao, 120),
    dataOperacional: text(body.dataOperacional, 10),
    justificativa: text(body.justificativa, 1000),
    responsavelCusto: text(body.responsavelCusto, 60),
    centroCusto: text(body.centroCusto, 12),
    maoDeObra: pickLabor(body.maoDeObra),
    alimentacao: pickFood(body.alimentacao),
  })
}
