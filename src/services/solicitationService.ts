import type {
  AdministrativeSolicitationDetail,
  AdministrativeSolicitationListResponse,
} from '../types/solicitation'

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

export class SolicitationServiceError extends Error {
  readonly code: string
  readonly details?: unknown

  constructor(message: string, code = 'SOLICITATION_REQUEST_FAILED', details?: unknown) {
    super(message)
    this.name = 'SolicitationServiceError'
    this.code = code
    this.details = details
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  let payload: ApiResponse<T>

  try {
    payload = (await response.json()) as ApiResponse<T>
  } catch {
    throw new SolicitationServiceError(
      'O serviço de solicitações retornou uma resposta inválida.',
      'INVALID_SOLICITATION_RESPONSE',
    )
  }

  if (!response.ok || !payload.ok) {
    const apiError = payload.ok ? null : payload.error
    throw new SolicitationServiceError(
      apiError?.message || 'Não foi possível concluir a operação.',
      apiError?.code || `HTTP_${response.status}`,
      apiError?.details,
    )
  }

  return payload.data
}

async function getRequest<T>(url: string, signal?: AbortSignal): Promise<T> {
  let response: Response

  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new SolicitationServiceError('Não foi possível conectar ao serviço de solicitações.')
  }

  return parseResponse<T>(response)
}

async function postRequest<T>(url: string, body: Record<string, unknown>): Promise<T> {
  let response: Response

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new SolicitationServiceError('Não foi possível conectar ao serviço de solicitações.')
  }

  return parseResponse<T>(response)
}

export function fetchAdministrativeSolicitations(
  limit = 100,
  signal?: AbortSignal,
): Promise<AdministrativeSolicitationListResponse> {
  return getRequest(`/api/solicitacoes?limite=${encodeURIComponent(String(limit))}`, signal)
}

export async function fetchAdministrativeSolicitationDetail(
  idSolicitacao: string,
  signal?: AbortSignal,
): Promise<AdministrativeSolicitationDetail> {
  const detail = await getRequest<AdministrativeSolicitationDetail>(
    `/api/solicitacoes?id=${encodeURIComponent(idSolicitacao)}`,
    signal,
  )

  return {
    ...detail,
    jornadaPadraoHoras: detail.jornadaPadraoHoras ?? 9,
    excecoesJornada: Array.isArray(detail.excecoesJornada) ? detail.excecoesJornada : [],
  }
}

export function applyAdministrativeTriage(input: {
  idSolicitacao: string
  fornecedor: string
  produtoAlimentacaoAplicado?: string
  produtoBebidaAplicado?: string
  motivoAjusteProduto?: string
}): Promise<unknown> {
  return postRequest('/api/triagem', input)
}

export function registerAdministrativeAttendance(input: {
  idSolicitacao: string
  qtdComparecida: number
}): Promise<unknown> {
  return postRequest('/api/comparecimento', input)
}

export function registerPartialShift(input: {
  idSolicitacao: string
  nomeColaborador: string
  horasTrabalhadas: number
  horarioSaida?: string
  motivo: string
}): Promise<{
  idExcecao: string
  idSolicitacao: string
  nomeColaborador: string
  horasTrabalhadas: number
  horarioSaida: string
  motivo: string
  valorProporcional: number
  valorReal: number
  jornadaPadraoHoras: number
}> {
  return postRequest('/api/jornada-parcial', input)
}

export function correctAdministrativeSolicitation(input: {
  idSolicitacao: string
  motivoCorrecao: string
  dados: Record<string, unknown>
}): Promise<{
  idSolicitacao: string
  tipoSolicitacao: string
  camposAlterados: string[]
  motivoCorrecao: string
}> {
  return postRequest('/api/correcao-solicitacao', input)
}
