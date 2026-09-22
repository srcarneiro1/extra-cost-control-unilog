import type { CategoriaProduto, FornecedorAdminDto, TipoDia } from '@/types/catalog'
import type { CatalogSection } from '@/features/catalogs/administrative/catalogAdminModel'

export function destinationLabel(item: FornecedorAdminDto) {
  if (item.whatsappDestino === 'NUMERO' && item.whatsappNumero) return `Número · ${item.whatsappNumero}`
  if (item.whatsappDestino === 'GRUPO' && item.whatsappGrupoLink) return 'Grupo · link configurado'
  return 'Não configurado'
}

export function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
}

export function dateLabel(value: string) {
  if (!value) return 'Em aberto'
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

export function competenceLabel(value: string) {
  if (!value) return '—'
  const [year, month] = value.split('-')
  return year && month ? `${month}/${year}` : value
}

export function dayTypeLabel(value: TipoDia) {
  if (value === 'SABADO') return 'Sábado'
  if (value === 'DOMINGO_FERIADO') return 'Domingo / feriado'
  return 'Dia útil'
}

export function categoryLabel(value: CategoriaProduto) {
  return value === 'BEBIDA' ? 'Bebida' : 'Alimentação'
}

export function priceStatus(item: { ativo: boolean; vigenciaFim: string }) {
  if (!item.ativo) return { label: 'Inativo', tone: 'neutral' as const }
  if (item.vigenciaFim) return { label: 'Histórico', tone: 'neutral' as const }
  return { label: 'Vigente', tone: 'success' as const }
}

export function isPriceSection(section: CatalogSection) {
  return section === 'PRECOS_MO' || section === 'PRECOS_PRODUTOS'
}

export function isNamedSection(section: CatalogSection) {
  return section === 'OPERACOES' || section === 'SUPERVISORES' || section === 'FUNCOES' || section === 'ATIVIDADES'
}

export function namedSectionLabel(section: CatalogSection) {
  if (section === 'OPERACOES') return 'Operação'
  if (section === 'SUPERVISORES') return 'Supervisor'
  if (section === 'FUNCOES') return 'Função'
  return 'Atividade'
}

export function namedOptions(items: Array<{ nome: string }>, emptyLabel = 'Selecione') {
  return [{ label: emptyLabel, value: '' }, ...items.map((item) => ({ label: item.nome, value: item.nome }))]
}
