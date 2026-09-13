export type FinancialCloseoutStatus =
  | 'EM_ACOMPANHAMENTO'
  | 'AGUARDANDO_NF'
  | 'CONFERIDA'
  | 'ENCERRADA'

export type ReconciliationResult = '' | 'OK' | 'COM_AJUSTE' | 'COM_DIVERGENCIA'

export interface FinancialCloseoutPendingBreakdown {
  semFornecedor: number
  semValorReal: number
  statusNaoConcluido: number
}

export interface FinancialCloseoutGroup {
  competencia: string
  fornecedor: string
  totalSolicitacoes: number
  prontas: number
  pendentes: number
  valorRealAcumulado: number
  statusFechamento: FinancialCloseoutStatus
  idFechamento: string | null
  valorFechado: number | null
  qtdFechada: number | null
  dataFechamento: string
  resultadoConciliacao: ReconciliationResult
  podeFechar: boolean
  novasAposFechamento: number
  pendencias: FinancialCloseoutPendingBreakdown
}

export interface FinancialCloseoutSummary {
  fornecedores: number
  solicitacoes: number
  prontas: number
  pendentes: number
  valorReal: number
  aguardandoNf: number
  conferidos: number
  encerrados: number
}

export interface FinancialCloseoutListResponse {
  competencia: string
  resumo: FinancialCloseoutSummary
  grupos: FinancialCloseoutGroup[]
}

export interface FinancialCloseoutMetadata {
  competenciaAtual: string
  competencias: string[]
}

export interface FinancialCloseoutMutationResult {
  idFechamento: string
  competencia: string
  fornecedor: string
  statusFechamento: 'AGUARDANDO_NF'
  qtdSolicitacoes: number
  valorControle: number
  dataFechamento: string
}
