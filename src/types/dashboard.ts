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

export interface DashboardProjection {
  totalDias: number
  diasDecorridos: number
  diasRestantes: number
  ritmoDiarioRealizado: number | null
  metaEsperadaAteHoje: number | null
  exposicaoConhecidaMaoObra: number
  projecaoTendenciaMaoObra: number | null
  projecaoFinalMaoObra: number | null
  percentualMetaProjetado: number | null
  desvioProjetadoMeta: number | null
}

export type DashboardMetaStatus = 'DENTRO_DA_META' | 'NO_LIMITE_DA_META' | 'FORA_DA_META' | 'SEM_PROJECAO'

export interface DashboardMetaAlert {
  status: DashboardMetaStatus
  titulo: string
  mensagem: string
  percentualMetaProjetado: number | null
  desvioProjetadoMeta: number | null
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

export interface DashboardProjectionPoint {
  data: string
  realizadoAcumulado: number | null
  metaEsperada: number | null
  projecao: number | null
}

export interface DashboardResponse {
  competencia: string
  periodoInicio: string
  periodoFim: string
  metaEscopo: 'GLOBAL_COMPETENCIA'
  filtros: DashboardFilterOptions
  kpis: DashboardKpis
  projecao: DashboardProjection
  alertaMeta: DashboardMetaAlert
  porTipo: DashboardBreakdownItem[]
  porOperacao: DashboardBreakdownItem[]
  porFornecedor: DashboardBreakdownItem[]
  porSupervisor: DashboardBreakdownItem[]
  porResponsavelCusto: DashboardBreakdownItem[]
  porAtividade: DashboardBreakdownItem[]
  evolucaoDiaria: DashboardDailyItem[]
  evolucaoMetaProjecao: DashboardProjectionPoint[]
}
