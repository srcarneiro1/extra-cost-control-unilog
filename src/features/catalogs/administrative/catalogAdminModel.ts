import type { CategoriaProduto, TipoDia, WhatsappDestino } from '@/types/catalog'

export type CatalogSection = 'OPERACOES' | 'SUPERVISORES' | 'FUNCOES' | 'ATIVIDADES' | 'FERIADOS' | 'METAS' | 'FORNECEDORES' | 'PRODUTOS' | 'PRECOS_MO' | 'PRECOS_PRODUTOS'
export type NamedDraft = { nome: string; ativo: boolean }
export type HolidayDraft = { data: string; denominacao: string; tipo: string; municipio: string; uf: string; ativo: boolean; fonte: string }
export type GoalDraft = { competencia: string; valor: string }
export type ProviderDraft = {
  nome: string
  maoDeObra: boolean
  alimentacao: boolean
  ativo: boolean
  whatsappDestino: WhatsappDestino
  whatsappNumero: string
  whatsappGrupoLink: string
}
export type ProductDraft = { nome: string; categoria: CategoriaProduto; ativo: boolean }
export type LaborPriceDraft = {
  fornecedor: string
  funcao: string
  turno: 'DIURNO' | 'NOTURNO'
  tipoDia: TipoDia
  vigenciaInicio: string
  precoUnitario: string
}
export type ProductPriceDraft = { fornecedor: string; produto: string; vigenciaInicio: string; precoUnitario: string }

export const PRICE_PAGE_SIZE = 25

export const SECTION_ITEMS: Array<{ key: CatalogSection; label: string; icon: string }> = [
  { key: 'OPERACOES', label: 'Operações', icon: 'pi pi-building' },
  { key: 'SUPERVISORES', label: 'Supervisores', icon: 'pi pi-id-card' },
  { key: 'FUNCOES', label: 'Funções', icon: 'pi pi-users' },
  { key: 'ATIVIDADES', label: 'Atividades', icon: 'pi pi-list-check' },
  { key: 'FERIADOS', label: 'Feriados', icon: 'pi pi-calendar' },
  { key: 'METAS', label: 'Metas', icon: 'pi pi-flag' },
  { key: 'FORNECEDORES', label: 'Fornecedores', icon: 'pi pi-truck' },
  { key: 'PRODUTOS', label: 'Produtos', icon: 'pi pi-box' },
  { key: 'PRECOS_MO', label: 'Preços de mão de obra', icon: 'pi pi-wallet' },
  { key: 'PRECOS_PRODUTOS', label: 'Preços de produtos', icon: 'pi pi-tag' },
]

export const ACTIVE_OPTIONS = [
  { label: 'Ativo', value: true },
  { label: 'Inativo', value: false },
]

export const CATEGORY_OPTIONS = [
  { label: 'Alimentação', value: 'ALIMENTACAO' },
  { label: 'Bebida', value: 'BEBIDA' },
]

export const WHATSAPP_OPTIONS = [
  { label: 'Não configurado', value: 'NENHUM' },
  { label: 'Número', value: 'NUMERO' },
  { label: 'Grupo', value: 'GRUPO' },
]

export const TURN_OPTIONS = [
  { label: 'Diurno', value: 'DIURNO' },
  { label: 'Noturno', value: 'NOTURNO' },
]

export const DAY_TYPE_OPTIONS = [
  { label: 'Dia útil', value: 'UTIL' },
  { label: 'Sábado', value: 'SABADO' },
  { label: 'Domingo / feriado', value: 'DOMINGO_FERIADO' },
]

export const emptyNamedDraft = (): NamedDraft => ({ nome: '', ativo: true })
export const emptyHolidayDraft = (): HolidayDraft => ({ data: '', denominacao: '', tipo: 'FERIADO', municipio: 'SERRA', uf: 'ES', ativo: true, fonte: '' })
export const emptyGoalDraft = (): GoalDraft => ({ competencia: '', valor: '' })
export const emptyProviderDraft = (): ProviderDraft => ({
  nome: '',
  maoDeObra: true,
  alimentacao: false,
  ativo: true,
  whatsappDestino: 'NENHUM',
  whatsappNumero: '',
  whatsappGrupoLink: '',
})
export const emptyProductDraft = (): ProductDraft => ({ nome: '', categoria: 'ALIMENTACAO', ativo: true })
export const emptyLaborPriceDraft = (): LaborPriceDraft => ({
  fornecedor: '',
  funcao: '',
  turno: 'DIURNO',
  tipoDia: 'UTIL',
  vigenciaInicio: '',
  precoUnitario: '',
})
export const emptyProductPriceDraft = (): ProductPriceDraft => ({ fornecedor: '', produto: '', vigenciaInicio: '', precoUnitario: '' })
