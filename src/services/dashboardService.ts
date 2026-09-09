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

function buildDashboardUrl(query: DashboardQuery): string {
  const params = new URLSearchParams()

  if (query.ano) params.set('ano', query.ano)
  if (query.mesCompetencia) params.set('mesCompetencia', query.mesCompetencia)
  if (query.operacao && query.operacao !== 'TODOS') params.set('operacao', query.operacao)
  if (query.supervisor && query.supervisor !== 'TODOS') params.set('supervisor', query.supervisor)
  if (query.fornecedor && query.fornecedor !== 'TODOS') params.set('fornecedor', query.fornecedor)
  if (query.tipo && query.tipo !== 'TODOS') params.set('tipo', query.tipo)
  if (query.responsavelCusto && query.responsavelCusto !== 'TODOS') params.set('responsavelCusto', query.responsavelCusto)
  if (query.atividade && query.atividade !== 'TODOS') params.set('atividade', query.atividade)

  return `/api/dashboard?${params.toString()}`
}

export async function fetchDashboard(
  query: DashboardQuery,
  signal?: AbortSignal,
): Promise<DashboardResponse> {
  let response: Response

  try {
    response = await fetch(buildDashboardUrl(query), {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new DashboardServiceError('Não foi possível conectar ao serviço do dashboard.')
  }

  let payload: ApiResponse<DashboardResponse>
  try {
    payload = (await response.json()) as ApiResponse<DashboardResponse>
  } catch {
    throw new DashboardServiceError(
      'O serviço do dashboard retornou uma resposta inválida.',
      'INVALID_DASHBOARD_RESPONSE',
    )
  }

  if (!response.ok || !payload.ok) {
    const apiError = payload.ok ? null : payload.error
    throw new DashboardServiceError(
      apiError?.message || 'Não foi possível carregar o dashboard.',
      apiError?.code || `HTTP_${response.status}`,
      apiError?.details,
    )
  }

  return payload.data
}
