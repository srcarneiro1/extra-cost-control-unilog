import type {
  FinancialCloseoutListResponse,
  FinancialCloseoutMetadata,
  FinancialCloseoutMutationResult,
} from '../types/financialCloseout'

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

export class FinancialCloseoutServiceError extends Error {
  readonly code: string
  readonly details?: unknown

  constructor(message: string, code = 'FINANCIAL_CLOSEOUT_REQUEST_FAILED', details?: unknown) {
    super(message)
    this.name = 'FinancialCloseoutServiceError'
    this.code = code
    this.details = details
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  let payload: ApiResponse<T>

  try {
    payload = (await response.json()) as ApiResponse<T>
  } catch {
    throw new FinancialCloseoutServiceError(
      'O serviço de fechamento retornou uma resposta inválida.',
      'INVALID_FINANCIAL_CLOSEOUT_RESPONSE',
    )
  }

  if (!response.ok || !payload.ok) {
    const apiError = payload.ok ? null : payload.error
    throw new FinancialCloseoutServiceError(
      apiError?.message || 'Não foi possível concluir a operação de fechamento.',
      apiError?.code || `HTTP_${response.status}`,
      apiError?.details,
    )
  }

  return payload.data
}

export async function fetchFinancialCloseoutMetadata(
  signal?: AbortSignal,
): Promise<FinancialCloseoutMetadata> {
  const response = await fetch('/api/fechamentos?metadata=1', {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal,
  })
  return parseResponse<FinancialCloseoutMetadata>(response)
}

export async function fetchFinancialCloseout(
  competencia: string,
  signal?: AbortSignal,
): Promise<FinancialCloseoutListResponse> {
  const response = await fetch(
    `/api/fechamentos?competencia=${encodeURIComponent(competencia)}`,
    {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal,
    },
  )
  return parseResponse<FinancialCloseoutListResponse>(response)
}

export async function closeFinancialGroup(input: {
  competencia: string
  fornecedor: string
}): Promise<FinancialCloseoutMutationResult> {
  let response: Response

  try {
    response = await fetch('/api/fechamentos', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(input),
    })
  } catch {
    throw new FinancialCloseoutServiceError(
      'Não foi possível conectar ao serviço de fechamento.',
    )
  }

  return parseResponse<FinancialCloseoutMutationResult>(response)
}
