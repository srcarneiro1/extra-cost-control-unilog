'use client'

import type { ReactNode } from 'react'
import { Card } from 'primereact/card'

export type AnalyticsMetricTone = 'neutral' | 'info' | 'warning' | 'danger'

export function AnalyticsMetric({ label, value, detail, tone = 'neutral' }: {
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

export function AnalyticsCardHeader({ eyebrow, title, description, trailing }: {
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
