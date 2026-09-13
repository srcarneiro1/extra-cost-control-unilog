import type { DashboardQuery, DashboardResponse } from '../types/dashboard'

interface ApiSuccess<T> {
  ok: true
  data: T
}

interface ApiFailure {
  ok: false
  error: {
    code?: string
    message?: string
    details?: unknown
  }
}

type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export type DashboardExportType = 'MAO_DE_OBRA' | 'ALIMENTACAO_BEBIDA'

export interface DashboardExportResponse {
  competencia: string
  tipoExportacao: DashboardExportType
  arquivo: string
  colunas: string[]
  linhas: Array<Array<string | number>>
  total: number
}

const DASHBOARD_FRESH_MS = 5 * 60 * 1000
const DASHBOARD_STALE_MS = 15 * 60 * 1000
const READ_RETRY_DELAY_MS = 250

type DashboardCacheEntry = {
  value: DashboardResponse
  freshUntil: number
  staleUntil: number
}

const dashboardCache = new Map<string, DashboardCacheEntry>()
const dashboardRequests = new Map<string, Promise<DashboardResponse>>()

export class DashboardServiceError extends Error {
  readonly code: string
  readonly details?: unknown

  constructor(message: string, code = 'DASHBOARD_REQUEST_FAILED', details?: unknown) {
    super(message)
    this.name = 'DashboardServiceError'
    this.code = code
    this.details = details
  }
}

function appendDashboardParams(params: URLSearchParams, query: DashboardQuery) {
  if (query.ano) params.set('ano', query.ano)
  if (query.mesCompetencia) params.set('mesCompetencia', query.mesCompetencia)
  if (query.operacao && query.operacao !== 'TODOS') params.set('operacao', query.operacao)
  if (query.supervisor && query.supervisor !== 'TODOS') params.set('supervisor', query.supervisor)
  if (query.fornecedor && query.fornecedor !== 'TODOS') params.set('fornecedor', query.fornecedor)
  if (query.tipo && query.tipo !== 'TODOS') params.set('tipo', query.tipo)
  if (query.responsavelCusto && query.responsavelCusto !== 'TODOS') params.set('responsavelCusto', query.responsavelCusto)
  if (query.atividade && query.atividade !== 'TODOS') params.set('atividade', query.atividade)
}

function buildDashboardUrl(query: DashboardQuery): string {
  const params = new URLSearchParams()
  appendDashboardParams(params, query)
  return `/api/dashboard?${params.toString()}`
}

function buildDashboardExportUrl(query: DashboardQuery, type: DashboardExportType): string {
  const params = new URLSearchParams()
  appendDashboardParams(params, query)
  params.set('tipoExportacao', type)
  return `/api/dashboard-export?${params.toString()}`
}

async function parseApiResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  let payload: ApiResponse<T>
  try {
    payload = (await response.json()) as ApiResponse<T>
  } catch {
    throw new DashboardServiceError('O serviço do dashboard retornou uma resposta inválida.', 'INVALID_DASHBOARD_RESPONSE')
  }

  if (!response.ok || !payload.ok) {
    const apiError = payload.ok ? null : payload.error
    throw new DashboardServiceError(
      apiError?.message || fallbackMessage,
      apiError?.code || `HTTP_${response.status}`,
      apiError?.details,
    )
  }

  return payload.data
}

function isRetriableDashboardRead(error: unknown): boolean {
  if (!(error instanceof DashboardServiceError)) return true
  return [
    'DASHBOARD_REQUEST_FAILED',
    'UPSTREAM_INVALID_RESPONSE',
    'INVALID_DASHBOARD_RESPONSE',
    'HTTP_502',
    'HTTP_503',
    'HTTP_504',
  ].includes(error.code)
}

function waitBeforeRetry(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, READ_RETRY_DELAY_MS))
}

async function requestDashboard(key: string, bypassEdgeCache = false): Promise<DashboardResponse> {
  let lastError: unknown

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(key, {
        method: 'GET',
        headers: {
          accept: 'application/json',
          ...(bypassEdgeCache ? { 'cache-control': 'no-cache' } : {}),
        },
      })
      const value = await parseApiResponse<DashboardResponse>(response, 'Não foi possível carregar o dashboard.')
      const now = Date.now()
      dashboardCache.set(key, {
        value,
        freshUntil: now + DASHBOARD_FRESH_MS,
        staleUntil: now + DASHBOARD_STALE_MS,
      })
      return value
    } catch (error) {
      lastError = error instanceof Error
        ? error
        : new DashboardServiceError('Não foi possível conectar ao serviço do dashboard.')

      if (attempt === 0 && isRetriableDashboardRead(lastError)) {
        await waitBeforeRetry()
        continue
      }
      throw lastError
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new DashboardServiceError('Não foi possível conectar ao serviço do dashboard.')
}

function requestForKey(key: string): Promise<DashboardResponse> {
  let request = dashboardRequests.get(key)
  if (!request) {
    request = requestDashboard(key).finally(() => dashboardRequests.delete(key))
    dashboardRequests.set(key, request)
  }
  return request
}

function dashboardSnapshot(key: string): { value: DashboardResponse; isFresh: boolean } | null {
  const cached = dashboardCache.get(key)
  if (!cached) return null

  const now = Date.now()
  if (cached.staleUntil <= now) {
    dashboardCache.delete(key)
    return null
  }

  return {
    value: cached.value,
    isFresh: cached.freshUntil > now,
  }
}

function withAbortSignal(request: Promise<DashboardResponse>, signal?: AbortSignal): Promise<DashboardResponse> {
  if (!signal) return request
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))

  return Promise.race([
    request,
    new Promise<DashboardResponse>((_, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }),
  ])
}

export function invalidateDashboardCache(): void {
  dashboardCache.forEach((entry) => {
    entry.freshUntil = 0
  })
}

export function fetchDashboard(
  query: DashboardQuery,
  signal?: AbortSignal,
  options?: { force?: boolean },
): Promise<DashboardResponse> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))

  const key = buildDashboardUrl(query)
  const snapshot = dashboardSnapshot(key)

  if (!options?.force && snapshot) {
    if (!snapshot.isFresh && !dashboardRequests.has(key)) {
      void requestForKey(key).catch(() => undefined)
    }
    return Promise.resolve(snapshot.value)
  }

  if (options?.force) {
    return withAbortSignal(requestDashboard(key, true), signal)
  }

  return withAbortSignal(requestForKey(key), signal)
}

export function revalidateDashboard(query: DashboardQuery, signal?: AbortSignal): Promise<DashboardResponse> {
  return fetchDashboard(query, signal)
}

export function prefetchDashboard(_query: DashboardQuery): void {
  // Dashboard é uma leitura pesada no Apps Script. Carregar somente quando a tela solicitar.
}

export async function fetchDashboardExport(query: DashboardQuery, type: DashboardExportType): Promise<DashboardExportResponse> {
  let response: Response

  try {
    response = await fetch(buildDashboardExportUrl(query, type), {
      method: 'GET',
      headers: { accept: 'application/json' },
    })
  } catch {
    throw new DashboardServiceError('Não foi possível conectar ao serviço de exportação.')
  }

  return parseApiResponse<DashboardExportResponse>(response, 'Não foi possível gerar a exportação.')
}
