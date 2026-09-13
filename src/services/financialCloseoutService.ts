import type {
  FinancialCloseoutCompleteResult,
  FinancialCloseoutListResponse,
  FinancialCloseoutMetadata,
  FinancialCloseoutMutationResult,
  FinancialInvoiceMutationResult,
  FinancialReconciliationMutationResult,
  ReconciliationResult,
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
    throw new FinancialCloseoutServiceError('O serviço de fechamento retornou uma resposta inválida.')
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

async function post<T>(payload: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/fechamentos', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return parseResponse<T>(response)
}

export async function fetchFinancialCloseoutMetadata(
  signal?: AbortSignal,
  fresh = false,
): Promise<FinancialCloseoutMetadata> {
  const params = new URLSearchParams({ metadata: '1' })
  if (fresh) params.set('fresh', '1')
  const response = await fetch(`/api/fechamentos?${params.toString()}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal,
  })
  return parseResponse<FinancialCloseoutMetadata>(response)
}

export async function fetchFinancialCloseout(
  competencia: string,
  signal?: AbortSignal,
  fresh = false,
): Promise<FinancialCloseoutListResponse> {
  const params = new URLSearchParams({ competencia })
  if (fresh) params.set('fresh', '1')
  const response = await fetch(`/api/fechamentos?${params.toString()}`, {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal,
  })
  return parseResponse<FinancialCloseoutListResponse>(response)
}

export function closeFinancialGroup(input: {
  competencia: string
  fornecedor: string
}): Promise<FinancialCloseoutMutationResult> {
  return post<FinancialCloseoutMutationResult>({ ...input, acao: 'FECHAR' })
}

export function saveFinancialInvoice(input: {
  idFechamento: string
  numeroNf: string
  dataEmissao: string
  dataRecebimento: string
  valorNf: number
}): Promise<FinancialInvoiceMutationResult> {
  return post<FinancialInvoiceMutationResult>({ ...input, acao: 'SALVAR_NF' })
}

export function reconcileFinancialInvoice(input: {
  idFechamento: string
  resultadoConciliacao: Exclude<ReconciliationResult, ''>
  valorAjuste?: number
  observacaoConciliacao?: string
}): Promise<FinancialReconciliationMutationResult> {
  return post<FinancialReconciliationMutationResult>({ ...input, acao: 'CONCILIAR' })
}

export function completeFinancialCloseout(idFechamento: string): Promise<FinancialCloseoutCompleteResult> {
  return post<FinancialCloseoutCompleteResult>({ acao: 'ENCERRAR', idFechamento })
}
