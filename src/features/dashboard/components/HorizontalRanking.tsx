'use client'

import { Card } from 'primereact/card'
import { Chart } from 'primereact/chart'
import { compactCurrency, currency, shortLabel } from '@/features/dashboard/dashboardFormatters'
import type { DashboardBreakdownItem } from '@/types/dashboard'

const CHART_PALETTE = {
  ink: '#242a36',
  graphite: '#494a56',
  planned: '#d7dbe0',
  muted: '#858a93',
  grid: '#eceef1',
  text: '#5f636b',
}

const chartFont = { size: 9, family: 'Inter, Roboto, Arial, sans-serif' }

export function HorizontalRanking({ title, subtitle, items, limit = 8 }: { title: string; subtitle: string; items: DashboardBreakdownItem[]; limit?: number }) {
  const visible = items.slice(0, limit)
  const chartData = {
    labels: visible.map((item) => item.chave),
    datasets: [
      {
        label: 'Previsto',
        data: visible.map((item) => item.previsto),
        backgroundColor: CHART_PALETTE.planned,
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 16,
      },
      {
        label: 'Realizado',
        data: visible.map((item) => item.realizado),
        backgroundColor: CHART_PALETTE.graphite,
        borderRadius: 6,
        borderSkipped: false,
        maxBarThickness: 16,
      },
    ],
  }
  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
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
          title: (contexts: any[]) => visible[contexts[0]?.dataIndex]?.chave || '',
          label: (context: any) => ` ${context.dataset.label}: ${currency(context.raw)}`,
          afterBody: (contexts: any[]) => {
            const item = visible[contexts[0]?.dataIndex]
            return item ? `${item.solicitacoes} solicitação(ões)` : ''
          },
        },
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        grid: { color: CHART_PALETTE.grid },
        border: { display: false },
        ticks: { color: CHART_PALETTE.muted, font: chartFont, callback: (value: any) => compactCurrency(Number(value)) },
      },
      y: {
        grid: { display: false },
        border: { display: false },
        ticks: {
          color: CHART_PALETTE.text,
          font: { ...chartFont, weight: 'bold' as const },
          callback: (_value: any, index: number) => shortLabel(visible[index]?.chave || '', 18),
        },
      },
    },
  }

  return (
    <Card className="dashboard-card nx-dashboard-section-card nx-chart-card">
      <div className="dashboard-card-header">
        <div><span className="ui-eyebrow">ANÁLISE</span><h2>{title}</h2><p>{subtitle}</p></div>
      </div>
      {visible.length ? (
        <div className="nx-chart-stage nx-dashboard-ranking-stage"><Chart type="bar" data={chartData} options={options} /></div>
      ) : (
        <div className="ui-empty-state"><div><strong>Sem dados no período</strong><p>Altere os filtros para ampliar a análise.</p></div></div>
      )}
    </Card>
  )
}
