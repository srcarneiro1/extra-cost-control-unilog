export type UserProfile = 'OWNER' | 'ADMINISTRATIVO' | 'OPERACIONAL'

export interface ManagedUser {
  email: string
  nome: string
  perfil: UserProfile
  operacao: string
  ativo: boolean
  senhaConfigurada: boolean
  ultimaAlteracao: string
}

interface ApiSuccess<T> { ok: true; data: T }
interface ApiFailure { ok: false; error?: { code?: string; message?: string } }
type ApiResponse<T> = ApiSuccess<T> | ApiFailure

async function parse<T>(response: Response): Promise<T> {
  let payload: ApiResponse<T>
  try {
    payload = (await response.json()) as ApiResponse<T>
  } catch {
    throw new Error('O serviço de usuários retornou uma resposta inválida.')
  }
  if (!response.ok || !payload.ok) {
    throw new Error(payload.ok ? 'Não foi possível concluir a operação.' : payload.error?.message || 'Não foi possível concluir a operação.')
  }
  return payload.data
}

export async function fetchUsers(signal?: AbortSignal): Promise<ManagedUser[]> {
  const response = await fetch('/api/usuarios', {
    method: 'GET',
    headers: { accept: 'application/json' },
    signal,
  })
  return parse<ManagedUser[]>(response)
}

export async function saveUser(input: {
  email: string
  nome: string
  perfil: UserProfile
  operacao: string
  ativo: boolean
  password?: string
}): Promise<ManagedUser> {
  const response = await fetch('/api/usuarios', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ acao: 'SALVAR', ...input }),
  })
  return parse<ManagedUser>(response)
}

export async function resetUserPassword(email: string, password: string): Promise<ManagedUser> {
  const response = await fetch('/api/usuarios', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: JSON.stringify({ acao: 'REDEFINIR_SENHA', email, password }),
  })
  return parse<ManagedUser>(response)
}
