'use client'

import { SummaryMetrics, type SummaryMetricItem } from '@/components/ui/Primitives'
import type { AdministrativeSolicitationSummary } from '@/types/solicitation'
import { monthLabels } from '@/features/solicitations/administrative/solicitationPresentation'

type Props = {
  metrics: AdministrativeSolicitationSummary | null
  registrationYear: string
  registrationMonth: string
  statusFilter: string
  onStatusChange: (value: string) => void
}

export function AdminSolicitationsSummary({
  metrics,
  registrationYear,
  registrationMonth,
  statusFilter,
  onStatusChange,
}: Props) {
  const periodDetail = registrationYear !== 'TODOS' && registrationMonth !== 'TODOS'
    ? `${monthLabels[Number(registrationMonth) - 1]}/${registrationYear}`
    : registrationYear !== 'TODOS' ? registrationYear : 'base completa'

  const summary: SummaryMetricItem[] = [
    { key: 'all', label: 'Total', value: metrics?.total ?? '—', detail: `no período · ${periodDetail}`, icon: 'dataset', active: statusFilter === 'TODOS', onClick: () => onStatusChange('TODOS') },
    { key: 'triage', label: 'Aguardando triagem', value: metrics?.aguardandoTriagem ?? '—', detail: `no período · ${periodDetail}`, icon: 'pending_actions', tone: 'info', active: statusFilter === 'AGUARDANDO_TRIAGEM', onClick: () => onStatusChange('AGUARDANDO_TRIAGEM') },
    { key: 'actual', label: 'Aguardando realizado', value: metrics?.aguardandoRealizado ?? '—', detail: `no período · ${periodDetail}`, icon: 'groups', tone: 'warning', active: statusFilter === 'AGUARDANDO_REALIZADO', onClick: () => onStatusChange('AGUARDANDO_REALIZADO') },
    { key: 'div', label: 'Com divergência', value: metrics?.divergencias ?? '—', detail: `no período · ${periodDetail}`, icon: 'error', tone: 'danger', active: statusFilter === 'COM_DIVERGENCIA', onClick: () => onStatusChange('COM_DIVERGENCIA') },
  ]

  return <SummaryMetrics items={summary} ariaLabel="Filtrar solicitações por situação" />
}
