'use client'

import { SummaryMetrics } from '@/components/ui/Primitives'
import type { CatalogosAdminResumoDto } from '@/types/catalog'

type Props = {
  summary: CatalogosAdminResumoDto | null
}

export function CatalogAdminSummary({ summary }: Props) {
  const metrics = [
    { key: 'operacoes', label: 'Operações', value: summary?.operacoes ?? '—', icon: 'warehouse' },
    { key: 'supervisores', label: 'Supervisores', value: summary?.supervisores ?? '—', icon: 'badge' },
    { key: 'fornecedores', label: 'Fornecedores ativos', value: summary?.fornecedores ?? '—', icon: 'local_shipping' },
    { key: 'atividades', label: 'Atividades', value: summary?.atividades ?? '—', icon: 'task_alt' },
    { key: 'funcoes', label: 'Funções', value: summary?.funcoes ?? '—', icon: 'engineering' },
    { key: 'produtos', label: 'Produtos ativos', value: summary?.produtos ?? '—', icon: 'inventory_2' },
    { key: 'feriados', label: 'Feriados ativos', value: summary?.feriados ?? '—', icon: 'event' },
    { key: 'metas', label: 'Metas cadastradas', value: summary?.metas ?? '—', icon: 'flag' },
  ]

  return <SummaryMetrics items={metrics} ariaLabel="Resumo geral dos cadastros ativos" />
}
