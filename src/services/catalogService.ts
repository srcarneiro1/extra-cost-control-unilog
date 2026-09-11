import { invalidateDashboardCache } from './dashboardService'
import type {
  CatalogAdminScope,
  CatalogAdminScopeQuery,
  CatalogoAdminNomeApiResponse,
  CatalogoAdminNomeDto,
  CatalogosAdminApiResponse,
  CatalogosAdminDto,
  CatalogosAdminScopeApiResponse,
  CatalogosAdminScopeDto,
  CatalogosApiResponse,
  CatalogosDto,
  FeriadoAdminApiResponse,
  FeriadoAdminDto,
  FornecedorAdminApiResponse,
  FornecedorAdminDto,
  MetaMaoObraAdminApiResponse,
  MetaMaoObraAdminDto,
  ProdutoAdminApiResponse,
  ProdutoAdminDto,
  PrecoMaoObraAdminApiResponse,
  PrecoMaoObraAdminDto,
  PrecoProdutoAdminApiResponse,
  PrecoProdutoAdminDto,
  SaveCatalogoAdminNomeInput,
  SaveFeriadoAdminInput,
  SaveFornecedorAdminInput,
  SaveMetaMaoObraAdminInput,
  SaveProdutoAdminInput,
  SavePrecoMaoObraAdminInput,
  SavePrecoProdutoAdminInput,
} from '../types/catalog'

const CATALOGS_ENDPOINT = '/api/cadastros'
const ACTIVE_CATALOG_CACHE_MS = 5 * 60 * 1000
const ADMIN_CATALOG_CACHE_MS = 5 * 60 * 1000
const ADMIN_SCOPE_CACHE_MS = 5 * 60 * 1000

let activeCatalogCache: { value: CatalogosDto; expiresAt: number } | null = null
let activeCatalogRequest: Promise<CatalogosDto> | null = null
let adminCatalogCache: { value: CatalogosAdminDto; expiresAt: number } | null = null
let adminCatalogRequest: Promise<CatalogosAdminDto> | null = null
const adminScopeCache = new Map<string, { value: CatalogosAdminScopeDto; expiresAt: number }>()
const adminScopeRequests = new Map<string, Promise<CatalogosAdminScopeDto>>()

export class CatalogServiceError extends Error {
  readonly code: string
  readonly details?: unknown

  constructor(message: string, code = 'CATALOG_REQUEST_FAILED', details?: unknown) {
    super(message)
    this.name = 'CatalogServiceError'
    this.code = code
    this.details = details
  }
}

async function parseJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T
  } catch {
    throw new CatalogServiceError(
      'O serviço de cadastros retornou uma resposta inválida.',
      'INVALID_CATALOG_RESPONSE',
    )
  }
}

function throwApiError(
  response: Response,
  payload: { ok: boolean; error?: { message?: string; code?: string; details?: unknown } },
): never {
  throw new CatalogServiceError(
    payload.error?.message || 'Não foi possível processar os cadastros.',
    payload.error?.code || `HTTP_${response.status}`,
    payload.error?.details,
  )
}

function invalidateCatalogCaches() {
  activeCatalogCache = null
  adminCatalogCache = null
  adminScopeCache.clear()
}

async function postAdmin<T>(body: Record<string, unknown>): Promise<T> {
  let response: Response
  try {
    response = await fetch(CATALOGS_ENDPOINT, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch {
    throw new CatalogServiceError('Não foi possível conectar ao cadastro administrativo.')
  }

  const payload = await parseJson<
    { ok: true; data: T } |
    { ok: false; error: { message?: string; code?: string; details?: unknown } }
  >(response)
  if (!response.ok || !payload.ok) throwApiError(response, payload)

  invalidateCatalogCaches()
  invalidateDashboardCache()
  return payload.data
}

async function requestActiveCatalogos(): Promise<CatalogosDto> {
  let response: Response

  try {
    response = await fetch(CATALOGS_ENDPOINT, {
      method: 'GET',
      headers: { accept: 'application/json' },
    })
  } catch {
    throw new CatalogServiceError('Não foi possível conectar ao serviço de cadastros.')
  }

  const payload = await parseJson<CatalogosApiResponse>(response)
  if (!response.ok || !payload.ok) throwApiError(response, payload)

  activeCatalogCache = {
    value: payload.data,
    expiresAt: Date.now() + ACTIVE_CATALOG_CACHE_MS,
  }

  return payload.data
}

export function fetchCatalogos(signal?: AbortSignal): Promise<CatalogosDto> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))

  if (activeCatalogCache && activeCatalogCache.expiresAt > Date.now()) {
    return Promise.resolve(activeCatalogCache.value)
  }

  if (!activeCatalogRequest) {
    activeCatalogRequest = requestActiveCatalogos().finally(() => {
      activeCatalogRequest = null
    })
  }

  if (!signal) return activeCatalogRequest

  return Promise.race([
    activeCatalogRequest,
    new Promise<CatalogosDto>((_, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }),
  ])
}

function validateAdminCatalogos(data: CatalogosAdminDto): CatalogosAdminDto {
  const summary = data.resumoAtivos
  const hasSummary = Boolean(
    summary &&
    Number.isFinite(summary.operacoes) &&
    Number.isFinite(summary.supervisores) &&
    Number.isFinite(summary.fornecedores) &&
    Number.isFinite(summary.atividades) &&
    Number.isFinite(summary.funcoes) &&
    Number.isFinite(summary.produtos),
  )

  if (
    !hasSummary ||
    !Array.isArray(data.funcoes) ||
    !Array.isArray(data.fornecedores) ||
    !Array.isArray(data.produtos) ||
    !Array.isArray(data.precosMaoObra) ||
    !Array.isArray(data.precosProdutos)
  ) {
    throw new CatalogServiceError(
      'O backend de cadastros está desatualizado. Publique a versão do Apps Script compatível com o carregamento administrativo consolidado.',
      'CATALOG_ADMIN_VERSION_MISMATCH',
    )
  }

  return data
}

async function requestAdminCatalogos(): Promise<CatalogosAdminDto> {
  let response: Response

  try {
    response = await fetch(`${CATALOGS_ENDPOINT}?mode=admin`, {
      method: 'GET',
      headers: { accept: 'application/json' },
    })
  } catch {
    throw new CatalogServiceError('Não foi possível conectar ao cadastro administrativo.')
  }

  const payload = await parseJson<CatalogosAdminApiResponse>(response)
  if (!response.ok || !payload.ok) throwApiError(response, payload)

  const data = validateAdminCatalogos(payload.data)
  adminCatalogCache = {
    value: data,
    expiresAt: Date.now() + ADMIN_CATALOG_CACHE_MS,
  }
  return data
}

export function fetchCatalogosAdmin(signal?: AbortSignal): Promise<CatalogosAdminDto> {
  if (signal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))

  if (adminCatalogCache && adminCatalogCache.expiresAt > Date.now()) {
    return Promise.resolve(adminCatalogCache.value)
  }

  if (!adminCatalogRequest) {
    adminCatalogRequest = requestAdminCatalogos().finally(() => {
      adminCatalogRequest = null
    })
  }

  if (!signal) return adminCatalogRequest

  return Promise.race([
    adminCatalogRequest,
    new Promise<CatalogosAdminDto>((_, reject) => {
      signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }),
  ])
}

function adminScopeUrl(scope: CatalogAdminScope, query: CatalogAdminScopeQuery): string {
  const params = new URLSearchParams({ mode: 'admin', scope })
  if (query.pagina) params.set('pagina', String(query.pagina))
  if (query.tamanhoPagina) params.set('tamanhoPagina', String(query.tamanhoPagina))
  if (query.busca?.trim()) params.set('busca', query.busca.trim())
  return `${CATALOGS_ENDPOINT}?${params.toString()}`
}

async function requestAdminScope(
  key: string,
  scope: CatalogAdminScope,
  query: CatalogAdminScopeQuery,
): Promise<CatalogosAdminScopeDto> {
  let response: Response
  try {
    response = await fetch(adminScopeUrl(scope, query), {
      method: 'GET',
      headers: { accept: 'application/json' },
    })
  } catch {
    throw new CatalogServiceError('Não foi possível conectar ao cadastro administrativo.')
  }

  const payload = await parseJson<CatalogosAdminScopeApiResponse>(response)
  if (!response.ok || !payload.ok) throwApiError(response, payload)

  adminScopeCache.set(key, {
    value: payload.data,
    expiresAt: Date.now() + ADMIN_SCOPE_CACHE_MS,
  })
  return payload.data
}

export function fetchCatalogoAdminScope(
  scope: CatalogAdminScope,
  queryOrSignal: CatalogAdminScopeQuery | AbortSignal = {},
  signal?: AbortSignal,
): Promise<CatalogosAdminScopeDto> {
  const query = queryOrSignal instanceof AbortSignal ? {} : queryOrSignal
  const requestSignal = queryOrSignal instanceof AbortSignal ? queryOrSignal : signal

  if (requestSignal?.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'))

  const key = adminScopeUrl(scope, query)
  const cached = adminScopeCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value)

  let request = adminScopeRequests.get(key)
  if (!request) {
    request = requestAdminScope(key, scope, query).finally(() => {
      adminScopeRequests.delete(key)
    })
    adminScopeRequests.set(key, request)
  }

  if (!requestSignal) return request

  return Promise.race([
    request,
    new Promise<CatalogosAdminScopeDto>((_, reject) => {
      requestSignal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    }),
  ])
}

export function prefetchCatalogoAdminScope(scope: CatalogAdminScope): void {
  const key = adminScopeUrl(scope, {})
  const cached = adminScopeCache.get(key)
  if (cached && cached.expiresAt > Date.now()) return
  void fetchCatalogoAdminScope(scope).catch(() => undefined)
}

export async function saveOperacaoAdmin(input: SaveCatalogoAdminNomeInput): Promise<CatalogoAdminNomeDto> {
  return postAdmin<CatalogoAdminNomeDto>({ acao: 'SALVAR_OPERACAO', ...input })
}

export async function saveSupervisorAdmin(input: SaveCatalogoAdminNomeInput): Promise<CatalogoAdminNomeDto> {
  return postAdmin<CatalogoAdminNomeDto>({ acao: 'SALVAR_SUPERVISOR', ...input })
}

export async function saveFuncaoAdmin(input: SaveCatalogoAdminNomeInput): Promise<CatalogoAdminNomeDto> {
  return postAdmin<CatalogoAdminNomeDto>({ acao: 'SALVAR_FUNCAO', ...input })
}

export async function saveAtividadeAdmin(input: SaveCatalogoAdminNomeInput): Promise<CatalogoAdminNomeDto> {
  return postAdmin<CatalogoAdminNomeDto>({ acao: 'SALVAR_ATIVIDADE', ...input })
}

export async function saveFeriadoAdmin(input: SaveFeriadoAdminInput): Promise<FeriadoAdminDto> {
  return postAdmin<FeriadoAdminDto>({ acao: 'SALVAR_FERIADO', ...input })
}

export async function saveMetaMaoObraAdmin(input: SaveMetaMaoObraAdminInput): Promise<MetaMaoObraAdminDto> {
  return postAdmin<MetaMaoObraAdminDto>({ acao: 'SALVAR_META_MO', ...input })
}

export async function saveFornecedorAdmin(input: SaveFornecedorAdminInput): Promise<FornecedorAdminDto> {
  return postAdmin<FornecedorAdminDto>({ acao: 'SALVAR_FORNECEDOR', ...input })
}

export async function saveProdutoAdmin(input: SaveProdutoAdminInput): Promise<ProdutoAdminDto> {
  return postAdmin<ProdutoAdminDto>({ acao: 'SALVAR_PRODUTO', ...input })
}

export async function savePrecoMaoObraAdmin(input: SavePrecoMaoObraAdminInput): Promise<PrecoMaoObraAdminDto> {
  return postAdmin<PrecoMaoObraAdminDto>({ acao: 'SALVAR_PRECO_MO', ...input })
}

export async function savePrecoProdutoAdmin(input: SavePrecoProdutoAdminInput): Promise<PrecoProdutoAdminDto> {
  return postAdmin<PrecoProdutoAdminDto>({ acao: 'SALVAR_PRECO_PRODUTO', ...input })
}

export type _CatalogResponseGuards =
  | CatalogoAdminNomeApiResponse
  | FeriadoAdminApiResponse
  | MetaMaoObraAdminApiResponse
  | FornecedorAdminApiResponse
  | ProdutoAdminApiResponse
  | PrecoMaoObraAdminApiResponse
  | PrecoProdutoAdminApiResponse