'use client'

import { Card } from 'primereact/card'

export type MetricTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

type DashboardMetricCardProps = {
  label: string
  value: string
  detail: string
  tone?: MetricTone
}

export function MetricCard({ label, value, detail, tone = 'neutral' }: DashboardMetricCardProps) {
  return (
    <Card className={`dashboard-metric dashboard-metric-${tone} nx-dashboard-metric-card`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </Card>
  )
}
