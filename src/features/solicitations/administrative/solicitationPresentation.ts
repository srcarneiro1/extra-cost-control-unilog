import type {
  AdministrativeSolicitationDetail,
  AdministrativeSolicitationListItem,
  SolicitationStatus,
} from '@/types/solicitation'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const quantity = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

export const monthLabels = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

export const statusFilterOptions = [
  { label: 'Todas as situações', value: 'TODOS' },
  { label: 'Rascunho', value: 'RASCUNHO' },
  { label: 'Enviada', value: 'ENVIADA' },
  { label: 'Em triagem', value: 'EM_TRIAGEM' },
  { label: 'Aguardando ajuste', value: 'AGUARDANDO_AJUSTE' },
  { label: 'Enviada ao fornecedor', value: 'ENVIADA_AO_FORNECEDOR' },
  { label: 'Em atendimento', value: 'EM_ATENDIMENTO' },
  { label: 'Atendida', value: 'ATENDIDA' },
  { label: 'Aguardando NF', value: 'AGUARDANDO_NF' },
  { label: 'Conferida', value: 'CONFERIDA' },
  { label: 'Encerrada', value: 'ENCERRADA' },
  { label: 'Fila: aguardando triagem', value: 'AGUARDANDO_TRIAGEM' },
  { label: 'Fila: aguardando realizado', value: 'AGUARDANDO_REALIZADO' },
  { label: 'Com divergência', value: 'COM_DIVERGENCIA' },
]

const STATUS_LABELS: Record<SolicitationStatus, string> = {
  RASCUNHO: 'Rascunho',
  ENVIADA: 'Enviada',
  EM_TRIAGEM: 'Em triagem',
  AGUARDANDO_AJUSTE: 'Aguardando ajuste',
  ENVIADA_AO_FORNECEDOR: 'Enviada ao fornecedor',
  EM_ATENDIMENTO: 'Em atendimento',
  ATENDIDA: 'Atendida',
  AGUARDANDO_NF: 'Aguardando NF',
  CONFERIDA: 'Conferida',
  ENCERRADA: 'Encerrada',
}

export const allPageSizeOptions = Array.from({ length: 19 }, (_, index) => 10 + index * 5)

export function currentPeriod() {
  const now = new Date()
  return { year: String(now.getFullYear()), month: String(now.getMonth() + 1).padStart(2, '0') }
}

export function formatMoney(value: number | null) {
  return value == null ? '—' : money.format(value)
}

export function formatQuantity(value: number | null) {
  return value == null ? '—' : quantity.format(value)
}

export function formatDate(value: string) {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

export function formatDateShort(value: string) {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year.slice(-2)}` : value
}

export function formatDateTime(value: string) {
  if (!value) return '—'
  const date = formatDate(value)
  const time = value.length >= 16 ? value.slice(11, 16) : ''
  return time ? `${date} ${time}` : date
}

export function typeLabel(value: string) {
  return value === 'MAO_DE_OBRA' ? 'Mão de obra' : 'Alimentação / Bebida'
}

export function statusInfo(item: AdministrativeSolicitationListItem) {
  if (item.status === 'AGUARDANDO_AJUSTE') return { label: STATUS_LABELS[item.status], severity: 'danger' as const }
  if (item.status === 'ENVIADA_AO_FORNECEDOR' || item.status === 'EM_ATENDIMENTO' || item.status === 'AGUARDANDO_NF') return { label: STATUS_LABELS[item.status], severity: 'warning' as const }
  if (item.status === 'ATENDIDA' || item.status === 'CONFERIDA' || item.status === 'ENCERRADA') return { label: STATUS_LABELS[item.status], severity: 'success' as const }
  if (item.status === 'EM_TRIAGEM') return { label: STATUS_LABELS[item.status], severity: 'info' as const }
  return { label: STATUS_LABELS[item.status], severity: 'secondary' as const }
}

function snackTotalQuantity(item: AdministrativeSolicitationListItem) {
  if (item.qtdAlimentacao == null && item.qtdBebida == null) return null
  return (item.qtdAlimentacao ?? 0) + (item.qtdBebida ?? 0)
}

export function requestedQuantityBody(item: AdministrativeSolicitationListItem) {
  return item.tipoSolicitacao === 'MAO_DE_OBRA'
    ? formatQuantity(item.qtdSolicitada)
    : formatQuantity(snackTotalQuantity(item))
}

export function consideredQuantityBody(item: AdministrativeSolicitationListItem) {
  return item.tipoSolicitacao === 'MAO_DE_OBRA'
    ? formatQuantity(item.qtdComparecida)
    : formatQuantity(snackTotalQuantity(item))
}

export function buildSupplierSummary(detail: AdministrativeSolicitationDetail) {
  const lines: string[] = [`Pedido para ${formatDateShort(detail.dataOperacional)}`]
  if (detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA') {
    const products: string[] = []
    if (detail.produtoAlimentacao && detail.qtdAlimentacao != null) {
      products.push(`${detail.qtdAlimentacao} ${detail.produtoAlimentacaoAplicado || detail.produtoAlimentacao}`)
    }
    if (detail.produtoBebida && detail.qtdBebida != null) {
      products.push(`${detail.qtdBebida} ${detail.produtoBebidaAplicado || detail.produtoBebida}`)
    }
    if (products.length) lines.push(products.join(' + '))
  } else {
    if (detail.qtdSolicitada != null && detail.funcao) lines.push(`${detail.qtdSolicitada} ${detail.funcao}`)
    if (detail.atividade) lines.push(`Atividade: ${detail.atividade}`)
    if (detail.turno) lines.push(`Turno: ${detail.turno}`)
  }
  if (detail.supervisor) lines.push(`Supervisor(a) ${detail.supervisor}`)
  return lines.join('\n')
}
