import type {
  CatalogosAdminApiResponse,
  CatalogosAdminDto,
  CatalogosApiResponse,
  CatalogosDto,
  FornecedorAdminApiResponse,
  FornecedorAdminDto,
  SaveFornecedorAdminInput,
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

export async function fetchCatalogos(signal?: AbortSignal): Promise<CatalogosDto> {
  let response: Response

  try {
    response = await fetch(CATALOGS_ENDPOINT, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    throw new CatalogServiceError('Não foi possível conectar ao serviço de cadastros.')
  }

  const payload = await parseJson<CatalogosApiResponse>(response)

  if (!response.ok || !payload.ok) {
    throwApiError(response, payload)
  }

  return payload.data
}

export async function fetchCatalogosAdmin(signal?: AbortSignal): Promise<CatalogosAdminDto> {
  let response: Response

  try {
    response = await fetch(`${CATALOGS_ENDPOINT}?mode=admin`, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      },
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error
    }

    throw new CatalogServiceError('Não foi possível conectar ao cadastro administrativo.')
  }

  const payload = await parseJson<CatalogosAdminApiResponse>(response)
  if (!response.ok || !payload.ok) {
    throwApiError(response, payload)
  }

  return payload.data
}

export async function saveFornecedorAdmin(
  input: SaveFornecedorAdminInput,
): Promise<FornecedorAdminDto> {
  let response: Response

  try {
    response = await fetch(CATALOGS_ENDPOINT, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        acao: 'SALVAR_FORNECEDOR',
        ...input,
      }),
    })
  } catch {
    throw new CatalogServiceError('Não foi possível conectar ao cadastro administrativo.')
  }

  const payload = await parseJson<FornecedorAdminApiResponse>(response)
  if (!response.ok || !payload.ok) {
    throwApiError(response, payload)
  }

  return payload.data
}
