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

const DASHBOARD_CACHE_MS = 45 * 1000
const dashboardCache = new Map<string, { value: DashboardResponse; expiresAt: number }>()
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

async function requestDashboard(key: string): Promise<DashboardResponse> {
  let response: Response

  try {
    response = await fetch(key, {
      method: 'GET',
      headers: { accept: 'application/json' },
    })
  } catch {
    throw new DashboardServiceError('Não foi possível conectar ao serviço do dashboard.')
  }

  const value = await parseApiResponse<DashboardResponse>(response, 'Não foi possível carregar o dashboard.')
  dashboardCache.set(key, { value, expiresAt: Date.now() + DASHBOARD_CACHE_MS })
  return value
}

export function invalidateDashboardCache(): void {
  dashboardCache.clear()
}

export function fetchDashboard(query: DashboardQuery, signal?: AbortSignal): Promise<DashboardResponse> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))

  const key = buildDashboardUrl(query)
  const cached = dashboardCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value)

  let request = dashboardRequests.get(key)
  if (!request) {
    request = requestDashboard(key).finally(() => dashboardRequests.delete(key))
    dashboardRequests.set(key, request)
  }

  if (!signal) return request

  return Promise.race([
    request,
    new Promise<DashboardResponse>((_, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }),
  ])
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
