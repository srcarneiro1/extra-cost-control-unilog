import { useEffect, useMemo, useState } from 'react'
import { Card } from 'primereact/card'
import { Message } from 'primereact/message'
import { SelectButton } from 'primereact/selectbutton'
import { Skeleton } from 'primereact/skeleton'
import { AdvancedAnalytics } from '@/features/dashboard/analytics/AdvancedAnalytics'
import { AnalyticsSummary } from '@/features/dashboard/analytics/AnalyticsSummary'
import { HorizontalRanking } from '@/features/dashboard/components/HorizontalRanking'
import { ProjectionChart } from '@/features/dashboard/components/ProjectionChart'
import { DashboardExportActions } from '@/features/dashboard/export/DashboardExportActions'
import { DashboardFilters } from '@/features/dashboard/DashboardFilters'
import { CompetenceComparison } from '@/features/dashboard/executive/CompetenceComparison'
import { DailyEvolution } from '@/features/dashboard/executive/DailyEvolution'
import { ExecutiveMetrics } from '@/features/dashboard/executive/ExecutiveMetrics'
import { MetaStatusAlert } from '@/features/dashboard/executive/MetaStatusAlert'
import {
  monthName,
  shortDate,
} from '@/features/dashboard/dashboardFormatters'
import { fetchDashboard, revalidateDashboard } from '@/features/dashboard/services/dashboardService'
import type {
  DashboardQuery,
  DashboardResponse,
} from '@/types/dashboard'

type DashboardTab = 'executiva' | 'analytics'

function currentCompetence() {
  const now = new Date()
  const closing = new Date(now.getFullYear(), now.getMonth() + (now.getDate() >= 21 ? 1 : 0), 1)
  return {
    ano: String(closing.getFullYear()),
    mesCompetencia: String(closing.getMonth() + 1).padStart(2, '0'),
  }
}

export function DashboardPage() {
  const initial = useMemo(currentCompetence, [])
  const [tab, setTab] = useState<DashboardTab>('executiva')
  const [query, setQuery] = useState<DashboardQuery>({ ano: initial.ano, mesCompetencia: initial.mesCompetencia, operacao: 'TODOS', supervisor: 'TODOS', fornecedor: 'TODOS', tipo: 'TODOS', responsavelCusto: 'TODOS', atividade: 'TODOS' })
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    void fetchDashboard(query, controller.signal)
      .then(setData)
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar o dashboard.')
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [query])

  useEffect(() => {
    let active = true
    let refreshing = false
    const refreshSilently = () => {
      if (!active || refreshing || document.visibilityState !== 'visible') return
      refreshing = true
      void revalidateDashboard(query)
        .then((latest) => { if (active) setData(latest) })
        .catch(() => undefined)
        .finally(() => { refreshing = false })
    }
    const handleVisibilityChange = () => { if (document.visibilityState === 'visible') refreshSilently() }
    const interval = window.setInterval(refreshSilently, 30_000)
    window.addEventListener('focus', refreshSilently)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      active = false
      window.clearTimeout(interval)
      window.removeEventListener('focus', refreshSilently)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [query])

  useEffect(() => {
    const years = data?.filtros.anos || []
    if (!years.length) return

    const latestYear = [...years].sort().at(-1) || ''
    if (latestYear && !years.includes(query.ano || '')) {
      setQuery((current) => ({ ...current, ano: latestYear }))
      return
    }

    const months = data?.filtros.mesesCompetencia || []
    if (!months.length) return
    if (months.includes(query.mesCompetencia || '')) return

    const latestMonth = [...months].sort().at(-1)
    if (latestMonth) update('mesCompetencia', latestMonth)
  }, [data?.filtros.anos, data?.filtros.mesesCompetencia, query.ano, query.mesCompetencia])

  function update<K extends keyof DashboardQuery>(field: K, value: DashboardQuery[K]) {
    setQuery((current) => ({ ...current, [field]: value }))
  }

  function clearDimensionFilters() {
    setQuery((current) => ({ ...current, operacao: 'TODOS', supervisor: 'TODOS', fornecedor: 'TODOS', tipo: 'TODOS', responsavelCusto: 'TODOS', atividade: 'TODOS' }))
  }

  const kpis = data?.kpis
  const tabOptions = [
    { label: 'Visão Executiva', value: 'executiva' },
    { label: 'Analytics', value: 'analytics' },
  ]

  return (
    <div className="dashboard-page nx-modern-page">
      <div className="dashboard-page-heading">
        <div><span className="ui-eyebrow">CUSTOS EXTRAS</span><h1>Visão geral</h1><p>Leitura executiva e analítica de mão de obra terceirizada e lanches.</p>{data && <p><strong>Competência: {monthName(data.competencia.slice(5, 7))}/{data.competencia.slice(0, 4)}</strong> · {shortDate(data.periodoInicio)} a {shortDate(data.periodoFim)}</p>}</div>
        <DashboardExportActions query={query} />
      </div>

      <SelectButton value={tab} options={tabOptions} onChange={(event) => event.value && setTab(event.value as DashboardTab)} className="nx-dashboard-tabs" aria-label="Áreas do dashboard" />

      <DashboardFilters
        query={query}
        data={data}
        initial={initial}
        monthName={monthName}
        onChange={update}
        onClearDimensions={clearDimensionFilters}
      />

      {loading && !data ? (
        <Card className="nx-dashboard-loading-card"><div className="nx-prime-skeleton"><Skeleton height="1.3rem" /><Skeleton /><Skeleton /><Skeleton /></div></Card>
      ) : null}
      {error ? <Message severity="error" text={error} className="nx-dashboard-error" /> : null}

      {data && kpis ? <>{loading && <div className="dashboard-refreshing"><i className="pi pi-spin pi-spinner" /> Atualizando indicadores…</div>}{tab === 'executiva' ? (
        <div className="dashboard-view">
          <ExecutiveMetrics kpis={kpis} />
          <CompetenceComparison comparison={data.comparativoCompetencia} />
          <MetaStatusAlert data={data} />
          <ProjectionChart points={data.evolucaoMetaProjecao} />
          <div className="dashboard-two-columns"><HorizontalRanking title="Custo por operação" subtitle="Ranking do realizado com referência do previsto." items={data.porOperacao} /><HorizontalRanking title="Custo por fornecedor" subtitle="Concentração financeira entre fornecedores no período." items={data.porFornecedor} /></div>
          <DailyEvolution items={data.evolucaoDiaria} />
        </div>
      ) : (
        <div className="dashboard-view">
          <AnalyticsSummary kpis={kpis} />
          <AdvancedAnalytics data={data} />
          <div className="dashboard-two-columns"><HorizontalRanking title="Responsável pelo custo" subtitle="Separação entre custos Unilog, cliente e demais classificações." items={data.porResponsavelCusto} limit={6} /><HorizontalRanking title="Atividades" subtitle="Atividades com maior concentração de custos extras." items={data.porAtividade} limit={8} /></div>
        </div>
      )}</> : null}
    </div>
  )
}
