import type {
  AdministrativeSolicitationDetail,
  AdministrativeSolicitationListQuery,
  AdministrativeSolicitationListResponse,
  AdministrativeSolicitationMetadata,
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

const ADMIN_LIST_CACHE_MS = 30 * 1000
const adminListCache = new Map<string, { value: AdministrativeSolicitationListResponse; expiresAt: number }>()
const adminListRequests = new Map<string, Promise<AdministrativeSolicitationListResponse>>()
let metadataCache: { value: AdministrativeSolicitationMetadata; expiresAt: number } | null = null
let metadataRequest: Promise<AdministrativeSolicitationMetadata> | null = null

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

function invalidateAdministrativeListCache() {
  adminListCache.clear()
  metadataCache = null
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

  const result = await parseResponse<T>(response)
  invalidateAdministrativeListCache()
  return result
}

function buildAdministrativeListUrl(query: AdministrativeSolicitationListQuery): string {
  const params = new URLSearchParams()
  params.set('pagina', String(query.pagina || 1))
  params.set('tamanhoPagina', String(query.tamanhoPagina || 20))

  if (query.busca?.trim()) params.set('busca', query.busca.trim())
  if (query.tipo && query.tipo !== 'TODOS') params.set('tipo', query.tipo)
  if (query.status && query.status !== 'TODOS') params.set('status', query.status)
  if (query.anoRegistro && query.anoRegistro !== 'TODOS') params.set('anoRegistro', query.anoRegistro)
  if (query.mesRegistro && query.mesRegistro !== 'TODOS') params.set('mesRegistro', query.mesRegistro)
  if (query.dataRegistro && query.dataRegistro !== 'TODOS') params.set('dataRegistro', query.dataRegistro)

  return `/api/solicitacoes?${params.toString()}`
}

function requestAdministrativeSolicitations(
  key: string,
  query: AdministrativeSolicitationListQuery,
): Promise<AdministrativeSolicitationListResponse> {
  const request = getRequest<AdministrativeSolicitationListResponse>(buildAdministrativeListUrl(query))
    .then((value) => {
      adminListCache.set(key, {
        value,
        expiresAt: Date.now() + ADMIN_LIST_CACHE_MS,
      })
      return value
    })
    .finally(() => {
      adminListRequests.delete(key)
    })

  adminListRequests.set(key, request)
  return request
}

export function fetchAdministrativeSolicitations(
  query: AdministrativeSolicitationListQuery = {},
  signal?: AbortSignal,
): Promise<AdministrativeSolicitationListResponse> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))

  const key = buildAdministrativeListUrl(query)
  const cached = adminListCache.get(key)
  if (cached && cached.expiresAt > Date.now()) {
    return Promise.resolve(cached.value)
  }

  const sharedRequest = adminListRequests.get(key) || requestAdministrativeSolicitations(key, query)
  if (!signal) return sharedRequest

  return Promise.race([
    sharedRequest,
    new Promise<AdministrativeSolicitationListResponse>((_, reject) => {
      signal.addEventListener(
        'abort',
        () => reject(new DOMException('Aborted', 'AbortError')),
        { once: true },
      )
    }),
  ])
}

export function fetchAdministrativeSolicitationMetadata(
  signal?: AbortSignal,
): Promise<AdministrativeSolicitationMetadata> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))

  if (metadataCache && metadataCache.expiresAt > Date.now()) {
    return Promise.resolve(metadataCache.value)
  }

  if (!metadataRequest) {
    metadataRequest = getRequest<AdministrativeSolicitationMetadata>('/api/solicitacoes?metadata=1')
      .then((value) => {
        metadataCache = {
          value,
          expiresAt: Date.now() + ADMIN_LIST_CACHE_MS,
        }
        return value
      })
      .finally(() => {
        metadataRequest = null
      })
  }

  if (!signal) return metadataRequest

  return Promise.race([
    metadataRequest,
    new Promise<AdministrativeSolicitationMetadata>((_, reject) => {
      signal.addEventListener(
        'abort',
        () => reject(new DOMException('Aborted', 'AbortError')),
        { once: true },
      )
    }),
  ])
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

export interface PartialShiftEntryInput {
  nomeColaborador: string
  horasTrabalhadas: number
  horarioSaida?: string
  motivo: string
}

export function registerPartialShifts(input: {
  idSolicitacao: string
  excecoes: PartialShiftEntryInput[]
}): Promise<{
  idSolicitacao: string
  quantidadeComparecida: number
  quantidadeRegistrada: number
  totalJornadasParciais: number
  limiteComparecimento: number
  jornadaPadraoHoras: number
  valorReal: number
  excecoes: Array<{
    idExcecao: string
    nomeColaborador: string
    horasTrabalhadas: number
    horarioSaida: string
    motivo: string
    valorProporcional: number
  }>
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
