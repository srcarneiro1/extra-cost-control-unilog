'use client'

import { Card } from 'primereact/card'
import { Chart } from 'primereact/chart'
import { compactCurrency, currency, competenceLabel, quantity } from '@/features/dashboard/dashboardFormatters'
import type { DashboardThirdPartyMonth } from '@/types/dashboard'

// Gasto com terceiros (mão de obra) — últimas 6 competências (21/10/2026).
// Barras do realizado (VALOR_REAL), mesma regra do card "Realizado mão de obra".
// Competência em andamento em tom mais claro, marcada como parcial.
const PALETTE = {
  ink: '#242a36',
  bar: '#494a56',
  barPartial: '#b9bdc4',
  muted: '#858a93',
  grid: '#eceef1',
  text: '#5f636b',
}

const chartFont = { size: 9, family: 'Inter, Roboto, Arial, sans-serif' }

function shortLabel(competence: string) {
  // "Outubro/2026" → "out/26"
  const [name, year] = competenceLabel(competence).split('/')
  return `${name.slice(0, 3).toLowerCase()}/${String(year).slice(2)}`
}

export function ThirdPartyHistory({ months }: { months: DashboardThirdPartyMonth[] | undefined }) {
  const items = months || []
  const closed = items.filter((item) => !item.parcial)
  const average = closed.length ? closed.reduce((sum, item) => sum + item.valorRealizado, 0) / closed.length : null
  const total = items.reduce((sum, item) => sum + item.valorRealizado, 0)
  const hasData = items.some((item) => item.valorRealizado > 0)

  const chartData = {
    labels: items.map((item) => (item.parcial ? `${shortLabel(item.competencia)}*` : shortLabel(item.competencia))),
    datasets: [
      {
        label: 'Realizado com terceiros',
        data: items.map((item) => item.valorRealizado),
        backgroundColor: items.map((item) => (item.parcial ? PALETTE.barPartial : PALETTE.bar)),
        hoverBackgroundColor: items.map((item) => (item.parcial ? '#a3a8b0' : PALETTE.ink)),
        borderRadius: 6,
        maxBarThickness: 46,
      },
    ],
  }

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    layout: { padding: { top: 8, right: 6, bottom: 2, left: 2 } },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: PALETTE.ink,
        titleColor: '#fff',
        bodyColor: '#fff',
        padding: 10,
        callbacks: {
          title: (contexts: any[]) => {
            const item = items[contexts[0]?.dataIndex]
            return item ? `${competenceLabel(item.competencia)}${item.parcial ? ' (parcial)' : ''}` : ''
          },
          label: (context: any) => {
            const item = items[context.dataIndex]
            return [
              ` Realizado: ${currency(item.valorRealizado)}`,
              ` Previsto: ${currency(item.valorPrevisto)}`,
              ` Solicitações: ${quantity(item.solicitacoes)}`,
            ]
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: PALETTE.muted, font: chartFont, maxRotation: 0 },
      },
      y: {
        beginAtZero: true,
        grid: { color: PALETTE.grid },
        border: { display: false },
        ticks: { color: PALETTE.muted, font: chartFont, callback: (value: any) => compactCurrency(Number(value)) },
      },
    },
  }

  // months === undefined: o backend (Apps Script) ainda não envia o histórico — versão anterior publicada.
  // Mensagem própria para não confundir com "não houve gasto".
  const backendDesatualizado = months === undefined

  return (
    <Card className="dashboard-card nx-dashboard-section-card nx-chart-card dashboard-third-party-card">
      <div className="dashboard-card-header">
        <div>
          <span className="ui-eyebrow">TERCEIROS · ÚLTIMOS 6 MESES</span>
          <h2>Gasto com mão de obra terceirizada</h2>
          <p>Valor realizado por competência (21–20), com os filtros aplicados.</p>
        </div>
        {hasData && (
          <div className="dashboard-third-party-summary">
            <span><small>Média mensal</small><strong>{average == null ? '—' : currency(average)}</strong></span>
            <span><small>Total no período</small><strong>{currency(total)}</strong></span>
          </div>
        )}
      </div>
      {backendDesatualizado ? (
        <div className="ui-empty-state"><div><strong>Histórico indisponível no servidor</strong><p>O serviço de dados ainda não envia o histórico de terceiros. Publique a nova versão do Apps Script (DashboardService.gs) para exibir o gráfico.</p></div></div>
      ) : hasData ? (
        <>
          <div className="nx-chart-stage dashboard-third-party-stage"><Chart type="bar" data={chartData} options={options} /></div>
          {items.some((item) => item.parcial) && (
            <p className="dashboard-third-party-note">* Competência em andamento: valor parcial. A média considera só competências encerradas.</p>
          )}
        </>
      ) : (
        <div className="ui-empty-state"><div><strong>Sem gasto com terceiros no período</strong><p>Não há valor realizado de mão de obra nas últimas 6 competências para os filtros selecionados.</p></div></div>
      )}
    </Card>
  )
}
