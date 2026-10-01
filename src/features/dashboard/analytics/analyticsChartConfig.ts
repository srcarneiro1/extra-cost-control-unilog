export const ANALYTICS_PALETTE = {
  ink: '#242a36',
  graphite: '#494a56',
  graphiteSoft: '#8b9099',
  red: '#db0812',
  grid: '#eceef1',
  text: '#5f636b',
  muted: '#858a93',
  planned: '#d7dbe0',
}

export function analyticsCurrency(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

export function analyticsPercent(value: number | null | undefined) {
  if (value == null) return '—'
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}%`
}

export function analyticsShortLabel(value: string, max = 12) {
  const normalized = value.trim()
  return normalized.length <= max ? normalized : `${normalized.slice(0, Math.max(1, max - 1))}…`
}

export const analyticsBaseLegend = {
  labels: {
    color: ANALYTICS_PALETTE.text,
    boxWidth: 9,
    boxHeight: 9,
    usePointStyle: true,
    pointStyle: 'circle' as const,
    padding: 14,
    font: { size: 10, family: 'Inter, Roboto, Arial, sans-serif' },
  },
}

export const analyticsAxisTicks = {
  color: ANALYTICS_PALETTE.muted,
  font: { size: 9, family: 'Inter, Roboto, Arial, sans-serif' },
}
