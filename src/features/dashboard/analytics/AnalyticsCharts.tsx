'use client'

import { Card } from 'primereact/card'
import { Chart } from 'primereact/chart'
import { AnalyticsCardHeader } from '@/features/dashboard/analytics/AnalyticsPrimitives'
import {
  ANALYTICS_PALETTE as PALETTE,
  analyticsAxisTicks as axisTicks,
  analyticsBaseLegend as baseLegend,
  analyticsCurrency as currency,
  analyticsPercent as percent,
  analyticsShortLabel as shortLabel,
} from '@/features/dashboard/analytics/analyticsChartConfig'
import type { DashboardAnalytics, DashboardResponse } from '@/types/dashboard'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export function WeekdayChart({ analytics }: { analytics: DashboardAnalytics }) {
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

// Pareto em lista horizontal (22/10/2026). O cartão ocupa 1/3 da largura: com barras verticais os
// nomes ficavam cortados e inclinados (dois "CAFFEINE B…" indistinguíveis), sem valores visíveis e a
// linha acumulada sem o primeiro ponto. Agora: nome completo, valor, participação e acumulado em
// cada linha; destaque dos depositantes que somam 80% do custo; demais agrupados.
// Top 5 (mesmo recorte do selo "Top 5"): mantém o cartão na altura dos vizinhos; o restante vai em "Demais".
const PARETO_LIMIT = 5
const PARETO_CUT = 80

export function ParetoChart({ analytics }: { analytics: DashboardAnalytics }) {
  const all = analytics.paretoOperacao || []
  const items = all.slice(0, PARETO_LIMIT)
  const rest = all.slice(PARETO_LIMIT)
  const restValue = rest.reduce((sum, item) => sum + item.realizado, 0)
  const restShare = rest.reduce((sum, item) => sum + item.percentual, 0)
  const maxValue = Math.max(...items.map((item) => item.realizado), 0)
  // Primeiro depositante em que o acumulado alcança 80%: ele e os anteriores são os "poucos que mais pesam".
  const cutIndex = items.findIndex((item) => item.acumulado >= PARETO_CUT)
  const vitalCount = cutIndex >= 0 ? cutIndex + 1 : items.length

  return (
    <Card className="dashboard-card analytics-viz-card nx-analytics-card nx-chart-card analytics-pareto-card">
      <AnalyticsCardHeader
        eyebrow="PARETO"
        title="Custo por depositante"
        description={cutIndex >= 0
          ? `${vitalCount} ${vitalCount === 1 ? 'depositante concentra' : 'depositantes concentram'} ${PARETO_CUT}% do custo realizado.`
          : 'Custo realizado, participação e acumulado.'}
        trailing={<strong className="analytics-highlight">Top 5 {percent(analytics.concentracaoTop5Percentual)}</strong>} />
      {items.length ? (
        <div className="pareto-body">
          <ol className="pareto-list">
            {items.map((item, index) => {
              const vital = index < vitalCount
              const width = maxValue > 0 ? Math.max(2, (item.realizado / maxValue) * 100) : 0
              return (
                <li key={item.chave} className={`pareto-row${vital ? ' is-vital' : ''}`}>
                  <div
                    className="pareto-row-main"
                    title={`${item.chave}\nRealizado: ${currency(item.realizado)}\nPrevisto: ${currency(item.previsto)}\nSolicitações: ${item.solicitacoes}`}
                  >
                    <span className="pareto-rank">{index + 1}</span>
                    <span className="pareto-name">{item.chave}</span>
                    <strong className="pareto-value">{currency(item.realizado)}</strong>
                  </div>
                  <div className="pareto-row-bar">
                    <span className="pareto-track"><span className="pareto-fill" style={{ width: `${width}%` }} /></span>
                    <span className="pareto-share">{percent(item.percentual)} <small>· acum. {percent(item.acumulado)}</small></span>
                  </div>
                  {index === cutIndex && index < items.length - 1 && <div className="pareto-cut" aria-hidden="true"><span>{PARETO_CUT}% do custo</span></div>}
                </li>
              )
            })}
          </ol>
          {rest.length > 0 && (
            <p className="pareto-rest">
              <span>Demais {rest.length} {rest.length === 1 ? 'depositante' : 'depositantes'}</span>
              <strong>{currency(restValue)} <small>· {percent(restShare)}</small></strong>
            </p>
          )}
        </div>
      ) : <div className="ui-empty-state"><div><strong>Sem dados para Pareto</strong></div></div>}
    </Card>
  )
}

export function SupervisorRanking({ data }: { data: DashboardResponse }) {
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
