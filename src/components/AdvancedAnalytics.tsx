import { useMemo } from 'react'
import type { DashboardResponse } from '../types/dashboard'

const WEEKDAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function currency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 2,
  }).format(value)
}

function percent(value: number) {
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}%`
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export function AdvancedAnalytics({ data }: { data: DashboardResponse }) {
  const analytics = useMemo(() => {
    const weekdayMap = WEEKDAYS.map((label) => ({ label, realizado: 0, previsto: 0, dias: 0 }))
    const activeDays = data.evolucaoDiaria.filter((item) => item.realizado > 0 || item.previsto > 0)

    activeDays.forEach((item) => {
      const weekday = parseIsoDate(item.data).getDay()
      weekdayMap[weekday].realizado += item.realizado
      weekdayMap[weekday].previsto += item.previsto
      weekdayMap[weekday].dias += 1
    })

    const dailyValues = activeDays.map((item) => item.realizado)
    const total = dailyValues.reduce((sum, value) => sum + value, 0)
    const average = dailyValues.length ? total / dailyValues.length : 0
    const variance = dailyValues.length
      ? dailyValues.reduce((sum, value) => sum + Math.pow(value - average, 2), 0) / dailyValues.length
      : 0
    const deviation = Math.sqrt(variance)
    const cv = average ? (deviation / average) * 100 : 0
    const linearity = cv <= 25 ? 'ALTA' : cv <= 50 ? 'MÉDIA' : 'BAIXA'

    const peak = activeDays.reduce((max, item) => item.realizado > max.realizado ? item : max, { data: '', realizado: 0, previsto: 0 })
    const topOperation = data.porOperacao[0]
    const topSupervisor = data.porSupervisor[0]
    const operationsTotal = data.porOperacao.reduce((sum, item) => sum + item.realizado, 0)
    const supervisorsTotal = data.porSupervisor.reduce((sum, item) => sum + item.realizado, 0)
    const operationShare = topOperation && operationsTotal ? (topOperation.realizado / operationsTotal) * 100 : 0
    const supervisorShare = topSupervisor && supervisorsTotal ? (topSupervisor.realizado / supervisorsTotal) * 100 : 0

    const sizingGap = data.porOperacao.reduce((sum, item) => sum + Math.max(item.previsto - item.realizado, 0), 0)
    const overrun = data.porOperacao.reduce((sum, item) => sum + Math.max(item.realizado - item.previsto, 0), 0)

    const opportunities: string[] = []
    if (data.kpis.divergenciasComparecimento > 0) opportunities.push(`${data.kpis.divergenciasComparecimento} divergência(s) de comparecimento pedem revisão de dimensionamento.`)
    if (operationShare >= 50 && topOperation) opportunities.push(`${topOperation.chave} concentra ${percent(operationShare)} do custo realizado; priorize a análise dessa operação.`)
    if (cv > 50) opportunities.push(`A distribuição diária está pouco linear (CV ${percent(cv)}), indicando picos relevantes ao longo da competência.`)
    if (sizingGap > 0) opportunities.push(`Há ${currency(sizingGap)} de gap entre valores previstos e realizados em operações onde o realizado ficou abaixo do planejado.`)
    if (overrun > 0) opportunities.push(`Há ${currency(overrun)} de estouro acumulado nas operações em que o realizado superou o previsto.`)
    if (!opportunities.length) opportunities.push('Não há sinal material de desvio pelos critérios atuais; mantenha o acompanhamento da competência.')

    return {
      weekdayMap,
      activeDays: activeDays.length,
      average,
      cv,
      linearity,
      peak,
      topOperation,
      operationShare,
      topSupervisor,
      supervisorShare,
      sizingGap,
      overrun,
      opportunities,
    }
  }, [data])

  const weekdayMax = Math.max(...analytics.weekdayMap.map((item) => item.realizado), 1)

  return (
    <>
      <div className="dashboard-analytics-summary">
        <article className="dashboard-metric dashboard-metric-info"><span>Média por dia ativo</span><strong>{currency(analytics.average)}</strong><small>{analytics.activeDays} dia(s) com movimento</small></article>
        <article className="dashboard-metric"><span>Linearidade do custo</span><strong>{analytics.linearity}</strong><small>Coeficiente de variação: {percent(analytics.cv)}</small></article>
        <article className="dashboard-metric dashboard-metric-warning"><span>Gap de dimensionamento</span><strong>{currency(analytics.sizingGap)}</strong><small>Previsto acima do realizado por operação</small></article>
        <article className="dashboard-metric dashboard-metric-danger"><span>Estouro sobre previsto</span><strong>{currency(analytics.overrun)}</strong><small>Realizado acima do previsto por operação</small></article>
      </div>

      <div className="dashboard-two-columns">
        <section className="dashboard-card">
          <div className="dashboard-card-header"><div><span className="ui-eyebrow">DIA DA SEMANA</span><h2>Impacto do custo por dia</h2><p>Realizado agrupado pela data operacional.</p></div></div>
          <div className="dashboard-ranking">
            {analytics.weekdayMap.map((item) => (
              <div className="dashboard-ranking-row" key={item.label}>
                <div className="dashboard-ranking-label"><strong>{item.label}</strong><span>{item.dias} dia(s) com movimento</span></div>
                <div className="dashboard-ranking-bars"><div className="dashboard-bar-track"><span className="dashboard-bar dashboard-bar-real" style={{ width: `${Math.max((item.realizado / weekdayMax) * 100, item.realizado ? 2 : 0)}%` }} /></div></div>
                <div className="dashboard-ranking-values"><strong>{currency(item.realizado)}</strong><span>Prev. {currency(item.previsto)}</span></div>
              </div>
            ))}
          </div>
        </section>

        <section className="dashboard-card">
          <div className="dashboard-card-header"><div><span className="ui-eyebrow">PADRÃO</span><h2>Concentração e pico</h2><p>Leitura rápida dos principais vetores do custo.</p></div></div>
          <div className="dashboard-pareto">
            <div className="dashboard-pareto-row"><strong>Maior depositante</strong><span>{analytics.topOperation?.chave || '—'}</span><small>{analytics.topOperation ? `${currency(analytics.topOperation.realizado)} · ${percent(analytics.operationShare)} do realizado` : 'Sem dados'}</small></div>
            <div className="dashboard-pareto-row"><strong>Maior supervisor</strong><span>{analytics.topSupervisor?.chave || '—'}</span><small>{analytics.topSupervisor ? `${currency(analytics.topSupervisor.realizado)} · ${percent(analytics.supervisorShare)} do realizado` : 'Sem dados'}</small></div>
            <div className="dashboard-pareto-row"><strong>Maior dia</strong><span>{analytics.peak.data ? analytics.peak.data.split('-').reverse().join('/') : '—'}</span><small>{analytics.peak.data ? currency(analytics.peak.realizado) : 'Sem movimento'}</small></div>
            <div className="dashboard-pareto-row"><strong>Dispersão diária</strong><span>{analytics.linearity}</span><small>CV de {percent(analytics.cv)}; quanto menor, mais linear é o custo.</small></div>
          </div>
        </section>
      </div>

      <section className="dashboard-card">
        <div className="dashboard-card-header"><div><span className="ui-eyebrow">OPORTUNIDADES</span><h2>Sinais para redução de custo</h2><p>Diagnóstico indicativo; não trata o valor como economia garantida sem validação operacional.</p></div></div>
        <div className="dashboard-pareto">
          {analytics.opportunities.map((item, index) => <div className="dashboard-pareto-row" key={`${index}-${item}`}><strong>{String(index + 1).padStart(2, '0')}</strong><span>{item}</span></div>)}
        </div>
      </section>
    </>
  )
}
