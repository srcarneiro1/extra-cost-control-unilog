'use client'

import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { Dropdown } from 'primereact/dropdown'
import type {
  DashboardQuery,
  DashboardResponse,
  DashboardTypeFilter,
} from '@/types/dashboard'

type DashboardFiltersProps = {
  query: DashboardQuery
  data: DashboardResponse | null
  initial: { ano: string; mesCompetencia: string }
  monthName: (month: string) => string
  onChange: <K extends keyof DashboardQuery>(field: K, value: DashboardQuery[K]) => void
  onClearDimensions: () => void
}

function typeLabel(value: DashboardTypeFilter) {
  if (value === 'MAO_DE_OBRA') return 'Mão de obra'
  if (value === 'ALIMENTACAO_BEBIDA') return 'Lanches'
  return 'Todos os tipos'
}

function optionize(values: string[], allLabel: string) {
  return [{ label: allLabel, value: 'TODOS' }, ...values.map((value) => ({ label: value, value }))]
}

export function DashboardFilters({
  query,
  data,
  initial,
  monthName,
  onChange,
  onClearDimensions,
}: DashboardFiltersProps) {
  const yearOptions = (data?.filtros.anos.length ? data.filtros.anos : [query.ano || initial.ano]).map((value) => ({ label: value, value }))
  const competenceOptions = (data?.filtros.mesesCompetencia.length ? data.filtros.mesesCompetencia : [query.mesCompetencia || initial.mesCompetencia]).map((value) => ({ label: monthName(value), value }))
  const typeOptions = (['TODOS', 'MAO_DE_OBRA', 'ALIMENTACAO_BEBIDA'] as DashboardTypeFilter[]).map((value) => ({ label: typeLabel(value), value }))
  const hasActiveDimensions =
    query.operacao !== 'TODOS' ||
    query.supervisor !== 'TODOS' ||
    query.fornecedor !== 'TODOS' ||
    query.tipo !== 'TODOS' ||
    query.responsavelCusto !== 'TODOS' ||
    query.atividade !== 'TODOS'

  return (
    <Card className="dashboard-filter-panel nx-dashboard-filter-card">
      <div className="nx-dashboard-filter-grid">
        <label className="nx-field">Ano<Dropdown value={query.ano} options={yearOptions} onChange={(event) => onChange('ano', event.value)} /></label>
        <label className="nx-field">Competência<Dropdown value={query.mesCompetencia} options={competenceOptions} onChange={(event) => onChange('mesCompetencia', event.value)} /></label>
        <label className="nx-field">Operação<Dropdown value={query.operacao} options={optionize(data?.filtros.operacoes || [], 'Todas')} onChange={(event) => onChange('operacao', event.value)} filter={(data?.filtros.operacoes.length || 0) > 8} /></label>
        <label className="nx-field">Supervisor<Dropdown value={query.supervisor} options={optionize(data?.filtros.supervisores || [], 'Todos')} onChange={(event) => onChange('supervisor', event.value)} filter={(data?.filtros.supervisores.length || 0) > 8} /></label>
        <label className="nx-field">Fornecedor<Dropdown value={query.fornecedor} options={optionize(data?.filtros.fornecedores || [], 'Todos')} onChange={(event) => onChange('fornecedor', event.value)} filter={(data?.filtros.fornecedores.length || 0) > 8} /></label>
        <label className="nx-field">Tipo<Dropdown value={query.tipo} options={typeOptions} onChange={(event) => onChange('tipo', event.value as DashboardTypeFilter)} /></label>
        <label className="nx-field">Responsável pelo custo<Dropdown value={query.responsavelCusto} options={optionize(data?.filtros.responsaveisCusto || [], 'Todos')} onChange={(event) => onChange('responsavelCusto', event.value)} /></label>
        <label className="nx-field">Atividade<Dropdown value={query.atividade} options={optionize(data?.filtros.atividades || [], 'Todas')} onChange={(event) => onChange('atividade', event.value)} filter={(data?.filtros.atividades.length || 0) > 8} /></label>
      </div>
      <div className="nx-dashboard-filter-actions">
        <Button label="Limpar dimensões" icon="pi pi-filter-slash" outlined onClick={onClearDimensions} disabled={!hasActiveDimensions} />
      </div>
    </Card>
  )
}
