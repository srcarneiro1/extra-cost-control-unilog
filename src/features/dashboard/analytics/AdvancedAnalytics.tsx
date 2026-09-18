'use client'

import type { DashboardAnalytics, DashboardResponse } from '@/types/dashboard'
import { AnalyticsCardHeader, AnalyticsMetric } from '@/features/dashboard/analytics/AnalyticsPrimitives'
import { ParetoChart, SupervisorRanking, WeekdayChart } from '@/features/dashboard/analytics/AnalyticsCharts'
import { Heatmap, LinearityScatter } from '@/features/dashboard/analytics/AnalyticsDetailVisuals'
import { AnalyticsOpportunities } from '@/features/dashboard/analytics/AnalyticsOpportunities'
import {
  analyticsCurrency as currency,
  analyticsPercent as percent,
} from '@/features/dashboard/analytics/analyticsChartConfig'

function emptyAnalytics(): DashboardAnalytics {
  return {
    diasSemana: [],
    paretoOperacao: [],
    concentracaoTop5Percentual: 0,
    concentracaoTop5Valor: 0,
    matrizOperacaoDiaSemana: [],
    linearidadeOperacao: [],
    maiorDesvio: null,
    oportunidades: [],
    potencialReducao: null,
    metodologiaPotencialReducao: '',
  }
}

export function AdvancedAnalytics({ data }: { data: DashboardResponse }) {
  const analytics = data.analytics || emptyAnalytics()
  const topDay = analytics.diasSemana.reduce((best, item) => (!best || item.realizado > best.realizado ? item : best), analytics.diasSemana[0])
  const topOperation = analytics.paretoOperacao[0]
  const topSupervisor = data.porSupervisor[0]

  return (
    <div className="advanced-analytics-grid">
      <div className="dashboard-analytics-summary analytics-summary-five">
        <AnalyticsMetric label="Dia mais impactante" value={topDay?.chave || '—'} detail={topDay ? currency(topDay.realizado) : 'Sem movimento'} tone="info" />
        <AnalyticsMetric label="Depositante líder" value={topOperation?.chave || '—'} detail={topOperation ? `${currency(topOperation.realizado)} · ${percent(topOperation.percentual)}` : 'Sem dados'} />
        <AnalyticsMetric label="Supervisor líder" value={topSupervisor?.chave || '—'} detail={topSupervisor ? currency(topSupervisor.realizado) : 'Sem dados'} />
        <AnalyticsMetric label="Concentração Top 5" value={percent(analytics.concentracaoTop5Percentual)} detail={currency(analytics.concentracaoTop5Valor)} tone="warning" />
        <AnalyticsMetric label="Maior desvio" value={analytics.maiorDesvio ? percent(analytics.maiorDesvio.diferencaPercentual) : '—'} detail={analytics.maiorDesvio ? `${analytics.maiorDesvio.chave} · ${currency(analytics.maiorDesvio.diferenca)}` : 'Sem desvio'} tone="danger" />
      </div>

      <div className="analytics-three-columns">
        <WeekdayChart analytics={analytics} />
        <ParetoChart analytics={analytics} />
        <SupervisorRanking data={data} />
      </div>

      <div className="dashboard-two-columns">
        <Heatmap analytics={analytics} />
        <LinearityScatter analytics={analytics} />
      </div>

      <AnalyticsOpportunities analytics={analytics} />
    </div>
  )
}
