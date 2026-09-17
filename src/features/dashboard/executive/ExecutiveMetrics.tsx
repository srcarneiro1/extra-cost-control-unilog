'use client'

import { MetricCard, type MetricTone } from '@/features/dashboard/components/DashboardMetricCard'
import { currency, percent } from '@/features/dashboard/dashboardFormatters'
import type { DashboardResponse } from '@/types/dashboard'

export function ExecutiveMetrics({ kpis }: { kpis: DashboardResponse['kpis'] }) {
  const totalPlanned = kpis.previstoMaoObra + kpis.previstoLanches
  const totalReal = kpis.realizadoMaoObra + kpis.realizadoLanches
  const differenceTone: MetricTone = !kpis.diferencaValor ? 'neutral' : kpis.diferencaValor > 0 ? 'danger' : 'success'
  const metaTone: MetricTone = kpis.atingimentoMetaPercentual == null ? 'neutral' : kpis.atingimentoMetaPercentual > 100 ? 'danger' : kpis.atingimentoMetaPercentual > 85 ? 'warning' : 'success'

  return (
    <div className="dashboard-metrics-grid">
      <MetricCard label="Previsto · Mão de obra" value={currency(kpis.previstoMaoObra)} detail="Solicitações da competência" />
      <MetricCard label="Previsto · Lanches" value={currency(kpis.previstoLanches)} detail="Alimentação e bebida" />
      <MetricCard label="Realizado · Mão de obra" value={currency(kpis.realizadoMaoObra)} detail="Com comparecimento registrado" tone="info" />
      <MetricCard label="Realizado · Lanches" value={currency(kpis.realizadoLanches)} detail="Calculado pela solicitação" tone="info" />
      <MetricCard label="Diferença R$" value={currency(kpis.diferencaValor)} detail={`${currency(totalReal)} realizado vs. ${currency(totalPlanned)} previsto`} tone={differenceTone} />
      <MetricCard label="Diferença %" value={percent(kpis.diferencaPercentual)} detail="Realizado − previsto" tone={differenceTone} />
      <MetricCard label="Meta MO · Global" value={currency(kpis.metaMaoObra)} detail="Meta da competência, sem rateio por dimensão" tone="neutral" />
      <MetricCard label="Atingimento da Meta MO" value={percent(kpis.atingimentoMetaPercentual)} detail={`${kpis.totalSolicitacoes} solicitações · ${kpis.divergenciasComparecimento} divergência(s)`} tone={metaTone} />
    </div>
  )
}
