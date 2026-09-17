'use client'

import { Card } from 'primereact/card'
import { currency, shortDate } from '@/features/dashboard/dashboardFormatters'
import type { DashboardResponse } from '@/types/dashboard'

export function DailyEvolution({ items }: { items: DashboardResponse['evolucaoDiaria'] }) {
  return (
    <Card className="dashboard-card nx-dashboard-section-card">
      <div className="dashboard-card-header"><div><span className="ui-eyebrow">EVOLUÇÃO</span><h2>Movimento diário da competência</h2><p>Data operacional dentro da janela 21–20.</p></div></div>
      <div className="dashboard-daily-grid">{items.length ? items.map((item) => <div className="dashboard-daily-item" key={item.data}><span>{shortDate(item.data).slice(0, 5)}</span><strong>{currency(item.realizado)}</strong><small>Prev. {currency(item.previsto)}</small></div>) : <div className="ui-empty-state"><div><strong>Sem movimento</strong><p>Não há custos na combinação de filtros selecionada.</p></div></div>}</div>
    </Card>
  )
}
