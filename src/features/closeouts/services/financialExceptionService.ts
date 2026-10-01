import type {
  FinancialExceptionDecisionResult,
  FinancialExceptionDestination,
  FinancialExceptionListResponse,
} from '@/types/financialCloseout'

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

export class FinancialExceptionServiceError extends Error {
  readonly code: string
  readonly details?: unknown

  constructor(message: string, code = 'FINANCIAL_EXCEPTION_REQUEST_FAILED', details?: unknown) {
    super(message)
    this.name = 'FinancialExceptionServiceError'
    this.code = code
    this.details = details
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  let payload: ApiResponse<T>
  try {
    payload = (await response.json()) as ApiResponse<T>
  } catch {
    throw new FinancialExceptionServiceError('O serviço de exceções financeiras retornou uma resposta inválida.')
  }

  if (!response.ok || !payload.ok) {
    const apiError = payload.ok ? null : payload.error
    throw new FinancialExceptionServiceError(
      apiError?.message || 'Não foi possível concluir a operação de exceção financeira.',
      apiError?.code || `HTTP_${response.status}`,
      apiError?.details,
    )
  }

  return payload.data
}

export async function fetchFinancialExceptions(
  competencia: string,
  fornecedor: string,
  signal?: AbortSignal,
  fresh = false,
): Promise<FinancialExceptionListResponse> {
  const params = new URLSearchParams({
    excecoes: '1',
    competencia,
    fornecedor,
  })
  if (fresh) params.set('fresh', '1')
  const response = await fetch(`/api/fechamentos?${params.toString()}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal,
  })
  return parseResponse<FinancialExceptionListResponse>(response)
}

export async function decideFinancialException(input: {
  idSolicitacao: string
  destinoFinanceiro: FinancialExceptionDestination
  competenciaFaturamento?: string
  motivo: string
}): Promise<FinancialExceptionDecisionResult> {
  const response = await fetch('/api/fechamentos', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ ...input, acao: 'DECIDIR' }),
  })
  return parseResponse<FinancialExceptionDecisionResult>(response)
}
