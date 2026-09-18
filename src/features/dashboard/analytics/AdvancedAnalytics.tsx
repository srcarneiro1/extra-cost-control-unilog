'use client'

import type { CSSProperties } from 'react'
import { Card } from 'primereact/card'
import { Chart } from 'primereact/chart'
import { Tag } from 'primereact/tag'
import type { DashboardAnalytics, DashboardResponse } from '@/types/dashboard'
import { AnalyticsCardHeader, AnalyticsMetric } from '@/features/dashboard/analytics/AnalyticsPrimitives'
import { ParetoChart, SupervisorRanking, WeekdayChart } from '@/features/dashboard/analytics/AnalyticsCharts'
import {
  ANALYTICS_PALETTE as PALETTE,
  analyticsAxisTicks as axisTicks,
  analyticsCurrency as currency,
  analyticsPercent as percent,
} from '@/features/dashboard/analytics/analyticsChartConfig'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

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

function Heatmap({ analytics }: { analytics: DashboardAnalytics }) {
  const rows = analytics.matrizOperacaoDiaSemana.slice(0, 8)
  const max = Math.max(...rows.flatMap((row) => row.valores), 1)

  return (
    <Card className="dashboard-card analytics-viz-card nx-analytics-card nx-heatmap-card">
      <AnalyticsCardHeader eyebrow="PADRÃO DE SOLICITAÇÕES" title="Depositante × dia da semana" description="Intensidade do custo realizado por combinação." />
      {rows.length ? (
        <div className="analytics-heatmap">
          <div className="analytics-heatmap-head"><span />{WEEKDAYS.map((day) => <strong key={day}>{day}</strong>)}</div>
          {rows.map((row) => (
            <div className="analytics-heatmap-row" key={row.operacao}>
              <strong>{row.operacao}</strong>
              {row.valores.map((value, index) => (
                <span key={`${row.operacao}-${index}`} style={{ '--heat': String(value / max) } as CSSProperties} title={`${row.operacao} · ${WEEKDAYS[index]}: ${currency(value)}`}>{value ? currency(value) : '—'}</span>
              ))}
            </div>
          ))}
        </div>
      ) : <div className="ui-empty-state"><div><strong>Sem matriz disponível</strong></div></div>}
    </Card>
  )
}

function LinearityScatter({ analytics }: { analytics: DashboardAnalytics }) {
  const items = analytics.linearidadeOperacao.slice(0, 10)
  const chartData = {
    datasets: [{
      label: 'Depositantes',
      data: items.map((item) => ({ x: item.indiceLinearidade, y: item.custo, operation: item.operacao, requests: item.solicitacoes, cv: item.coeficienteVariacao })),
      backgroundColor: PALETTE.graphite,
      borderColor: '#fff',
      borderWidth: 2,
      pointRadius: items.map((item) => 5 + Math.min(item.solicitacoes, 18) * .55),
      pointHoverRadius: items.map((item) => 7 + Math.min(item.solicitacoes, 18) * .55),
      pointHoverBackgroundColor: PALETTE.red,
    }],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    layout: { padding: { top: 4, right: 6, bottom: 4, left: 4 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: PALETTE.ink,
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 10,
        callbacks: {
          title: (contexts: any[]) => contexts[0]?.raw?.operation || '',
          label: (context: any) => [`Custo: ${currency(context.raw.y)}`, `Linearidade: ${percent(context.raw.x)}`, `Solicitações: ${context.raw.requests}`, `CV: ${percent(context.raw.cv)}`],
        },
      },
    },
    scales: {
      x: {
        min: 0,
        max: 100,
        title: { display: true, text: 'Índice de linearidade', color: PALETTE.text, font: { size: 10, weight: 'bold' as const } },
        grid: { color: PALETTE.grid },
        border: { display: false },
        ticks: { ...axisTicks, padding: 5, callback: (value: any) => `${value}%` },
      },
      y: {
        beginAtZero: true,
        title: { display: true, text: 'Custo realizado', color: PALETTE.text, font: { size: 10, weight: 'bold' as const } },
        grid: { color: PALETTE.grid },
        border: { display: false },
        ticks: { ...axisTicks, padding: 5, callback: (value: any) => currency(Number(value)) },
      },
    },
  }

  return (
    <Card className="dashboard-card analytics-viz-card nx-analytics-card nx-chart-card">
      <AnalyticsCardHeader eyebrow="LINEARIDADE × CUSTO" title="Regularidade da demanda × impacto" description="Tamanho da bolha representa a quantidade de solicitações. Toque ou passe o cursor para ver o depositante." />
      {items.length ? <div className="nx-chart-stage nx-chart-stage-scatter"><Chart type="scatter" data={chartData} options={options} /></div> : <div className="ui-empty-state"><div><strong>Sem dados de linearidade</strong></div></div>}
    </Card>
  )
}

function severityInfo(value: string) {
  const normalized = value.toUpperCase()
  if (normalized === 'ALTA') return { label: 'Alta prioridade', severity: 'danger' as const }
  if (normalized === 'MEDIA' || normalized === 'MÉDIA') return { label: 'Atenção', severity: 'warning' as const }
  return { label: 'Informativo', severity: 'secondary' as const }
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

      <Card className="dashboard-card analytics-opportunities-card nx-analytics-card">
        <AnalyticsCardHeader eyebrow="OPORTUNIDADES DE REDUÇÃO" title="Achados baseados em evidências" description="Fato observado, evidência e ação recomendada. Economia não é estimada sem regra validada." />
        {analytics.oportunidades.length ? (
          <div className="analytics-opportunities nx-opportunity-list">
            {analytics.oportunidades.map((item, index) => {
              const severity = severityInfo(item.severidade)
              return (
                <article className="analytics-opportunity nx-opportunity-card" key={`${index}-${item.titulo}`}>
                  <span className="nx-opportunity-index">{index + 1}</span>
                  <div className="nx-opportunity-copy">
                    <div className="nx-opportunity-title-row">
                      <strong>{item.titulo}</strong>
                      <Tag value={severity.label} severity={severity.severity} rounded />
                    </div>
                    <p>{item.evidencia}</p>
                    <small><strong>Ação recomendada:</strong> {item.acao}</small>
                  </div>
                </article>
              )
            })}
          </div>
        ) : <div className="ui-empty-state"><div><strong>Nenhum achado relevante neste recorte</strong></div></div>}
      </Card>
    </div>
  )
}
