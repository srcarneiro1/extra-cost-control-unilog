export type SolicitationType = 'MAO_DE_OBRA' | 'ALIMENTACAO_BEBIDA'

export type OperationalSolicitationStatus =
  | 'RASCUNHO'
  | 'ENVIADA'
  | 'EM_TRIAGEM'
  | 'AGUARDANDO_AJUSTE'
  | 'ENVIADA_AO_FORNECEDOR'
  | 'EM_ATENDIMENTO'
  | 'ATENDIDA'

export type FinancialSolicitationStatus =
  | 'AGUARDANDO_NF'
  | 'CONFERIDA'
  | 'ENCERRADA'

export type AdministrativeTransitionStatus =
  | OperationalSolicitationStatus
  | 'AGUARDANDO_NF'

export type SolicitationStatus =
  | OperationalSolicitationStatus
  | FinancialSolicitationStatus

export interface PartialShiftException {
  idExcecao: string
  nomeColaborador: string
  horasTrabalhadas: number | null
  horarioSaida: string
  motivo: string
  valorProporcional: number | null
  valorRegistrado: number | null
  dataRegistro: string
  usuarioAdministrativo: string
}

export interface AdministrativeSolicitationListItem {
  idSolicitacao: string
  tipoSolicitacao: SolicitationType
  dataCriacao: string
  usuarioCriacao: string
  supervisor: string
  operacao: string
  dataOperacional: string
  competencia: string
  fornecedor: string
  responsavelCusto: string
  funcao: string
  turno: string
  qtdSolicitada: number | null
  qtdComparecida: number | null
  produtoAlimentacao: string
  qtdAlimentacao: number | null
  produtoBebida: string
  qtdBebida: number | null
  valorPrevisto: number | null
  valorReal: number | null
  status: SolicitationStatus
  triagemConcluida: boolean
  realizadoRegistrado: boolean | null
  divergencia: boolean | null
}

export interface AdministrativeSolicitationSummary {
  total: number
  aguardandoTriagem: number
  aguardandoRealizado: number
  divergencias: number
}

export interface AdministrativeSolicitationListQuery {
  pagina?: number
  tamanhoPagina?: number
  busca?: string
  tipo?: string
  status?: string
  anoRegistro?: string
  mesRegistro?: string
  dataRegistro?: string
}

export interface AdministrativeSolicitationListResponse {
  total: number
  limite: number
  pagina: number
  tamanhoPagina: number
  totalPaginas: number
  resumo: AdministrativeSolicitationSummary | null
  itens: AdministrativeSolicitationListItem[]
}

export interface AdministrativeSolicitationMetadata {
  resumo: AdministrativeSolicitationSummary
  datasRegistro: string[]
}

export interface AdministrativeSolicitationDetail {
  idSolicitacao: string
  tipoSolicitacao: SolicitationType
  dataCriacao: string
  usuarioCriacao: string
  origem: string
  idOrigem: string
  loteImportacao: string
  supervisor: string
  operacao: string
  dataOperacional: string
  competencia: string
  fornecedor: string
  justificativa: string
  responsavelCusto: string
  centroCusto: string
  atividade: string
  funcao: string
  turno: string
  qtdSolicitada: number | null
  qtdComparecida: number | null
  volumeReferencia: unknown | null
  unidadeVolume: string
  precoUnitarioAplicado: number | null
  produtoAlimentacao: string
  qtdAlimentacao: number | null
  precoAlimentacaoAplicado: number | null
  valorAlimentacao: number | null
  produtoBebida: string
  qtdBebida: number | null
  precoBebidaAplicado: number | null
  valorBebida: number | null
  valorPrevisto: number | null
  valorReal: number | null
  produtoAlimentacaoAplicado: string
  produtoBebidaAplicado: string
  motivoAjusteProduto: string
  status: SolicitationStatus
  triagemConcluida: boolean
  realizadoRegistrado: boolean | null
  divergencia: boolean | null
  jornadaPadraoHoras: number | null
  excecoesJornada: PartialShiftException[]
}
