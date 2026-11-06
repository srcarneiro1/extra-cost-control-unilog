// Chamadas da tela aberta de solicitação (sem login) — rota pública /api/publico/solicitacao.
export type PublicOptions = {
  supervisores: string[]
  operacoes: string[]
  atividades: string[]
  funcoes: string[]
  turnos: string[]
  alimentacao: string[]
  bebidas: string[]
  responsaveis: Array<{ nome: string; exigeCentroCusto: boolean }>
  centros: Array<{ codigo: string; descricao: string }>
  vinculos: Record<string, string[]>
}

export type PublicProtocol = { tipoSolicitacao: 'MAO_DE_OBRA' | 'ALIMENTACAO_BEBIDA'; idSolicitacao: string; jaRegistrado: boolean }

export type PublicSubmission = {
  idEnvio: string
  abertoEm: number
  site: string
  nomeSolicitante: string
  supervisor: string
  operacao: string
  dataOperacional: string
  justificativa: string
  responsavelCusto: string
  centroCusto: string
  maoDeObra: null | { atividade: string; funcao: string; turno: string; quantidade: string; volumeReferencia: string; unidadeVolume: string }
  alimentacao: null | { produtoAlimentacao: string; qtdAlimentacao: string; produtoBebida: string; qtdBebida: string }
}

async function readJson<T>(response: Response): Promise<T> {
  let payload: { ok?: boolean; data?: T; error?: { message?: string } } = {}
  try {
    payload = await response.json()
  } catch {
    throw new Error('O serviço respondeu de forma inesperada. Tente novamente.')
  }
  if (!response.ok || !payload.ok) throw new Error(payload.error?.message || 'Não foi possível concluir a operação.')
  return payload.data as T
}

export async function fetchPublicOptions(): Promise<PublicOptions> {
  return readJson<PublicOptions>(await fetch('/api/publico/solicitacao', { headers: { accept: 'application/json' } }))
}

export async function sendPublicRequest(body: PublicSubmission): Promise<PublicProtocol[]> {
  const data = await readJson<{ protocolos: PublicProtocol[] }>(await fetch('/api/publico/solicitacao', {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json' },
    body: JSON.stringify(body),
  }))
  return data.protocolos || []
}

export function newSendId(): string {
  const random = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
  return random.replace(/[^A-Za-z0-9-]/g, '').slice(0, 64)
}
