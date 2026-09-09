export type DashboardTypeFilter = 'TODOS' | 'MAO_DE_OBRA' | 'ALIMENTACAO_BEBIDA'

export interface DashboardQuery {
  ano?: string
  mesCompetencia?: string
  operacao?: string
  supervisor?: string
  fornecedor?: string
  tipo?: DashboardTypeFilter
  responsavelCusto?: string
  atividade?: string
}

export interface DashboardFilterOptions {
  anos: string[]
  mesesCompetencia: string[]
  operacoes: string[]
  supervisores: string[]
  fornecedores: string[]
  responsaveisCusto: string[]
  atividades: string[]
}

export interface DashboardKpis {
  previstoMaoObra: number
  previstoLanches: number
  realizadoMaoObra: number
  realizadoLanches: number
  diferencaValor: number
  diferencaPercentual: number | null
  metaMaoObra: number | null
  atingimentoMetaPercentual: number | null
  totalSolicitacoes: number
  divergenciasComparecimento: number
}

export interface DashboardBreakdownItem {
  chave: string
  previsto: number
  realizado: number
  diferenca: number
  solicitacoes: number
}

export interface DashboardDailyItem {
  data: string
  previsto: number
  realizado: number
}

export interface DashboardResponse {
  competencia: string
  periodoInicio: string
  periodoFim: string
  metaEscopo: 'GLOBAL_COMPETENCIA'
  filtros: DashboardFilterOptions
  kpis: DashboardKpis
  porTipo: DashboardBreakdownItem[]
  porOperacao: DashboardBreakdownItem[]
  porFornecedor: DashboardBreakdownItem[]
  porSupervisor: DashboardBreakdownItem[]
  porResponsavelCusto: DashboardBreakdownItem[]
  porAtividade: DashboardBreakdownItem[]
  evolucaoDiaria: DashboardDailyItem[]
}
