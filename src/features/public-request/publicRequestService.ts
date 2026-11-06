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
  acordos?: Array<{ id: string; nome: string; operacao: string; vigenciaInicio: string; vigenciaFim: string; supervisores: string[] }>
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
  maoDeObra: null | { atividade: string; funcao: string; turno: string; quantidade: string; volumeReferencia: string; unidadeVolume: string; idAcordoIndicado: string }
  alimentacao: null | { produtoAlimentacao: string; qtdAlimentacao: string; produtoBebida: string; qtdBebida: string }
}

// Erro com código e referência (06/11/2026): o código diz em que ponto falhou; a referência é a
// mesma registrada no log do Cloudflare (Pages → Functions → Logs).
export class PublicRequestError extends Error {
  code: string
  requestId: string
  status: number
  at: Date
  constructor(message: string, code: string, requestId: string, status: number) {
    super(message)
    this.name = 'PublicRequestError'
    this.code = code
    this.requestId = requestId
    this.status = status
    this.at = new Date()
  }
}

async function readJson<T>(response: Response): Promise<T> {
  let payload: { ok?: boolean; data?: T; error?: { message?: string; code?: string; requestId?: string } } = {}
  const headerId = response.headers.get('x-request-id') || ''
  try {
    payload = await response.json()
  } catch {
    throw new PublicRequestError('O serviço respondeu de forma inesperada. Tente novamente.', `HTTP_${response.status}`, headerId, response.status)
  }
  if (!response.ok || !payload.ok) {
    throw new PublicRequestError(
      payload.error?.message || 'Não foi possível concluir a operação.',
      payload.error?.code || `HTTP_${response.status}`,
      payload.error?.requestId || headerId,
      response.status,
    )
  }
  return payload.data as T
}

async function request(url: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch {
    // Sem conexão do aparelho com o servidor (internet do celular, Wi-Fi, bloqueio de rede).
    throw new PublicRequestError('Sem conexão com o servidor. Verifique a internet e tente novamente.', 'SEM_INTERNET', '', 0)
  }
}

// Opções: uma nova tentativa automática após 1,5 s (leitura; a 1ª chamada após um tempo parado
// costuma falhar enquanto o Apps Script "acorda"). O ENVIO nunca é repetido automaticamente.
export async function fetchPublicOptions(): Promise<PublicOptions> {
  const once = async () => readJson<PublicOptions>(await request('/api/publico/solicitacao', { headers: { accept: 'application/json' } }))
  try {
    return await once()
  } catch (error) {
    if (error instanceof PublicRequestError && ['VALIDACAO', 'ANTI_ROBO', 'LIMITE_ENVIOS'].includes(error.code)) throw error
    await new Promise((resolve) => setTimeout(resolve, 1500))
    return once()
  }
}

export async function sendPublicRequest(body: PublicSubmission): Promise<PublicProtocol[]> {
  const data = await readJson<{ protocolos: PublicProtocol[] }>(await request('/api/publico/solicitacao', {
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
