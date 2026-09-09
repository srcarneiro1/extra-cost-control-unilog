import { useEffect, useMemo, useState } from 'react'
import { fetchDashboard } from '../services/dashboardService'
import type {
  DashboardBreakdownItem,
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

function percent(value: number | null | undefined) {
  if (value == null) return '—'
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}%`
}

function shortDate(value: string) {
  if (!value) return '—'
  const [year, month, day] = value.split('-')
  return `${day}/${month}/${year}`
}

function monthName(month: string) {
  return MONTHS.find(([value]) => value === month)?.[1] || month
}

function typeLabel(value: DashboardTypeFilter) {
  if (value === 'MAO_DE_OBRA') return 'Mão de obra'
  if (value === 'ALIMENTACAO_BEBIDA') return 'Lanches'
  return 'Todos os tipos'
}

function MetricCard({
  label,
  value,
  detail,
  tone = 'neutral',
}: {
  label: string
  value: string
  detail: string
  tone?: MetricTone
}) {
  return (
    <article className={`dashboard-metric dashboard-metric-${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  )
}

function HorizontalRanking({
  title,
  subtitle,
  items,
  limit = 8,
}: {
  title: string
  subtitle: string
  items: DashboardBreakdownItem[]
  limit?: number
}) {
  const visible = items.slice(0, limit)
  const max = Math.max(...visible.map((item) => Math.max(item.realizado, item.previsto)), 1)

  return (
    <section className="dashboard-card">
      <div className="dashboard-card-header">
        <div>
          <span className="ui-eyebrow">ANÁLISE</span>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
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

function buildPath(
  points: DashboardProjectionPoint[],
  field: 'realizadoAcumulado' | 'metaEsperada' | 'projecao',
  maxValue: number,
  width: number,
  height: number,
  padding: number,
) {
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
  const maxValue = Math.max(
    ...points.flatMap((point) => [point.realizadoAcumulado || 0, point.metaEsperada || 0, point.projecao || 0]),
    1,
  )
  const realizedPath = buildPath(points, 'realizadoAcumulado', maxValue, width, height, padding)
  const expectedPath = buildPath(points, 'metaEsperada', maxValue, width, height, padding)
  const projectionPath = buildPath(points, 'projecao', maxValue, width, height, padding)
  const labels = points.length ? [points[0], points[Math.floor((points.length - 1) / 2)], points[points.length - 1]] : []

  return (
    <section className="dashboard-card dashboard-projection-card">
      <div className="dashboard-card-header">
        <div>
          <span className="ui-eyebrow">META E TENDÊNCIA</span>
          <h2>Realizado × Meta esperada × Projeção</h2>
          <p>Linha acumulada de mão de obra. A meta esperada avança proporcionalmente aos dias corridos da competência.</p>
        </div>
      </div>
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
          </svg>
          <div className="dashboard-chart-axis">
            {labels.map((point) => <span key={point.data}>{shortDate(point.data).slice(0, 5)}</span>)}
          </div>
          <div className="dashboard-chart-legend">
            <span><i className="chart-legend-realized" />Realizado</span>
            <span><i className="chart-legend-expected" />Meta esperada</span>
            <span><i className="chart-legend-projection" />Projeção</span>
          </div>
        </div>
      ) : (
        <div className="ui-empty-state"><div><strong>Sem série para exibir</strong></div></div>
      )}
    </section>
  )
}

export function DashboardPage() {
  const initial = useMemo(currentCompetence, [])
  const [tab, setTab] = useState<DashboardTab>('executiva')
  const [query, setQuery] = useState<DashboardQuery>({
    ano: initial.ano,
    mesCompetencia: initial.mesCompetencia,
    operacao: 'TODOS',
    supervisor: 'TODOS',
    fornecedor: 'TODOS',
    tipo: 'TODOS',
    responsavelCusto: 'TODOS',
    atividade: 'TODOS',
  })
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
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })

    return () => controller.abort()
  }, [query])

  function update<K extends keyof DashboardQuery>(field: K, value: DashboardQuery[K]) {
    setQuery((current) => ({ ...current, [field]: value }))
  }

  function clearDimensionFilters() {
    setQuery((current) => ({
      ...current,
      operacao: 'TODOS',
      supervisor: 'TODOS',
      fornecedor: 'TODOS',
      tipo: 'TODOS',
      responsavelCusto: 'TODOS',
      atividade: 'TODOS',
    }))
  }

  const kpis = data?.kpis
  const projection = data?.projecao
  const totalPlanned = (kpis?.previstoMaoObra || 0) + (kpis?.previstoLanches || 0)
  const totalReal = (kpis?.realizadoMaoObra || 0) + (kpis?.realizadoLanches || 0)
  const differenceTone: MetricTone = !kpis?.diferencaValor ? 'neutral' : kpis.diferencaValor > 0 ? 'danger' : 'success'
  const metaTone: MetricTone = projection?.percentualMetaProjetado == null
    ? 'neutral'
    : projection.percentualMetaProjetado > 100
      ? 'danger'
      : projection.percentualMetaProjetado > 95
        ? 'warning'
        : 'success'

  const paretoOperations = useMemo(() => {
    if (!data) return []
    const total = data.porOperacao.reduce((sum, item) => sum + item.realizado, 0)
    let accumulated = 0
    return data.porOperacao.slice(0, 10).map((item) => {
      accumulated += item.realizado
      return {
        ...item,
        acumulado: total ? (accumulated / total) * 100 : 0,
      }
    })
  }, [data])

  return (
    <div className="dashboard-page">
      <div className="dashboard-page-heading">
        <div>
          <span className="ui-eyebrow">CUSTOS EXTRAS</span>
          <h1>Visão geral</h1>
          <p>Leitura executiva e analítica de mão de obra terceirizada e lanches.</p>
        </div>
        {data && <div className="dashboard-period-badge"><span>Competência</span><strong>{monthName(data.competencia.slice(5, 7))}/{data.competencia.slice(0, 4)}</strong><small>{shortDate(data.periodoInicio)} a {shortDate(data.periodoFim)}</small></div>}
      </div>

      <div className="dashboard-tabs" role="tablist" aria-label="Áreas do dashboard">
        <button type="button" className={tab === 'executiva' ? 'active' : ''} onClick={() => setTab('executiva')}>Visão Executiva</button>
        <button type="button" className={tab === 'analytics' ? 'active' : ''} onClick={() => setTab('analytics')}>Analytics</button>
      </div>

      <section className="dashboard-filter-panel" aria-label="Filtros do dashboard">
        <div className="dashboard-filters">
          <label>Ano<select value={query.ano} onChange={(event) => update('ano', event.target.value)}>{(data?.filtros.anos.length ? data.filtros.anos : [query.ano || initial.ano]).map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
          <label>Competência<select value={query.mesCompetencia} onChange={(event) => update('mesCompetencia', event.target.value)}>{MONTHS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label>Operação<select value={query.operacao} onChange={(event) => update('operacao', event.target.value)}><option value="TODOS">Todas</option>{data?.filtros.operacoes.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Supervisor<select value={query.supervisor} onChange={(event) => update('supervisor', event.target.value)}><option value="TODOS">Todos</option>{data?.filtros.supervisores.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Fornecedor<select value={query.fornecedor} onChange={(event) => update('fornecedor', event.target.value)}><option value="TODOS">Todos</option>{data?.filtros.fornecedores.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Tipo<select value={query.tipo} onChange={(event) => update('tipo', event.target.value as DashboardTypeFilter)}>{(['TODOS', 'MAO_DE_OBRA', 'ALIMENTACAO_BEBIDA'] as DashboardTypeFilter[]).map((item) => <option key={item} value={item}>{typeLabel(item)}</option>)}</select></label>
          <label>Responsável pelo custo<select value={query.responsavelCusto} onChange={(event) => update('responsavelCusto', event.target.value)}><option value="TODOS">Todos</option>{data?.filtros.responsaveisCusto.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <label>Atividade<select value={query.atividade} onChange={(event) => update('atividade', event.target.value)}><option value="TODOS">Todas</option>{data?.filtros.atividades.map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
          <button type="button" className="button" onClick={clearDimensionFilters}>Limpar dimensões</button>
        </div>
      </section>

      {loading && !data ? <div className="ui-panel"><div className="ui-skeleton"><span /><span /><span /><span /></div></div> : null}
      {error ? <div className="ui-panel"><div className="ui-empty-state ui-empty-state-error"><div><strong>Falha ao carregar o dashboard</strong><p>{error}</p></div></div></div> : null}

      {data && kpis && projection ? (
        <>
          {loading && <div className="dashboard-refreshing">Atualizando indicadores…</div>}

          {tab === 'executiva' ? (
            <div className="dashboard-view">
              <section className={`dashboard-meta-alert dashboard-meta-alert-${data.alertaMeta.status.toLowerCase()}`}>
                <div className="dashboard-meta-alert-icon"><span className="material-symbols-rounded" aria-hidden="true">{data.alertaMeta.status === 'FORA_DA_META' ? 'warning' : data.alertaMeta.status === 'NO_LIMITE_DA_META' ? 'error_outline' : data.alertaMeta.status === 'DENTRO_DA_META' ? 'check_circle' : 'info'}</span></div>
                <div><span className="ui-eyebrow">STATUS DA META · MÃO DE OBRA</span><strong>{data.alertaMeta.titulo}</strong><p>{data.alertaMeta.mensagem}</p></div>
                <div className="dashboard-meta-alert-value"><span>Projeção / Meta</span><strong>{percent(data.alertaMeta.percentualMetaProjetado)}</strong></div>
              </section>

              <div className="dashboard-metrics-grid">
                <MetricCard label="Previsto · Mão de obra" value={currency(kpis.previstoMaoObra)} detail="Solicitações da competência" />
                <MetricCard label="Previsto · Lanches" value={currency(kpis.previstoLanches)} detail="Alimentação e bebida" />
                <MetricCard label="Realizado · Mão de obra" value={currency(kpis.realizadoMaoObra)} detail="Com comparecimento registrado" tone="info" />
                <MetricCard label="Realizado · Lanches" value={currency(kpis.realizadoLanches)} detail="Calculado pela solicitação" tone="info" />
                <MetricCard label="Meta MO · Global" value={currency(kpis.metaMaoObra)} detail="Meta total da competência" />
                <MetricCard label="Meta esperada até hoje" value={currency(projection.metaEsperadaAteHoje)} detail={`${projection.diasDecorridos} de ${projection.totalDias} dias corridos`} tone={metaTone} />
                <MetricCard label="Projeção final · MO" value={currency(projection.projecaoFinalMaoObra)} detail={`${percent(projection.percentualMetaProjetado)} da meta`} tone={metaTone} />
                <MetricCard label="Exposição conhecida · MO" value={currency(projection.exposicaoConhecidaMaoObra)} detail="Realizado + compromissos ainda não confirmados" tone="info" />
                <MetricCard label="Diferença R$" value={currency(kpis.diferencaValor)} detail={`${currency(totalReal)} realizado vs. ${currency(totalPlanned)} previsto`} tone={differenceTone} />
                <MetricCard label="Diferença %" value={percent(kpis.diferencaPercentual)} detail="Realizado − previsto" tone={differenceTone} />
                <MetricCard label="Atingimento atual da Meta MO" value={percent(kpis.atingimentoMetaPercentual)} detail="Realizado atual ÷ meta" tone={metaTone} />
                <MetricCard label="Ritmo diário realizado · MO" value={currency(projection.ritmoDiarioRealizado)} detail={`${projection.diasRestantes} dia(s) restante(s)`} />
              </div>

              <ProjectionChart points={data.evolucaoMetaProjecao} />

              <div className="dashboard-two-columns">
                <HorizontalRanking title="Custo por operação" subtitle="Ranking do realizado com referência do previsto." items={data.porOperacao} />
                <HorizontalRanking title="Custo por fornecedor" subtitle="Concentração financeira entre fornecedores no período." items={data.porFornecedor} />
              </div>

              <section className="dashboard-card">
                <div className="dashboard-card-header"><div><span className="ui-eyebrow">EVOLUÇÃO</span><h2>Movimento diário da competência</h2><p>Data operacional dentro da janela 21–20.</p></div></div>
                <div className="dashboard-daily-grid">
                  {data.evolucaoDiaria.length ? data.evolucaoDiaria.map((item) => (
                    <div className="dashboard-daily-item" key={item.data}><span>{shortDate(item.data).slice(0, 5)}</span><strong>{currency(item.realizado)}</strong><small>Prev. {currency(item.previsto)}</small></div>
                  )) : <div className="ui-empty-state"><div><strong>Sem movimento</strong><p>Não há custos na combinação de filtros selecionada.</p></div></div>}
                </div>
              </section>
            </div>
          ) : (
            <div className="dashboard-view">
              <div className="dashboard-analytics-summary">
                <MetricCard label="Solicitações analisadas" value={String(kpis.totalSolicitacoes)} detail="Após aplicação dos filtros" />
                <MetricCard label="Divergências de comparecimento" value={String(kpis.divergenciasComparecimento)} detail="Quantidade solicitada ≠ comparecida" tone={kpis.divergenciasComparecimento ? 'warning' : 'success'} />
                <MetricCard label="Projeção final · MO" value={currency(projection.projecaoFinalMaoObra)} detail={`${percent(projection.percentualMetaProjetado)} da meta`} tone={metaTone} />
                <MetricCard label="Desvio projetado da meta" value={currency(projection.desvioProjetadoMeta)} detail="Projeção final − meta" tone={metaTone} />
              </div>

              <div className="dashboard-two-columns">
                <section className="dashboard-card">
                  <div className="dashboard-card-header"><div><span className="ui-eyebrow">PARETO</span><h2>Concentração por operação</h2><p>Participação acumulada do custo realizado.</p></div></div>
                  <div className="dashboard-pareto">
                    {paretoOperations.map((item) => (
                      <div className="dashboard-pareto-row" key={item.chave}><strong>{item.chave}</strong><span>{currency(item.realizado)}</span><div><i style={{ width: `${Math.min(item.acumulado, 100)}%` }} /></div><small>{percent(item.acumulado)} acumulado</small></div>
                    ))}
                    {!paretoOperations.length && <div className="ui-empty-state"><div><strong>Sem dados para Pareto</strong></div></div>}
                  </div>
                </section>
                <HorizontalRanking title="Responsável pelo custo" subtitle="Separação entre custos Unilog, cliente e demais classificações." items={data.porResponsavelCusto} limit={6} />
              </div>

              <div className="dashboard-two-columns">
                <HorizontalRanking title="Supervisores" subtitle="Distribuição do custo realizado por supervisão." items={data.porSupervisor} limit={8} />
                <HorizontalRanking title="Atividades" subtitle="Atividades com maior concentração de custos extras." items={data.porAtividade} limit={8} />
              </div>
            </div>
          )}
        </>
      ) : null}
    </div>
  )
}
