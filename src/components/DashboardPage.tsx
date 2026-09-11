import { useEffect, useMemo, useState } from 'react'
import { fetchDashboard, revalidateDashboard } from '../services/dashboardService'
import { AdvancedAnalytics } from './AdvancedAnalytics'
import { DashboardExportActions } from './DashboardExportActions'
import type {
  DashboardBreakdownItem,
  DashboardCompetenceComparison,
  DashboardProjectionPoint,
  DashboardQuery,
  DashboardResponse,
  DashboardTypeFilter,
} from '../types/dashboard'

type DashboardTab = 'executiva' | 'analytics'
type MetricTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const MONTHS = [
  ['01', 'Janeiro'], ['02', 'Fevereiro'], ['03', 'Março'], ['04', 'Abril'],
  ['05', 'Maio'], ['06', 'Junho'], ['07', 'Julho'], ['08', 'Agosto'],
  ['09', 'Setembro'], ['10', 'Outubro'], ['11', 'Novembro'], ['12', 'Dezembro'],
] as const

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

function monthName(month: string) {
  return MONTHS.find(([value]) => value === month)?.[1] || month
}

function competenceLabel(competence: string) {
  const [year, month] = competence.split('-')
  return `${monthName(month)}/${year}`
}

function typeLabel(value: DashboardTypeFilter) {
  if (value === 'MAO_DE_OBRA') return 'Mão de obra'
  if (value === 'ALIMENTACAO_BEBIDA') return 'Lanches'
  return 'Todos os tipos'
}

function MetricCard({ label, value, detail, tone = 'neutral' }: { label: string; value: string; detail: string; tone?: MetricTone }) {
  return (
    <article className={`dashboard-metric dashboard-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function EconomyCard({ label, current, previous, featured = false }: { label: string; current: number; previous: number; featured?: boolean }) {
  const economy = previous - current
  const economyRate = economyPercent(current, previous)
  const state = economy > 0 ? 'saving' : economy < 0 ? 'increase' : 'neutral'
  const icon = economy > 0 ? 'trending_down' : economy < 0 ? 'trending_up' : 'remove'
  const detail = economy > 0
    ? `Economia de ${economyRate == null ? '—' : percent(economyRate)}`
    : economy < 0
      ? `Aumento de ${economyRate == null ? '—' : percent(Math.abs(economyRate))}`
      : 'Sem variação de custo'

  return (
    <article className={`dashboard-economy-card is-${state}${featured ? ' is-featured' : ''}`}>
      <div className="dashboard-economy-label">
        <span className="material-symbols-rounded" aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </div>
      <strong>{currency(Math.abs(economy))}</strong>
      <small>{detail}</small>
    </article>
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
      <section className="dashboard-card dashboard-comparison-card">
        <div className="dashboard-card-header">
          <div><span className="ui-eyebrow">COMPETÊNCIA × ANTERIOR</span><h2>Comparativo no mesmo intervalo realizado</h2><p>O corte é definido pela última data operacional com realizado válido.</p></div>
        </div>
        <div className="ui-empty-state"><div><strong>Comparativo ainda indisponível</strong><p>É necessário existir movimento realizado na competência selecionada.</p></div></div>
      </section>
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
    <section className="dashboard-card dashboard-comparison-card">
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
        <span className="material-symbols-rounded" aria-hidden="true">insights</span>
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
          const deltaIcon = item.delta == null || item.delta === 0 ? 'remove' : item.delta > 0 ? 'arrow_upward' : 'arrow_downward'
          return (
            <div className="dashboard-comparison-row" role="row" key={item.label}>
              <span role="cell">{item.label}</span>
              <strong role="cell">{item.current}</strong>
              <span role="cell">{item.previous}</span>
              <span role="cell" className={`dashboard-comparison-delta ${deltaClass}`}><span className="material-symbols-rounded" aria-hidden="true">{deltaIcon}</span>{signedPercent(item.delta)}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function HorizontalRanking({ title, subtitle, items, limit = 8 }: { title: string; subtitle: string; items: DashboardBreakdownItem[]; limit?: number }) {
  const visible = items.slice(0, limit)
  const max = Math.max(...visible.map((item) => Math.max(item.realizado, item.previsto)), 1)

  return (
    <section className="dashboard-card">
      <div className="dashboard-card-header">
        <div><span className="ui-eyebrow">ANÁLISE</span><h2>{title}</h2><p>{subtitle}</p></div>
      </div>
      <div className="dashboard-ranking">
        {visible.length === 0 ? (
          <div className="ui-empty-state"><div><strong>Sem dados no período</strong><p>Altere os filtros para ampliar a análise.</p></div></div>
        ) : visible.map((item) => (
          <div className="dashboard-ranking-row" key={item.chave}>
            <div className="dashboard-ranking-label"><strong>{item.chave}</strong><span>{item.solicitacoes} solicitação(ões)</span></div>
            <div className="dashboard-ranking-bars" aria-label={`${item.chave}: previsto ${currency(item.previsto)}, realizado ${currency(item.realizado)}`}>
              <div className="dashboard-bar-track"><span className="dashboard-bar dashboard-bar-planned" style={{ width: `${Math.max((item.previsto / max) * 100, item.previsto ? 2 : 0)}%` }} /></div>
              <div className="dashboard-bar-track"><span className="dashboard-bar dashboard-bar-real" style={{ width: `${Math.max((item.realizado / max) * 100, item.realizado ? 2 : 0)}%` }} /></div>
            </div>
            <div className="dashboard-ranking-values"><span>{currency(item.previsto)}</span><strong>{currency(item.realizado)}</strong></div>
          </div>
        ))}
      </div>
      <div className="dashboard-legend"><span><i className="legend-planned" />Previsto</span><span><i className="legend-real" />Realizado</span></div>
    </section>
  )
}

function buildPath(points: DashboardProjectionPoint[], field: 'realizadoAcumulado' | 'metaEsperada' | 'projecao', maxValue: number, width: number, height: number, padding: number) {
  let path = ''
  let drawing = false
  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2
  const denominator = Math.max(points.length - 1, 1)

  points.forEach((point, index) => {
    const value = point[field]
    if (value == null) {
      drawing = false
      return
    }
    const x = padding + (index / denominator) * usableWidth
    const y = padding + usableHeight - (value / maxValue) * usableHeight
    path += `${drawing ? ' L' : ' M'} ${x.toFixed(1)} ${y.toFixed(1)}`
    drawing = true
  })

  return path
}

function ProjectionChart({ points }: { points: DashboardProjectionPoint[] }) {
  const width = 920
  const height = 300
  const padding = 38
  const maxValue = Math.max(...points.flatMap((point) => [point.realizadoAcumulado || 0, point.metaEsperada || 0, point.projecao || 0]), 1)
  const realizedPath = buildPath(points, 'realizadoAcumulado', maxValue, width, height, padding)
  const expectedPath = buildPath(points, 'metaEsperada', maxValue, width, height, padding)
  const projectionPath = buildPath(points, 'projecao', maxValue, width, height, padding)
  const labels = points.length ? [points[0], points[Math.floor((points.length - 1) / 2)], points[points.length - 1]] : []
  const denominator = Math.max(points.length - 1, 1)
  const usableWidth = width - padding * 2
  const usableHeight = height - padding * 2

  return (
    <section className="dashboard-card dashboard-projection-card">
      <div className="dashboard-card-header"><div><span className="ui-eyebrow">META E TENDÊNCIA</span><h2>Realizado × Meta esperada × Projeção</h2><p>Acumulado de mão de obra ao longo da competência 21–20. Passe o cursor sobre os pontos para ver os valores.</p></div></div>
      {points.length ? (
        <div className="dashboard-chart-wrap">
          <svg className="dashboard-projection-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico acumulado de realizado, meta esperada e projeção de mão de obra">
            {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
              const y = padding + (height - padding * 2) * (1 - ratio)
              return <line key={ratio} x1={padding} x2={width - padding} y1={y} y2={y} className="dashboard-chart-grid" />
            })}
            <path d={expectedPath} className="dashboard-chart-line dashboard-chart-expected" />
            <path d={projectionPath} className="dashboard-chart-line dashboard-chart-projection" />
            <path d={realizedPath} className="dashboard-chart-line dashboard-chart-realized" />
            {points.map((point, index) => {
              const referenceValue = point.realizadoAcumulado ?? point.projecao ?? point.metaEsperada
              if (referenceValue == null) return null
              const x = padding + (index / denominator) * usableWidth
              const y = padding + usableHeight - (referenceValue / maxValue) * usableHeight
              const deltaExpected = point.realizadoAcumulado != null && point.metaEsperada != null ? point.realizadoAcumulado - point.metaEsperada : null
              const tooltip = [shortDate(point.data), `Realizado: ${currency(point.realizadoAcumulado)}`, `Meta esperada: ${currency(point.metaEsperada)}`, `Projeção: ${currency(point.projecao)}`, `Diferença vs. meta esperada: ${currency(deltaExpected)}`].join('\n')
              return <circle key={point.data} cx={x} cy={y} r="10" fill="transparent" stroke="transparent"><title>{tooltip}</title></circle>
            })}
          </svg>
          <div className="dashboard-chart-axis">{labels.map((point) => <span key={point.data}>{shortDate(point.data).slice(0, 5)}</span>)}</div>
          <div className="dashboard-chart-legend"><span><i className="chart-legend-realized" />Realizado</span><span><i className="chart-legend-expected" />Meta esperada</span><span><i className="chart-legend-projection" />Projeção</span></div>
        </div>
      ) : <div className="ui-empty-state"><div><strong>Sem série para exibir</strong></div></div>}
    </section>
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
        .then((latest) => {
          if (active) setData(latest)
        })
        .catch(() => undefined)
        .finally(() => {
          refreshing = false
        })
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refreshSilently()
    }

    const interval = window.setInterval(refreshSilently, 30_000)
    window.addEventListener('focus', refreshSilently)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      active = false
      window.clearInterval(interval)
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

  return (
    <div className="dashboard-page">
      <div className="dashboard-page-heading">
        <div><span className="ui-eyebrow">CUSTOS EXTRAS</span><h1>Visão geral</h1><p>Leitura executiva e analítica de mão de obra terceirizada e lanches.</p>{data && <p><strong>Competência: {monthName(data.competencia.slice(5, 7))}/{data.competencia.slice(0, 4)}</strong> · {shortDate(data.periodoInicio)} a {shortDate(data.periodoFim)}</p>}</div>
        <DashboardExportActions query={query} />
      </div>

      <div className="dashboard-tabs" role="tablist" aria-label="Áreas do dashboard"><button type="button" className={tab === 'executiva' ? 'active' : ''} onClick={() => setTab('executiva')}>Visão Executiva</button><button type="button" className={tab === 'analytics' ? 'active' : ''} onClick={() => setTab('analytics')}>Analytics</button></div>

      <section className="dashboard-filter-panel" aria-label="Filtros do dashboard"><div className="dashboard-filters">
        <label>Ano<select value={query.ano} onChange={(event) => update('ano', event.target.value)}>{(data?.filtros.anos.length ? data.filtros.anos : [query.ano || initial.ano]).map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label>Competência<select value={query.mesCompetencia} onChange={(event) => update('mesCompetencia', event.target.value)}>{(data?.filtros.mesesCompetencia.length ? data.filtros.mesesCompetencia : [query.mesCompetencia || initial.mesCompetencia]).map((value) => <option key={value} value={value}>{monthName(value)}</option>)}</select></label>
        <label>Operação<select value={query.operacao} onChange={(event) => update('operacao', event.target.value)}><option value="TODOS">Todas</option>{data?.filtros.operacoes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Supervisor<select value={query.supervisor} onChange={(event) => update('supervisor', event.target.value)}><option value="TODOS">Todos</option>{data?.filtros.supervisores.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Fornecedor<select value={query.fornecedor} onChange={(event) => update('fornecedor', event.target.value)}><option value="TODOS">Todos</option>{data?.filtros.fornecedores.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Tipo<select value={query.tipo} onChange={(event) => update('tipo', event.target.value as DashboardTypeFilter)}>{(['TODOS', 'MAO_DE_OBRA', 'ALIMENTACAO_BEBIDA'] as DashboardTypeFilter[]).map((item) => <option key={item} value={item}>{typeLabel(item)}</option>)}</select></label>
        <label>Responsável pelo custo<select value={query.responsavelCusto} onChange={(event) => update('responsavelCusto', event.target.value)}><option value="TODOS">Todos</option>{data?.filtros.responsaveisCusto.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <label>Atividade<select value={query.atividade} onChange={(event) => update('atividade', event.target.value)}><option value="TODOS">Todas</option>{data?.filtros.atividades.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
        <button type="button" className="button" onClick={clearDimensionFilters}>Limpar dimensões</button>
      </div></section>

      {loading && !data ? <div className="ui-panel"><div className="ui-skeleton"><span /><span /><span /><span /></div></div> : null}
      {error ? <div className="ui-panel"><div className="ui-empty-state ui-empty-state-error"><div><strong>Falha ao carregar o dashboard</strong><p>{error}</p></div></div></div> : null}

      {data && kpis ? <>{loading && <div className="dashboard-refreshing">Atualizando indicadores…</div>}{tab === 'executiva' ? (
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
          <section className={`dashboard-meta-alert dashboard-meta-alert-${data.alertaMeta.status.toLowerCase()}`}><div className="dashboard-meta-alert-icon"><span className="material-symbols-rounded" aria-hidden="true">{data.alertaMeta.status === 'FORA_DA_META' ? 'warning' : data.alertaMeta.status === 'NO_LIMITE_DA_META' ? 'error_outline' : data.alertaMeta.status === 'DENTRO_DA_META' ? 'check_circle' : 'info'}</span></div><div><span className="ui-eyebrow">STATUS DA META · MÃO DE OBRA</span><strong>{data.alertaMeta.titulo}</strong><p>{metaAlertMessage}</p>{remainingDailyMessage && <p>{remainingDailyMessage}</p>}</div><div className="dashboard-meta-alert-value"><span>Projeção / Meta</span><strong>{percent(data.alertaMeta.percentualMetaProjetado)}</strong></div></section>
          <ProjectionChart points={data.evolucaoMetaProjecao} />
          <div className="dashboard-two-columns"><HorizontalRanking title="Custo por operação" subtitle="Ranking do realizado com referência do previsto." items={data.porOperacao} /><HorizontalRanking title="Custo por fornecedor" subtitle="Concentração financeira entre fornecedores no período." items={data.porFornecedor} /></div>
          <section className="dashboard-card"><div className="dashboard-card-header"><div><span className="ui-eyebrow">EVOLUÇÃO</span><h2>Movimento diário da competência</h2><p>Data operacional dentro da janela 21–20.</p></div></div><div className="dashboard-daily-grid">{data.evolucaoDiaria.length ? data.evolucaoDiaria.map((item) => <div className="dashboard-daily-item" key={item.data}><span>{shortDate(item.data).slice(0, 5)}</span><strong>{currency(item.realizado)}</strong><small>Prev. {currency(item.previsto)}</small></div>) : <div className="ui-empty-state"><div><strong>Sem movimento</strong><p>Não há custos na combinação de filtros selecionada.</p></div></div>}</div></section>
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
