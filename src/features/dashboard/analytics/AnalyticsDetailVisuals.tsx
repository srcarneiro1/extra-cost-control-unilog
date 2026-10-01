'use client'

import type { CSSProperties } from 'react'
import { Card } from 'primereact/card'
import { Chart } from 'primereact/chart'
import { AnalyticsCardHeader } from '@/features/dashboard/analytics/AnalyticsPrimitives'
import {
  ANALYTICS_PALETTE as PALETTE,
  analyticsAxisTicks as axisTicks,
  analyticsCurrency as currency,
  analyticsPercent as percent,
} from '@/features/dashboard/analytics/analyticsChartConfig'
import type { DashboardAnalytics } from '@/types/dashboard'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export function Heatmap({ analytics }: { analytics: DashboardAnalytics }) {
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

export function LinearityScatter({ analytics }: { analytics: DashboardAnalytics }) {
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
