import type {
  AdministrativeSolicitationDetail,
  AdministrativeSolicitationListQuery,
  AdministrativeSolicitationListResponse,
  AdministrativeSolicitationMetadata,
  AdministrativeTransitionStatus,
  SolicitationStatus,
} from '@/types/solicitation'
import { invalidateDashboardCache } from '@/services/dashboardService'

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

const ADMIN_LIST_FRESH_MS = 30 * 1000
const ADMIN_LIST_STALE_MS = 5 * 60 * 1000
const ADMIN_METADATA_FRESH_MS = 60 * 1000
const READ_RETRY_DELAY_MS = 250

const adminListCache = new Map<string, {
  value: AdministrativeSolicitationListResponse
  freshUntil: number
  staleUntil: number
}>()
const adminListRequests = new Map<string, Promise<AdministrativeSolicitationListResponse>>()
let metadataCache: { value: AdministrativeSolicitationMetadata; expiresAt: number } | null = null
let metadataRequest: Promise<AdministrativeSolicitationMetadata> | null = null
let bypassNextAdminListEdgeCache = false
let bypassNextMetadataEdgeCache = false

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

function normalizeReadError(error: unknown): Error {
  if (error instanceof Error) return error
  return new SolicitationServiceError('Não foi possível conectar ao serviço de solicitações.')
}

function isRetriableReadError(error: unknown): boolean {
  if (!(error instanceof SolicitationServiceError)) return true
  return [
    'SOLICITATION_REQUEST_FAILED',
    'UPSTREAM_INVALID_RESPONSE',
    'INVALID_SOLICITATION_RESPONSE',
    'HTTP_502',
    'HTTP_503',
    'HTTP_504',
  ].includes(error.code)
}

function waitBeforeRetry(signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'))
      return
    }

    const timeout = window.setTimeout(resolve, READ_RETRY_DELAY_MS)
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timeout)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })
}

function edgeBypassUrl(url: string): string {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}_fresh=${Date.now()}`
}

async function getRequest<T>(
  url: string,
  signal?: AbortSignal,
  options?: { bypassEdgeCache?: boolean },
): Promise<T> {
  let lastError: unknown
  const requestUrl = options?.bypassEdgeCache ? edgeBypassUrl(url) : url

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: { accept: 'application/json' },
        signal,
      })
      return await parseResponse<T>(response)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      lastError = error instanceof SolicitationServiceError
        ? error
        : new SolicitationServiceError('Não foi possível conectar ao serviço de solicitações.')
      if (attempt === 0 && isRetriableReadError(lastError)) {
        await waitBeforeRetry(signal)
        continue
      }
      throw normalizeReadError(lastError)
    }
  }

  throw normalizeReadError(lastError)
}

function invalidateAdministrativeListCache() {
  adminListCache.clear()
  bypassNextAdminListEdgeCache = true
}

function invalidateAdministrativeMetadataCache() {
  metadataCache = null
  bypassNextMetadataEdgeCache = true
}

function invalidateMutationCaches() {
  invalidateAdministrativeListCache()
  invalidateDashboardCache()
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
  invalidateMutationCaches()
  return result
}

function isAmbiguousMutationResponse(error: unknown): error is SolicitationServiceError {
  return error instanceof SolicitationServiceError && (
    error.code === 'UPSTREAM_INVALID_RESPONSE' ||
    error.code === 'INVALID_SOLICITATION_RESPONSE'
  )
}

async function reconcileAmbiguousMutation<T>(
  error: unknown,
  idSolicitacao: string,
  persisted: (detail: AdministrativeSolicitationDetail) => boolean,
  result: (detail: AdministrativeSolicitationDetail) => T,
): Promise<T> {
  if (!isAmbiguousMutationResponse(error)) throw error

  try {
    const detail = await fetchAdministrativeSolicitationDetail(idSolicitacao)
    if (persisted(detail)) {
      invalidateMutationCaches()
      return result(detail)
    }
  } catch {
    // Se a leitura de confirmação também falhar, preserva o erro original da mutação.
  }

  throw error
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

function normalizeAdministrativeListQuery(
  queryOrLimit: AdministrativeSolicitationListQuery | number = {},
): AdministrativeSolicitationListQuery {
  return typeof queryOrLimit === 'number'
    ? { tamanhoPagina: queryOrLimit }
    : queryOrLimit
}

function requestAdministrativeSolicitations(
  key: string,
  query: AdministrativeSolicitationListQuery,
  bypassEdgeCache = false,
): Promise<AdministrativeSolicitationListResponse> {
  const request = getRequest<AdministrativeSolicitationListResponse>(
    buildAdministrativeListUrl(query),
    undefined,
    { bypassEdgeCache },
  )
    .then((value) => {
      const now = Date.now()
      adminListCache.set(key, {
        value,
        freshUntil: now + ADMIN_LIST_FRESH_MS,
        staleUntil: now + ADMIN_LIST_STALE_MS,
      })
      return value
    })
    .finally(() => {
      adminListRequests.delete(key)
    })

  adminListRequests.set(key, request)
  return request
}

export function getAdministrativeSolicitationsSnapshot(
  queryOrLimit: AdministrativeSolicitationListQuery | number = {},
): { value: AdministrativeSolicitationListResponse; isFresh: boolean } | null {
  const query = normalizeAdministrativeListQuery(queryOrLimit)
  const key = buildAdministrativeListUrl(query)
  const cached = adminListCache.get(key)
  const now = Date.now()

  if (!cached) return null
  if (cached.staleUntil <= now) {
    adminListCache.delete(key)
    return null
  }

  return {
    value: cached.value,
    isFresh: cached.freshUntil > now,
  }
}

export function fetchAdministrativeSolicitations(
  queryOrLimit: AdministrativeSolicitationListQuery | number = {},
  signal?: AbortSignal,
  options?: { force?: boolean },
): Promise<AdministrativeSolicitationListResponse> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))

  const query = normalizeAdministrativeListQuery(queryOrLimit)
  const key = buildAdministrativeListUrl(query)
  const snapshot = getAdministrativeSolicitationsSnapshot(query)
  const bypassEdgeCache = Boolean(options?.force || bypassNextAdminListEdgeCache)

  if (!options?.force && snapshot) {
    if (!snapshot.isFresh && !adminListRequests.has(key)) {
      void requestAdministrativeSolicitations(key, query).catch(() => undefined)
    }
    return Promise.resolve(snapshot.value)
  }

  if (bypassEdgeCache) bypassNextAdminListEdgeCache = false
  const sharedRequest = bypassEdgeCache
    ? requestAdministrativeSolicitations(key, query, true)
    : adminListRequests.get(key) || requestAdministrativeSolicitations(key, query)

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
    const bypassEdgeCache = bypassNextMetadataEdgeCache
    bypassNextMetadataEdgeCache = false
    metadataRequest = getRequest<AdministrativeSolicitationMetadata>(
      '/api/solicitacoes?metadata=1',
      signal,
      { bypassEdgeCache },
    )
      .then((value) => {
        metadataCache = {
          value,
          expiresAt: Date.now() + ADMIN_METADATA_FRESH_MS,
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

export async function registerAdministrativeAttendance(input: {
  idSolicitacao: string
  qtdComparecida: number
}): Promise<unknown> {
  try {
    return await postRequest('/api/comparecimento', input)
  } catch (error) {
    return reconcileAmbiguousMutation(
      error,
      input.idSolicitacao,
      (detail) => detail.status === 'ATENDIDA' && detail.qtdComparecida === input.qtdComparecida,
      (detail) => detail,
    )
  }
}

export async function updateAdministrativeSolicitationStatus(input: {
  idSolicitacao: string
  status: AdministrativeTransitionStatus
  motivo?: string
}): Promise<{
  idSolicitacao: string
  statusAnterior: SolicitationStatus
  status: SolicitationStatus
  alterado: boolean
}> {
  try {
    return await postRequest('/api/status-solicitacao', input)
  } catch (error) {
    return reconcileAmbiguousMutation(
      error,
      input.idSolicitacao,
      (detail) => detail.status === input.status,
      (detail) => ({
        idSolicitacao: detail.idSolicitacao,
        statusAnterior: detail.status,
        status: detail.status,
        alterado: false,
      }),
    )
  }
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

export async function deleteAdministrativeSolicitation(input: {
  idSolicitacao: string
  motivoExclusao: string
}): Promise<{
  idSolicitacao: string
  excluida: boolean
  excecoesJornadaExcluidas: number
}> {
  const result = await postRequest<{
    idSolicitacao: string
    excluida: boolean
    excecoesJornadaExcluidas: number
  }>('/api/exclusao-solicitacao', input)
  invalidateAdministrativeMetadataCache()
  return result
}
