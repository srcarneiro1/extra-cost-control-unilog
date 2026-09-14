export type AuthProvider = 'session' | 'test'

export interface AuthUser {
  email: string
  name: string
  profile: string
  operation: string
  provider: AuthProvider
}

interface ApiSuccess<T> {
  ok: true
  data: T
}

interface ApiFailure {
  ok: false
  error?: {
    code?: string
    message?: string
  }
}

type ApiResponse<T> = ApiSuccess<T> | ApiFailure

export class AuthServiceError extends Error {
  readonly code: string

  constructor(message: string, code = 'AUTH_ERROR') {
    super(message)
    this.name = 'AuthServiceError'
    this.code = code
  }
}

async function parse<T>(response: Response, fallback: string): Promise<T> {
  let payload: ApiResponse<T>

  try {
    payload = (await response.json()) as ApiResponse<T>
  } catch {
    throw new AuthServiceError('O serviço de acesso retornou uma resposta inválida.', 'INVALID_AUTH_RESPONSE')
  }

  if (!response.ok || !payload.ok) {
    const error = payload.ok ? undefined : payload.error
    throw new AuthServiceError(error?.message || fallback, error?.code || `HTTP_${response.status}`)
  }

  return payload.data
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export async function getCurrentUser(signal?: AbortSignal): Promise<AuthUser | null> {
  let response: Response

  try {
    response = await fetch('/api/auth/me', {
      method: 'GET',
      headers: { accept: 'application/json' },
      signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new AuthServiceError('Não foi possível verificar sua sessão.')
  }

  if (response.status === 401) return null
  return parse<AuthUser>(response, 'Não foi possível verificar sua sessão.')
}

async function loginOnce(email: string, password: string): Promise<AuthUser> {
  let response: Response

  try {
    response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    })
  } catch {
    throw new AuthServiceError('Não foi possível conectar ao serviço de acesso.')
  }

  return parse<AuthUser>(response, 'E-mail ou senha inválidos.')
}

export async function login(email: string, password: string): Promise<AuthUser> {
  try {
    return await loginOnce(email, password)
  } catch (error) {
    const shouldRetry =
      error instanceof AuthServiceError &&
      (error.code === 'AUTH_INVALID_RESPONSE' || error.code === 'INVALID_AUTH_RESPONSE')

    if (!shouldRetry) throw error

    await delay(200)
    return loginOnce(email, password)
  }
}

export async function logout(_user?: AuthUser | null): Promise<void> {
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: { accept: 'application/json' },
  })
}
