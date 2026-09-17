import { useEffect, useMemo, useState } from 'react'
import { Card } from 'primereact/card'
import { Chart } from 'primereact/chart'
import { Message } from 'primereact/message'
import { SelectButton } from 'primereact/selectbutton'
import { Skeleton } from 'primereact/skeleton'
import { AdvancedAnalytics } from '@/features/dashboard/analytics/AdvancedAnalytics'
import { DashboardExportActions } from '@/features/dashboard/export/DashboardExportActions'
import { DashboardFilters } from '@/features/dashboard/DashboardFilters'
import { fetchDashboard, revalidateDashboard } from '@/features/dashboard/services/dashboardService'
import type {
  DashboardBreakdownItem,
  DashboardCompetenceComparison,
  DashboardProjectionPoint,
  DashboardQuery,
  DashboardResponse,
} from '@/types/dashboard'

type DashboardTab = 'executiva' | 'analytics'
type MetricTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const MONTHS = [
  ['01', 'Janeiro'], ['02', 'Fevereiro'], ['03', 'Março'], ['04', 'Abril'],
  ['05', 'Maio'], ['06', 'Junho'], ['07', 'Julho'], ['08', 'Agosto'],
  ['09', 'Setembro'], ['10', 'Outubro'], ['11', 'Novembro'], ['12', 'Dezembro'],
] as const

const CHART_PALETTE = {
  ink: '#242a36',
  graphite: '#494a56',
  planned: '#d7dbe0',
  muted: '#858a93',
  grid: '#eceef1',
  red: '#db0812',
  text: '#5f636b',
}

const chartFont = { size: 9, family: 'Inter, Roboto, Arial, sans-serif' }

function currentCompetence() {
  const now = new Date()
  const closing = new Date(now.getFullYear(), now.getMonth() + (now.getDate() >= 21 ? 1 : 0), 1)
  return {
    ano: String(closing.getFullYear()),
    mesCompetencia: String(closing.getMonth() + 1).padStart(2, '0'),
  }
}

function currency(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value)
}

function compactCurrency(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

function quantity(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value)
}

function percent(value: number | null | undefined) {
  if (value == null) return '—'
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}%`
}

function signedPercent(value: number | null | undefined) {
  if (value == null) return '—'
  const formatted = percent(Math.abs(value))
  if (value > 0) return `+${formatted}`
  if (value < 0) return `−${formatted}`
  return formatted
}

function economyPercent(current: number, previous: number) {
  if (!previous) return null
  return ((previous - current) / previous) * 100
}

function shortDate(value: string) {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function shortLabel(value: string, max = 18) {
  const normalized = value.trim()
  return normalized.length <= max ? normalized : `${normalized.slice(0, Math.max(1, max - 1))}…`
}

function monthName(month: string) {
  return MONTHS.find(([value]) => value === month)?.[1] || month
}

function competenceLabel(competence: string) {
  const [year, month] = competence.split('-')
  return `${monthName(month)}/${year}`
}

function MetricCard({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail: string; tone?: MetricTone }) {
  return (
    <Card className={`dashboard-metric dashboard-metric-${tone} nx-dashboard-metric-card`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </Card>
  )
}

function EconomyCard({ label, current, previous, featured = false }: { label: string; current: number; previous: number; featured?: boolean }) {
  const economy = previous - current
  const economyRate = economyPercent(current, previous)
  const state = economy > 0 ? 'saving' : economy < 0 ? 'increase' : 'neutral'
  const icon = economy > 0 ? 'pi pi-arrow-down' : economy < 0 ? 'pi pi-arrow-up' : 'pi pi-minus'
  const detail = economy > 0
    ? `Economia de ${economyRate == null ? '—' : percent(economyRate)}`
    : economy < 0
      ? `Aumento de ${economyRate == null ? '—' : percent(Math.abs(economyRate))}`
      : 'Sem variação de custo'

  return (
    <Card className={`dashboard-economy-card is-${state}${featured ? ' is-featured' : ''} nx-dashboard-economy-card`}>
      <div className="dashboard-economy-label">
        <i className={icon} aria-hidden="true" />
        <span>{label}</span>
      </div>
      <strong>{currency(Math.abs(economy))}</strong>
      <small>{detail}</small>
    </Card>
  )
}

function volumeSentence(label: string, variation: number | null | undefined) {
  if (variation == null) return `${label}: sem base percentual anterior.`
  if (variation > 0) return `${label}: volume ${percent(Math.abs(variation))} maior.`
  if (variation < 0) return `${label}: volume ${percent(Math.abs(variation))} menor.`
  return `${label}: volume estável.`
}

function CompetenceComparison({ comparison }: { comparison: DashboardCompetenceComparison | undefined }) {
  if (!comparison?.disponivel || !comparison.atual || !comparison.anterior || !comparison.variacao) {
    return (
      <Card className="dashboard-card dashboard-comparison-card nx-dashboard-section-card">
        <div className="dashboard-card-header">
          <div><span className="ui-eyebrow">COMPETÊNCIA × ANTERIOR</span><h2>Comparativo no mesmo intervalo realizado</h2><p>O corte é definido pela última data operacional com realizado válido.</p></div>
        </div>
        <div className="ui-empty-state"><div><strong>Comparativo ainda indisponível</strong><p>É necessário existir movimento realizado na competência selecionada.</p></div></div>
      </Card>
    )
  }

  const current = comparison.atual
  const previous = comparison.anterior
  const variation = comparison.variacao
  const currentTotal = current.valorMaoObra + current.valorLanches
  const previousTotal = previous.valorMaoObra + previous.valorLanches
  const totalEconomy = previousTotal - currentTotal
  const totalEconomyRate = economyPercent(currentTotal, previousTotal)
  const laborEconomy = previous.valorMaoObra - current.valorMaoObra
  const snacksEconomy = previous.valorLanches - current.valorLanches
  const currentLabel = competenceLabel(current.competencia)
  const previousLabel = competenceLabel(previous.competencia)
  const chartItems = [
    { label: 'Mão de obra', current: current.valorMaoObra, previous: previous.valorMaoObra },
    { label: 'Lanches e bebidas', current: current.valorLanches, previous: previous.valorLanches },
    { label: 'Total', current: currentTotal, previous: previousTotal },
  ]
  const chartMax = Math.max(...chartItems.flatMap((item) => [item.current, item.previous]), 1)
  const driver = totalEconomy >= 0
    ? [
        { label: 'mão de obra', value: laborEconomy },
        { label: 'lanches e bebidas', value: snacksEconomy },
      ].sort((a, b) => b.value - a.value)[0]
    : [
        { label: 'mão de obra', value: laborEconomy },
        { label: 'lanches e bebidas', value: snacksEconomy },
      ].sort((a, b) => a.value - b.value)[0]
  const financialInsight = totalEconomy > 0
    ? `O gasto total caiu ${currency(totalEconomy)} (${totalEconomyRate == null ? '—' : percent(totalEconomyRate)}) no mesmo recorte. A maior contribuição veio de ${driver.label}, com redução de ${currency(Math.max(driver.value, 0))}.`
    : totalEconomy < 0
      ? `O gasto total aumentou ${currency(Math.abs(totalEconomy))} (${totalEconomyRate == null ? '—' : percent(Math.abs(totalEconomyRate))}) no mesmo recorte. O principal vetor foi ${driver.label}, com aumento de ${currency(Math.abs(Math.min(driver.value, 0)))}.`
      : 'O gasto total ficou estável em relação ao mesmo recorte da competência anterior.'
  const rows = [
    { label: 'Mão de obra · custo', current: currency(current.valorMaoObra), previous: currency(previous.valorMaoObra), delta: variation.valorMaoObraPercentual, kind: 'cost' as const },
    { label: 'Mão de obra · quantidade', current: quantity(current.quantidadeMaoObra), previous: quantity(previous.quantidadeMaoObra), delta: variation.quantidadeMaoObraPercentual, kind: 'volume' as const },
    { label: 'Lanches e bebidas · custo', current: currency(current.valorLanches), previous: currency(previous.valorLanches), delta: variation.valorLanchesPercentual, kind: 'cost' as const },
    { label: 'Lanches e bebidas · quantidade', current: quantity(current.quantidadeLanches), previous: quantity(previous.quantidadeLanches), delta: variation.quantidadeLanchesPercentual, kind: 'volume' as const },
  ]

  return (
    <Card className="dashboard-card dashboard-comparison-card nx-dashboard-section-card">
      <div className="dashboard-card-header">
        <div>
          <span className="ui-eyebrow">COMPETÊNCIA × ANTERIOR</span>
          <h2>Comparativo no mesmo intervalo realizado</h2>
          <p>Corte em {shortDate(comparison.dataCorte || '')} · {shortDate(current.periodoInicio)} a {shortDate(current.periodoFim)} versus {shortDate(previous.periodoInicio)} a {shortDate(previous.periodoFim)} · {comparison.diasComparados} dia(s)</p>
        </div>
      </div>

      <div className="dashboard-economy-grid" aria-label="Economia ou aumento de custo em relação à competência anterior">
        <EconomyCard label="Mão de obra" current={current.valorMaoObra} previous={previous.valorMaoObra} />
        <EconomyCard label="Lanches e bebidas" current={current.valorLanches} previous={previous.valorLanches} />
        <EconomyCard label="Resultado total" current={currentTotal} previous={previousTotal} featured />
      </div>

      <div className="dashboard-comparison-insight">
        <i className="pi pi-chart-line" aria-hidden="true" />
        <div>
          <strong>Leitura executiva</strong>
          <p>{financialInsight}</p>
          <small>{volumeSentence('Mão de obra', variation.quantidadeMaoObraPercentual)} {volumeSentence('Lanches e bebidas', variation.quantidadeLanchesPercentual)}</small>
        </div>
      </div>

      <div className="dashboard-comparison-chart" aria-label="Comparativo visual de custos entre competências">
        <div className="dashboard-comparison-chart-header">
          <strong>Comparação de custo</strong>
          <div><span><i className="is-current" />{currentLabel}</span><span><i className="is-previous" />{previousLabel}</span></div>
        </div>
        {chartItems.map((item) => (
          <div className="dashboard-comparison-chart-row" key={item.label}>
            <strong>{item.label}</strong>
            <div className="dashboard-comparison-chart-series">
              <div className="dashboard-comparison-chart-line"><span>{previousLabel}</span><div><i className="is-previous" style={{ width: `${Math.max((item.previous / chartMax) * 100, item.previous ? 2 : 0)}%` }} /></div><small>{currency(item.previous)}</small></div>
              <div className="dashboard-comparison-chart-line"><span>{currentLabel}</span><div><i className="is-current" style={{ width: `${Math.max((item.current / chartMax) * 100, item.current ? 2 : 0)}%` }} /></div><small>{currency(item.current)}</small></div>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-comparison-table" role="table" aria-label="Comparativo entre competência selecionada e anterior">
        <div className="dashboard-comparison-row dashboard-comparison-head" role="row">
          <span role="columnheader">Indicador</span>
          <strong role="columnheader">{currentLabel}</strong>
          <strong role="columnheader">{previousLabel}</strong>
          <strong role="columnheader">Delta</strong>
        </div>
        {rows.map((item) => {
          const deltaClass = item.kind === 'volume'
            ? 'is-volume'
            : item.delta == null || item.delta === 0
              ? 'is-neutral'
              : item.delta > 0
                ? 'is-up'
                : 'is-down'
          const deltaIcon = item.delta == null || item.delta === 0 ? 'pi pi-minus' : item.delta > 0 ? 'pi pi-arrow-up' : 'pi pi-arrow-down'
          return (
            <div className="dashboard-comparison-row" role="row" key={item.label}>
              <span role="cell">{item.label}</span>
              <strong role="cell">{item.current}</strong>
              <span role="cell">{item.previous}</span>
              <span role="cell" className={`dashboard-comparison-delta ${deltaClass}`}><i className={deltaIcon} aria-hidden="true" />{signedPercent(item.delta)}</span>
            </div>
          )
        })}
      </div>
    </Card>
  )
}

function HorizontalRanking({ title, subtitle, items, limit = 8 }: { title: string; subtitle: string; items: DashboardBreakdownItem[]; limit?: number }) {
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

function ProjectionChart({ points }: { points: DashboardProjectionPoint[] }) {
  const chartData = {
    labels: points.map((point) => shortDate(point.data).slice(0, 5)),
    datasets: [
      {
        label: 'Realizado',
        data: points.map((point) => point.realizadoAcumulado),
        borderColor: CHART_PALETTE.graphite,
        backgroundColor: CHART_PALETTE.graphite,
        pointBackgroundColor: CHART_PALETTE.graphite,
        pointRadius: 2.5,
        pointHoverRadius: 4,
        borderWidth: 2.5,
        tension: .25,
        spanGaps: true,
      },
      {
        label: 'Meta esperada',
        data: points.map((point) => point.metaEsperada),
        borderColor: '#9aa0a8',
        backgroundColor: '#9aa0a8',
        pointRadius: 0,
        borderWidth: 2,
        borderDash: [7, 5],
        tension: .2,
        spanGaps: true,
      },
      {
        label: 'Projeção',
        data: points.map((point) => point.projecao),
        borderColor: CHART_PALETTE.red,
        backgroundColor: CHART_PALETTE.red,
        pointBackgroundColor: CHART_PALETTE.red,
        pointRadius: 2,
        pointHoverRadius: 4,
        borderWidth: 2,
        borderDash: [4, 4],
        tension: .25,
        spanGaps: true,
      },
    ],
  }
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false as const,
    interaction: { mode: 'index' as const, intersect: false },
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
          title: (contexts: any[]) => points[contexts[0]?.dataIndex]?.data ? shortDate(points[contexts[0].dataIndex].data) : '',
          label: (context: any) => ` ${context.dataset.label}: ${currency(context.raw)}`,
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        border: { display: false },
        ticks: { color: CHART_PALETTE.muted, font: chartFont, autoSkip: true, maxTicksLimit: 8, maxRotation: 0 },
      },
      y: {
        beginAtZero: true,
        grid: { color: CHART_PALETTE.grid },
        border: { display: false },
        ticks: { color: CHART_PALETTE.muted, font: chartFont, callback: (value: any) => compactCurrency(Number(value)) },
      },
    },
  }

  return (
    <Card className="dashboard-card dashboard-projection-card nx-dashboard-section-card nx-chart-card">
      <div className="dashboard-card-header"><div><span className="ui-eyebrow">META E TENDÊNCIA</span><h2>Realizado × Meta esperada × Projeção</h2><p>Acumulado de mão de obra ao longo da competência 21–20.</p></div></div>
      {points.length ? (
        <div className="nx-chart-stage nx-dashboard-projection-stage"><Chart type="line" data={chartData} options={options} /></div>
      ) : <div className="ui-empty-state"><div><strong>Sem série para exibir</strong></div></div>}
    </Card>
  )
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
    if (!data?.filtros.mesesCompetencia.length) return
    if (data.filtros.mesesCompetencia.includes(query.mesCompetencia || '')) return
    update('mesCompetencia', data.filtros.mesesCompetencia[0])
  }, [data?.filtros.mesesCompetencia, query.mesCompetencia])

  function update<K extends keyof DashboardQuery>(field: K, value: DashboardQuery[K]) {
    setQuery((current) => ({ ...current, [field]: value }))
  }

  function clearDimensionFilters() {
    setQuery((current) => ({ ...current, operacao: 'TODOS', supervisor: 'TODOS', fornecedor: 'TODOS', tipo: 'TODOS', responsavelCusto: 'TODOS', atividade: 'TODOS' }))
  }

  const kpis = data?.kpis
  const totalPlanned = (kpis?.previstoMaoObra || 0) + (kpis?.previstoLanches || 0)
  const totalReal = (kpis?.realizadoMaoObra || 0) + (kpis?.realizadoLanches || 0)
  const differenceTone: MetricTone = !kpis?.diferencaValor ? 'neutral' : kpis.diferencaValor > 0 ? 'danger' : 'success'
  const metaTone: MetricTone = kpis?.atingimentoMetaPercentual == null ? 'neutral' : kpis.atingimentoMetaPercentual > 100 ? 'danger' : kpis.atingimentoMetaPercentual > 85 ? 'warning' : 'success'
  const metaAlertMessage = data?.alertaMeta.status === 'FORA_DA_META' ? `Mantido o ritmo atual, a projeção supera a meta em ${currency(Math.max(data.alertaMeta.desvioProjetadoMeta || 0, 0))}.` : data?.alertaMeta.mensagem || ''
  const remainingDailyLimit = data && kpis?.metaMaoObra != null && data.projecao.diasRestantes > 0 ? (kpis.metaMaoObra - kpis.realizadoMaoObra) / data.projecao.diasRestantes : null
  const remainingDailyMessage = remainingDailyLimit == null ? '' : remainingDailyLimit >= 0 ? `Limite médio restante: ${currency(remainingDailyLimit)}/dia por ${data?.projecao.diasRestantes || 0} dia(s).` : `A meta realizada já foi excedida em ${currency(Math.abs((kpis?.metaMaoObra || 0) - (kpis?.realizadoMaoObra || 0)))}.`

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
          <div className="dashboard-metrics-grid">
            <MetricCard label="Previsto · Mão de obra" value={currency(kpis.previstoMaoObra)} detail="Solicitações da competência" />
            <MetricCard label="Previsto · Lanches" value={currency(kpis.previstoLanches)} detail="Alimentação e bebida" />
            <MetricCard label="Realizado · Mão de obra" value={currency(kpis.realizadoMaoObra)} detail="Com comparecimento registrado" tone="info" />
            <MetricCard label="Realizado · Lanches" value={currency(kpis.realizadoLanches)} detail="Calculado pela solicitação" tone="info" />
            <MetricCard label="Diferença R$" value={currency(kpis.diferencaValor)} detail={`${currency(totalReal)} realizado vs. ${currency(totalPlanned)} previsto`} tone={differenceTone} />
            <MetricCard label="Diferença %" value={percent(kpis.diferencaPercentual)} detail="Realizado − previsto" tone={differenceTone} />
            <MetricCard label="Meta MO · Global" value={currency(kpis.metaMaoObra)} detail="Meta da competência, sem rateio por dimensão" tone="neutral" />
            <MetricCard label="Atingimento da Meta MO" value={percent(kpis.atingimentoMetaPercentual)} detail={`${kpis.totalSolicitacoes} solicitações · ${kpis.divergenciasComparecimento} divergência(s)`} tone={metaTone} />
          </div>
          <CompetenceComparison comparison={data.comparativoCompetencia} />
          <Card className={`dashboard-meta-alert dashboard-meta-alert-${data.alertaMeta.status.toLowerCase()} nx-dashboard-alert-card`}>
            <div className="dashboard-meta-alert-icon"><i className={data.alertaMeta.status === 'FORA_DA_META' ? 'pi pi-exclamation-triangle' : data.alertaMeta.status === 'NO_LIMITE_DA_META' ? 'pi pi-exclamation-circle' : data.alertaMeta.status === 'DENTRO_DA_META' ? 'pi pi-check-circle' : 'pi pi-info-circle'} aria-hidden="true" /></div>
            <div><span className="ui-eyebrow">STATUS DA META · MÃO DE OBRA</span><strong>{data.alertaMeta.titulo}</strong><p>{metaAlertMessage}</p>{remainingDailyMessage && <p>{remainingDailyMessage}</p>}</div>
            <div className="dashboard-meta-alert-value"><span>Projeção / Meta</span><strong>{percent(data.alertaMeta.percentualMetaProjetado)}</strong></div>
          </Card>
          <ProjectionChart points={data.evolucaoMetaProjecao} />
          <div className="dashboard-two-columns"><HorizontalRanking title="Custo por operação" subtitle="Ranking do realizado com referência do previsto." items={data.porOperacao} /><HorizontalRanking title="Custo por fornecedor" subtitle="Concentração financeira entre fornecedores no período." items={data.porFornecedor} /></div>
          <Card className="dashboard-card nx-dashboard-section-card">
            <div className="dashboard-card-header"><div><span className="ui-eyebrow">EVOLUÇÃO</span><h2>Movimento diário da competência</h2><p>Data operacional dentro da janela 21–20.</p></div></div>
            <div className="dashboard-daily-grid">{data.evolucaoDiaria.length ? data.evolucaoDiaria.map((item) => <div className="dashboard-daily-item" key={item.data}><span>{shortDate(item.data).slice(0, 5)}</span><strong>{currency(item.realizado)}</strong><small>Prev. {currency(item.previsto)}</small></div>) : <div className="ui-empty-state"><div><strong>Sem movimento</strong><p>Não há custos na combinação de filtros selecionada.</p></div></div>}</div>
          </Card>
        </div>
      ) : (
        <div className="dashboard-view">
          <div className="dashboard-analytics-summary"><MetricCard label="Solicitações analisadas" value={String(kpis.totalSolicitacoes)} detail="Após aplicação dos filtros" /><MetricCard label="Divergências de comparecimento" value={String(kpis.divergenciasComparecimento)} detail="Quantidade solicitada ≠ comparecida" tone={kpis.divergenciasComparecimento ? 'warning' : 'success'} /><MetricCard label="Desvio financeiro" value={currency(kpis.diferencaValor)} detail="Realizado − previsto" tone={differenceTone} /><MetricCard label="Atingimento da Meta MO" value={percent(kpis.atingimentoMetaPercentual)} detail="Meta global da competência" tone={metaTone} /></div>
          <AdvancedAnalytics data={data} />
          <div className="dashboard-two-columns"><HorizontalRanking title="Responsável pelo custo" subtitle="Separação entre custos Unilog, cliente e demais classificações." items={data.porResponsavelCusto} limit={6} /><HorizontalRanking title="Atividades" subtitle="Atividades com maior concentração de custos extras." items={data.porAtividade} limit={8} /></div>
        </div>
      )}</> : null}
    </div>
  )
}
