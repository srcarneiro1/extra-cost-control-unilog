import type {
  CatalogosAdminApiResponse,
  CatalogosAdminDto,
  CatalogosApiResponse,
  CatalogosDto,
  FornecedorAdminApiResponse,
  FornecedorAdminDto,
  ProdutoAdminApiResponse,
  ProdutoAdminDto,
  PrecoMaoObraAdminApiResponse,
  PrecoMaoObraAdminDto,
  PrecoProdutoAdminApiResponse,
  PrecoProdutoAdminDto,
  SaveFornecedorAdminInput,
  SaveProdutoAdminInput,
  SavePrecoMaoObraAdminInput,
  SavePrecoProdutoAdminInput,
} from '../types/catalog'

const CATALOGS_ENDPOINT = '/api/cadastros'

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

  const payload = await parseJson<{ ok: true; data: T } | { ok: false; error: { message?: string; code?: string; details?: unknown } }>(response)
  if (!response.ok || !payload.ok) throwApiError(response, payload)
  return payload.data
}

export async function fetchCatalogos(signal?: AbortSignal): Promise<CatalogosDto> {
  let response: Response

  try {
    response = await fetch(CATALOGS_ENDPOINT, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new CatalogServiceError('Não foi possível conectar ao serviço de cadastros.')
  }

  const payload = await parseJson<CatalogosApiResponse>(response)
  if (!response.ok || !payload.ok) throwApiError(response, payload)
  return payload.data
}

export async function fetchCatalogosAdmin(signal?: AbortSignal): Promise<CatalogosAdminDto> {
  let response: Response

  try {
    response = await fetch(`${CATALOGS_ENDPOINT}?mode=admin`, {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new CatalogServiceError('Não foi possível conectar ao cadastro administrativo.')
  }

  const payload = await parseJson<CatalogosAdminApiResponse>(response)
  if (!response.ok || !payload.ok) throwApiError(response, payload)

  const data = payload.data
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
  | FornecedorAdminApiResponse
  | ProdutoAdminApiResponse
  | PrecoMaoObraAdminApiResponse
  | PrecoProdutoAdminApiResponse
