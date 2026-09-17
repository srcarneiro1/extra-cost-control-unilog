'use client'

import type { CSSProperties, ReactNode } from 'react'
import { Card } from 'primereact/card'
import { Chart } from 'primereact/chart'
import { Tag } from 'primereact/tag'
import type { DashboardAnalytics, DashboardResponse } from '@/types/dashboard'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

type AnalyticsMetricTone = 'neutral' | 'info' | 'warning' | 'danger'

const PALETTE = {
  ink: '#242a36',
  graphite: '#494a56',
  graphiteSoft: '#8b9099',
  red: '#db0812',
  grid: '#eceef1',
  text: '#5f636b',
  muted: '#858a93',
  planned: '#d7dbe0',
}

function currency(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

function percent(value: number | null | undefined) {
  if (value == null) return '—'
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}%`
}

function shortLabel(value: string, max = 12) {
  const normalized = value.trim()
  return normalized.length <= max ? normalized : `${normalized.slice(0, Math.max(1, max - 1))}…`
}

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

const baseLegend = {
  labels: {
    color: PALETTE.text,
    boxWidth: 9,
    boxHeight: 9,
    usePointStyle: true,
    pointStyle: 'circle' as const,
    padding: 14,
    font: { size: 10, family: 'Inter, Roboto, Arial, sans-serif' },
  },
}

const axisTicks = {
  color: PALETTE.muted,
  font: { size: 9, family: 'Inter, Roboto, Arial, sans-serif' },
}

function AnalyticsMetric({ label, value, detail, tone = 'neutral' }: {
  label: string
  value: string
  detail: string
  tone?: AnalyticsMetricTone
}) {
  return (
    <Card className={`dashboard-metric dashboard-metric-${tone} nx-dashboard-metric-card nx-analytics-metric`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </Card>
  )
}

function AnalyticsCardHeader({ eyebrow, title, description, trailing }: {
  eyebrow: string
  title: string
  description: string
  trailing?: ReactNode
}) {
  return (
    <div className="dashboard-card-header nx-chart-card-header">
      <div>
        <span className="ui-eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {trailing}
    </div>
  )
}

function WeekdayChart({ analytics }: { analytics: DashboardAnalytics }) {
  const items = analytics.diasSemana
  const maxValue = Math.max(...items.map((item) => item.realizado), 0)
  const peakIndex = items.findIndex((item) => item.realizado === maxValue)
  const chartData = {
    labels: items.map((item, index) => WEEKDAYS[index] || item.chave),
    datasets: [{
      label: 'Custo realizado',
      data: items.map((item) => item.realizado),
      backgroundColor: items.map((_, index) => index === peakIndex ? PALETTE.red : PALETTE.graphite),
      borderRadius: 7,
      borderSkipped: false,
      maxBarThickness: 42,
    }],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    layout: { padding: { top: 4, right: 4, bottom: 2, left: 2 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: PALETTE.ink,
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 10,
        callbacks: { label: (context: any) => ` ${currency(context.raw)}` },
      },
    },
    scales: {
      x: { grid: { display: false }, ticks: { ...axisTicks, padding: 6 }, border: { display: false } },
      y: {
        beginAtZero: true,
        grid: { color: PALETTE.grid },
        border: { display: false },
        ticks: { ...axisTicks, padding: 6, callback: (value: any) => currency(Number(value)) },
      },
    },
  }

  return (
    <Card className="dashboard-card analytics-viz-card nx-analytics-card nx-chart-card">
      <AnalyticsCardHeader eyebrow="DIA DA SEMANA" title="Impacto por dia da semana" description="Custo realizado agrupado pela data operacional." />
      {items.length ? <div className="nx-chart-stage"><Chart type="bar" data={chartData} options={options} /></div> : <div className="ui-empty-state"><div><strong>Sem dados no período</strong></div></div>}
    </Card>
  )
}

function ParetoChart({ analytics }: { analytics: DashboardAnalytics }) {
  const items = analytics.paretoOperacao.slice(0, 8)
  const chartData = {
    labels: items.map((item) => item.chave),
    datasets: [
      {
        type: 'bar' as const,
        label: 'Custo realizado',
        data: items.map((item) => item.realizado),
        backgroundColor: PALETTE.graphite,
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 24,
        yAxisID: 'y',
      },
      {
        type: 'line' as const,
        label: 'Participação acumulada',
        data: items.map((item) => item.acumulado),
        borderColor: PALETTE.red,
        backgroundColor: PALETTE.red,
        pointBackgroundColor: PALETTE.red,
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 5,
        tension: .28,
        yAxisID: 'y1',
      },
    ],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    interaction: { mode: 'index' as const, intersect: false },
    layout: { padding: { top: 4, right: 6, bottom: 10, left: 4 } },
    plugins: {
      legend: baseLegend,
      tooltip: {
        backgroundColor: PALETTE.ink,
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 10,
        callbacks: {
          title: (contexts: any[]) => items[contexts[0]?.dataIndex]?.chave || '',
          label: (context: any) => context.datasetIndex === 0 ? ` ${currency(context.raw)}` : ` ${percent(context.raw)}`,
        },
      },
    },
    scales: {
      x: {
        offset: true,
        grid: { display: false },
        border: { display: false },
        ticks: {
          ...axisTicks,
          autoSkip: false,
          minRotation: 22,
          maxRotation: 32,
          padding: 8,
          callback: (_value: any, index: number) => shortLabel(items[index]?.chave || '', 11),
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: PALETTE.grid },
        border: { display: false },
        ticks: { ...axisTicks, padding: 5, callback: (value: any) => currency(Number(value)) },
      },
      y1: {
        beginAtZero: true,
        max: 100,
        position: 'right' as const,
        grid: { drawOnChartArea: false },
        border: { display: false },
        ticks: { ...axisTicks, padding: 5, callback: (value: any) => `${value}%` },
      },
    },
  }

  return (
    <Card className="dashboard-card analytics-viz-card nx-analytics-card nx-chart-card">
      <AnalyticsCardHeader eyebrow="PARETO" title="Custo por depositante" description="Custo realizado e participação acumulada." trailing={<strong className="analytics-highlight">Top 5 {percent(analytics.concentracaoTop5Percentual)}</strong>} />
      {items.length ? <div className="nx-chart-stage nx-chart-stage-pareto"><Chart type="bar" data={chartData} options={options} /></div> : <div className="ui-empty-state"><div><strong>Sem dados para Pareto</strong></div></div>}
    </Card>
  )
}

function SupervisorRanking({ data }: { data: DashboardResponse }) {
  const items = data.porSupervisor.slice(0, 7)
  const chartData = {
    labels: items.map((item) => item.chave),
    datasets: [{
      label: 'Custo realizado',
      data: items.map((item) => item.realizado),
      backgroundColor: PALETTE.graphite,
      borderRadius: 6,
      borderSkipped: false,
      maxBarThickness: 22,
    }],
  }
  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    layout: { padding: { right: 6, left: 2 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: PALETTE.ink,
        titleColor: '#fff',
        bodyColor: '#fff',
        callbacks: {
          title: (contexts: any[]) => items[contexts[0]?.dataIndex]?.chave || '',
          label: (context: any) => ` ${currency(context.raw)}`,
        },
      },
    },
    scales: {
      x: { beginAtZero: true, grid: { color: PALETTE.grid }, border: { display: false }, ticks: { ...axisTicks, callback: (value: any) => currency(Number(value)) } },
      y: { grid: { display: false }, border: { display: false }, ticks: { ...axisTicks, callback: (_value: any, index: number) => shortLabel(items[index]?.chave || '', 18) } },
    },
  }

  return (
    <Card className="dashboard-card analytics-viz-card nx-analytics-card nx-chart-card">
      <AnalyticsCardHeader eyebrow="SUPERVISÃO" title="Custo por supervisor" description="Ranking do realizado no escopo filtrado." />
      {items.length ? <div className="nx-chart-stage"><Chart type="bar" data={chartData} options={options} /></div> : <div className="ui-empty-state"><div><strong>Sem dados por supervisor</strong></div></div>}
    </Card>
  )
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
