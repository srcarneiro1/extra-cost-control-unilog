const MONTHS = [
  ['01', 'Janeiro'], ['02', 'Fevereiro'], ['03', 'Março'], ['04', 'Abril'],
  ['05', 'Maio'], ['06', 'Junho'], ['07', 'Julho'], ['08', 'Agosto'],
  ['09', 'Setembro'], ['10', 'Outubro'], ['11', 'Novembro'], ['12', 'Dezembro'],
] as const

export function currency(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value)
}

export function compactCurrency(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export function quantity(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)
}

export function percent(value: number | null | undefined) {
  if (value == null) return '—'
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}%`
}

export function signedPercent(value: number | null | undefined) {
  if (value == null) return '—'
  const formatted = percent(Math.abs(value))
  if (value > 0) return `+${formatted}`
  if (value < 0) return `−${formatted}`
  return formatted
}

export function economyPercent(current: number, previous: number) {
  if (!previous) return null
  return ((previous - current) / previous) * 100
}

export function shortDate(value: string) {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

export function shortLabel(value: string, max = 18) {
  const normalized = value.trim()
  return normalized.length <= max ? normalized : `${normalized.slice(0, Math.max(1, max - 1))}…`
}

export function monthName(month: string) {
  return MONTHS.find(([value]) => value === month)?.[1] || month
}

export function competenceLabel(competence: string) {
  const [year, month] = competence.split('-')
  return `${monthName(month)}/${year}`
}
