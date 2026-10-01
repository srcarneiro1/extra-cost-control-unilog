'use client'

import { MetricCard, type MetricTone } from '@/features/dashboard/components/DashboardMetricCard'
import { currency, percent } from '@/features/dashboard/dashboardFormatters'
import type { DashboardResponse } from '@/types/dashboard'

export function AnalyticsSummary({ kpis }: { kpis: DashboardResponse['kpis'] }) {
  const differenceTone: MetricTone = !kpis.diferencaValor ? 'neutral' : kpis.diferencaValor > 0 ? 'danger' : 'success'
  const metaTone: MetricTone = kpis.atingimentoMetaPercentual == null ? 'neutral' : kpis.atingimentoMetaPercentual > 100 ? 'danger' : kpis.atingimentoMetaPercentual > 85 ? 'warning' : 'success'

  return (
    <div className="dashboard-analytics-summary">
      <MetricCard label="Solicitações analisadas" value={String(kpis.totalSolicitacoes)} detail="Após aplicação dos filtros" />
      <MetricCard label="Divergências de comparecimento" value={String(kpis.divergenciasComparecimento)} detail="Quantidade solicitada ≠ comparecida" tone={kpis.divergenciasComparecimento ? 'warning' : 'success'} />
      <MetricCard label="Desvio financeiro" value={currency(kpis.diferencaValor)} detail="Realizado − previsto" tone={differenceTone} />
      <MetricCard label="Atingimento da Meta MO" value={percent(kpis.atingimentoMetaPercentual)} detail="Meta global da competência" tone={metaTone} />
    </div>
  )
}
