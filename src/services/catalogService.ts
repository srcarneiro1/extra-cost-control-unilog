import type { CatalogosApiResponse, CatalogosDto } from '../types/catalog'

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

  let payload: CatalogosApiResponse

  try {
    payload = (await response.json()) as CatalogosApiResponse
  } catch {
    throw new CatalogServiceError(
      'O serviço de cadastros retornou uma resposta inválida.',
      'INVALID_CATALOG_RESPONSE',
    )
  }

  if (!response.ok || !payload.ok) {
    const apiError = payload.ok ? null : payload.error

    throw new CatalogServiceError(
      apiError?.message || 'Não foi possível carregar os cadastros.',
      apiError?.code || `HTTP_${response.status}`,
      apiError?.details,
    )
  }

  return payload.data
}
