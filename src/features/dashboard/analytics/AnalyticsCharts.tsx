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

export function ParetoChart({ analytics }: { analytics: DashboardAnalytics }) {
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
