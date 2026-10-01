'use client'

import { Card } from 'primereact/card'
import { Tag } from 'primereact/tag'
import { AnalyticsCardHeader } from '@/features/dashboard/analytics/AnalyticsPrimitives'
import type { DashboardAnalytics } from '@/types/dashboard'

function severityInfo(value: string) {
  const normalized = value.toUpperCase()
  if (normalized === 'ALTA') return { label: 'Alta prioridade', severity: 'danger' as const }
  if (normalized === 'MEDIA' || normalized === 'MÉDIA') return { label: 'Atenção', severity: 'warning' as const }
  return { label: 'Informativo', severity: 'secondary' as const }
}

export function AnalyticsOpportunities({ analytics }: { analytics: DashboardAnalytics }) {
  return (
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
  )
}
