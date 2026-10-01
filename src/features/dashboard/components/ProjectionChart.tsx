'use client'

import { Card } from 'primereact/card'
import { Chart } from 'primereact/chart'
import { compactCurrency, currency, shortDate } from '@/features/dashboard/dashboardFormatters'
import type { DashboardProjectionPoint } from '@/types/dashboard'

const CHART_PALETTE = {
  ink: '#242a36',
  graphite: '#494a56',
  muted: '#858a93',
  grid: '#eceef1',
  red: '#db0812',
  text: '#5f636b',
}

const chartFont = { size: 9, family: 'Inter, Roboto, Arial, sans-serif' }

export function ProjectionChart({ points }: { points: DashboardProjectionPoint[] }) {
  const chartData = {
    labels: points.map((point) => shortDate(point.data).slice(0, 5)),
    datasets: [
      {
        label: 'Realizado',
        data: points.map((point) => point.realizadoAcumulado),
        borderColor: CHART_PALETTE.graphite,
        backgroundColor: CHART_PALETTE.graphite,
        pointBackgroundColor: CHART_PALETTE.graphite,
        pointRadius: 2.5,
        pointHoverRadius: 4,
        borderWidth: 2.5,
        tension: .25,
        spanGaps: true,
      },
      {
        label: 'Meta esperada',
        data: points.map((point) => point.metaEsperada),
        borderColor: '#9aa0a8',
        backgroundColor: '#9aa0a8',
        pointRadius: 0,
        borderWidth: 2,
        borderDash: [7, 5],
        tension: .2,
        spanGaps: true,
      },
      {
        label: 'Projeção',
        data: points.map((point) => point.projecao),
        borderColor: CHART_PALETTE.red,
        backgroundColor: CHART_PALETTE.red,
        pointBackgroundColor: CHART_PALETTE.red,
        pointRadius: 2,
        pointHoverRadius: 4,
        borderWidth: 2,
        borderDash: [4, 4],
        tension: .25,
        spanGaps: true,
      },
    ],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    interaction: { mode: 'index' as const, intersect: false },
    layout: { padding: { top: 4, right: 6, bottom: 2, left: 2 } },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: CHART_PALETTE.text,
          usePointStyle: true,
          pointStyle: 'circle' as const,
          boxWidth: 8,
          boxHeight: 8,
          padding: 14,
          font: chartFont,
        },
      },
      tooltip: {
        backgroundColor: CHART_PALETTE.ink,
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 10,
        callbacks: {
          title: (contexts: any[]) => points[contexts[0]?.dataIndex]?.data ? shortDate(points[contexts[0].dataIndex].data) : '',
          label: (context: any) => ` ${context.dataset.label}: ${currency(context.raw)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: CHART_PALETTE.muted, font: chartFont, autoSkip: true, maxTicksLimit: 8, maxRotation: 0 },
      },
      y: {
        beginAtZero: true,
        grid: { color: CHART_PALETTE.grid },
        border: { display: false },
        ticks: { color: CHART_PALETTE.muted, font: chartFont, callback: (value: any) => compactCurrency(Number(value)) },
      },
    },
  }

  return (
    <Card className="dashboard-card dashboard-projection-card nx-dashboard-section-card nx-chart-card">
      <div className="dashboard-card-header"><div><span className="ui-eyebrow">META E TENDÊNCIA</span><h2>Realizado × Meta esperada × Projeção</h2><p>Acumulado de mão de obra ao longo da competência 21–20.</p></div></div>
      {points.length ? (
        <div className="nx-chart-stage nx-dashboard-projection-stage"><Chart type="line" data={chartData} options={options} /></div>
      ) : <div className="ui-empty-state"><div><strong>Sem série para exibir</strong></div></div>}
    </Card>
  )
}
