import type { CSSProperties } from 'react'
import type { DashboardAnalytics, DashboardResponse } from '../types/dashboard'

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

const LINEARITY_QUADRANTS = {
  topLeft: 'Alto custo · não recorrente',
  topRight: 'Alto custo · recorrente',
  bottomLeft: 'Baixo custo · não recorrente',
  bottomRight: 'Baixo custo · recorrente',
} as const

function currency(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

function percent(value: number | null | undefined) {
  if (value == null) return '—'
  return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}%`
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function emptyAnalytics(): DashboardAnalytics {
  return {
    diasSemana: [],
    paretoOperacao: [],
    concentracaoTop5Percentual: 0,
    concentracaoTop5Valor: 0,
    matrizOperacaoDiaSemana: [],
    linearidadeOperacao: [],
    maiorDesvio: null,
    oportunidades: [],
    potencialReducao: null,
    metodologiaPotencialReducao: '',
  }
}

function WeekdayChart({ analytics }: { analytics: DashboardAnalytics }) {
  const items = analytics.diasSemana
  const max = Math.max(...items.map((item) => item.realizado), 1)
  const width = 620
  const height = 270
  const left = 46
  const bottom = 36
  const top = 20
  const chartHeight = height - top - bottom
  const availableWidth = width - left - 14
  const slot = availableWidth / Math.max(items.length, 1)
  const barWidth = Math.min(48, slot * 0.62)
  const topItem = items.reduce(
    (best, item) => (!best || item.realizado > best.realizado ? item : best),
    items[0],
  )

  return (
    <section className="dashboard-card analytics-viz-card">
      <div className="dashboard-card-header">
        <div>
          <span className="ui-eyebrow">DIA DA SEMANA</span>
          <h2>Impacto por dia da semana</h2>
          <p>Custo realizado agrupado pela data operacional.</p>
        </div>
      </div>

      {items.length ? (
        <svg className="analytics-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Custo realizado por dia da semana">
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = top + chartHeight * (1 - ratio)
            return (
              <g key={ratio}>
                <line x1={left} x2={width - 10} y1={y} y2={y} className="analytics-grid-line" />
                <text x={left - 8} y={y + 4} textAnchor="end" className="analytics-axis-text">
                  {currency(max * ratio)}
                </text>
              </g>
            )
          })}

          {items.map((item, index) => {
            const h = (item.realizado / max) * chartHeight
            const x = left + slot * index + (slot - barWidth) / 2
            const y = top + chartHeight - h
            const isPeak = topItem?.chave === item.chave

            return (
              <g key={item.chave} className={isPeak ? 'analytics-bar-peak' : ''}>
                <rect x={x} y={y} width={barWidth} height={Math.max(h, 1)} rx="4" className="analytics-bar-column">
                  <title>{`${item.chave}: ${currency(item.realizado)} · ${item.solicitacoes} solicitação(ões)`}</title>
                </rect>
                <text x={x + barWidth / 2} y={Math.max(y - 6, 12)} textAnchor="middle" className="analytics-value-label">
                  {item.realizado ? currency(item.realizado) : ''}
                </text>
                <text x={x + barWidth / 2} y={height - 12} textAnchor="middle" className="analytics-axis-label">
                  {WEEKDAYS[index]}
                </text>
              </g>
            )
          })}
        </svg>
      ) : (
        <div className="ui-empty-state"><div><strong>Sem dados no período</strong></div></div>
      )}
    </section>
  )
}

function ParetoChart({ analytics }: { analytics: DashboardAnalytics }) {
  const items = analytics.paretoOperacao.slice(0, 8)
  const width = 660
  const height = 290
  const left = 118
  const right = 46
  const top = 22
  const bottom = 30
  const max = Math.max(...items.map((item) => item.realizado), 1)
  const row = (height - top - bottom) / Math.max(items.length, 1)
  const barMaxWidth = width - left - right
  const points = items.map((item, index) => ({
    x: left + (item.acumulado / 100) * barMaxWidth,
    y: top + row * index + row / 2,
  }))
  const line = points.map((point, index) => `${index ? 'L' : 'M'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ')

  return (
    <section className="dashboard-card analytics-viz-card">
      <div className="dashboard-card-header">
        <div>
          <span className="ui-eyebrow">PARETO</span>
          <h2>Custo por depositante</h2>
          <p>Barras = custo realizado · Linha = participação acumulada.</p>
        </div>
        <strong className="analytics-highlight">Top 5 {percent(analytics.concentracaoTop5Percentual)}</strong>
      </div>

      {items.length ? (
        <svg className="analytics-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Pareto do custo por depositante">
          {items.map((item, index) => {
            const y = top + row * index + row * 0.2
            const h = row * 0.6
            const w = (item.realizado / max) * barMaxWidth

            return (
              <g key={item.chave}>
                <text x={left - 8} y={y + h / 2 + 4} textAnchor="end" className="analytics-axis-label">{item.chave}</text>
                <rect x={left} y={y} width={barMaxWidth} height={h} rx="3" className="analytics-bar-track-svg" />
                <rect x={left} y={y} width={Math.max(w, 1)} height={h} rx="3" className="analytics-pareto-bar">
                  <title>{`${item.chave}: ${currency(item.realizado)} · ${percent(item.percentual)} · acumulado ${percent(item.acumulado)}`}</title>
                </rect>
                <text x={Math.min(left + w + 6, width - right)} y={y + h / 2 + 4} className="analytics-value-label">
                  {currency(item.realizado)}
                </text>
              </g>
            )
          })}
          <path d={line} className="analytics-pareto-line" />
          {points.map((point, index) => (
            <circle key={items[index].chave} cx={point.x} cy={point.y} r="4" className="analytics-pareto-point">
              <title>{`${items[index].chave}: ${percent(items[index].acumulado)} acumulado`}</title>
            </circle>
          ))}
        </svg>
      ) : (
        <div className="ui-empty-state"><div><strong>Sem dados para Pareto</strong></div></div>
      )}
    </section>
  )
}

function SupervisorRanking({ data }: { data: DashboardResponse }) {
  const items = data.porSupervisor.slice(0, 7)
  const max = Math.max(...items.map((item) => item.realizado), 1)

  return (
    <section className="dashboard-card analytics-viz-card">
      <div className="dashboard-card-header">
        <div>
          <span className="ui-eyebrow">SUPERVISÃO</span>
          <h2>Custo por supervisor</h2>
          <p>Ranking do realizado no escopo filtrado.</p>
        </div>
      </div>
      <div className="analytics-ranking-list">
        {items.map((item, index) => (
          <div className="analytics-ranking-item" key={item.chave}>
            <span className="analytics-rank">{index + 1}</span>
            <strong>{item.chave}</strong>
            <div><i style={{ width: `${Math.max((item.realizado / max) * 100, 2)}%` }} /></div>
            <span>{currency(item.realizado)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function Heatmap({ analytics }: { analytics: DashboardAnalytics }) {
  const rows = analytics.matrizOperacaoDiaSemana.slice(0, 8)
  const max = Math.max(...rows.flatMap((row) => row.valores), 1)

  return (
    <section className="dashboard-card analytics-viz-card">
      <div className="dashboard-card-header">
        <div>
          <span className="ui-eyebrow">PADRÃO DE SOLICITAÇÕES</span>
          <h2>Depositante × dia da semana</h2>
          <p>Intensidade do custo realizado por combinação.</p>
        </div>
      </div>

      {rows.length ? (
        <div className="analytics-heatmap">
          <div className="analytics-heatmap-head">
            <span />
            {WEEKDAYS.map((day) => <strong key={day}>{day}</strong>)}
          </div>

          {rows.map((row) => (
            <div className="analytics-heatmap-row" key={row.operacao}>
              <strong>{row.operacao}</strong>
              {row.valores.map((value, index) => (
                <span
                  key={`${row.operacao}-${index}`}
                  style={{ '--heat': String(value / max) } as CSSProperties}
                  title={`${row.operacao} · ${WEEKDAYS[index]}: ${currency(value)}`}
                >
                  {value ? currency(value) : '—'}
                </span>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="ui-empty-state"><div><strong>Sem matriz disponível</strong></div></div>
      )}
    </section>
  )
}

function LinearityScatter({ analytics }: { analytics: DashboardAnalytics }) {
  const items = analytics.linearidadeOperacao.slice(0, 10)
  const width = 660
  const height = 320
  const left = 66
  const right = 28
  const top = 20
  const bottom = 20
  const chartWidth = width - left - right
  const chartHeight = height - top - bottom
  const chartBottom = height - bottom
  const maxCost = Math.max(...items.map((item) => item.custo), 1)
  const maxRequests = Math.max(...items.map((item) => item.solicitacoes), 1)
  const centerX = left + chartWidth / 2
  const centerY = top + chartHeight / 2
  const bubblePadding = 3
  const labeledOperations = new Set(
    [...items]
      .sort((leftItem, rightItem) => rightItem.custo - leftItem.custo)
      .slice(0, 5)
      .map((item) => item.operacao),
  )

  return (
    <section className="dashboard-card analytics-viz-card">
      <div className="dashboard-card-header">
        <div>
          <span className="ui-eyebrow">LINEARIDADE × CUSTO</span>
          <h2>Regularidade da demanda × impacto</h2>
          <p>Tamanho da bolha = quantidade de solicitações. Os cinco maiores custos permanecem identificados; passe sobre as demais bolhas para ver o depositante.</p>
        </div>
      </div>

      {items.length ? (
        <div className="analytics-linearity-stage">
          <div className="analytics-linearity-edge-labels analytics-linearity-edge-labels-top" aria-label="Quadrantes de alto custo">
            <span>{LINEARITY_QUADRANTS.topLeft}</span>
            <span>{LINEARITY_QUADRANTS.topRight}</span>
          </div>

          <div className="analytics-linearity-plot-shell">
            <div className="analytics-linearity-axis-heading analytics-linearity-y-axis-heading">Custo realizado →</div>
            <svg className="analytics-svg analytics-linearity-svg" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Dispersão de linearidade e custo por depositante">
              <rect x={left} y={top} width={chartWidth} height={chartHeight} className="analytics-quadrant-frame" />
              <line x1={centerX} x2={centerX} y1={top} y2={chartBottom} className="analytics-quadrant-line" />
              <line x1={left} x2={width - right} y1={centerY} y2={centerY} className="analytics-quadrant-line" />

              {items.map((item, index) => {
                const r = 7 + (item.solicitacoes / maxRequests) * 11
                const rawX = left + (item.indiceLinearidade / 100) * chartWidth
                const rawY = top + chartHeight - (item.custo / maxCost) * chartHeight
                const x = clamp(rawX, left + r + bubblePadding, width - right - r - bubblePadding)
                const y = clamp(rawY, top + r + bubblePadding, chartBottom - r - bubblePadding)
                const labelRight = x < centerX
                const labelX = labelRight ? x + r + 5 : x - r - 5
                const labelY = y + (index % 2 === 0 ? -5 : 10)
                const labeled = labeledOperations.has(item.operacao)

                return (
                  <g key={item.operacao} className={`analytics-bubble-group ${labeled ? 'is-labeled' : ''}`}>
                    <circle cx={x} cy={y} r={r} className="analytics-bubble">
                      <title>{`${item.operacao} · Custo ${currency(item.custo)} · Linearidade ${percent(item.indiceLinearidade)} · CV ${percent(item.coeficienteVariacao)} · ${item.solicitacoes} solicitações`}</title>
                    </circle>
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor={labelRight ? 'start' : 'end'}
                      className="analytics-bubble-label"
                      pointerEvents="none"
                    >
                      {item.operacao}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>

          <div className="analytics-linearity-edge-labels analytics-linearity-edge-labels-bottom" aria-label="Quadrantes de baixo custo">
            <span>{LINEARITY_QUADRANTS.bottomLeft}</span>
            <span>{LINEARITY_QUADRANTS.bottomRight}</span>
          </div>

          <div className="analytics-linearity-axis-heading analytics-linearity-x-axis-heading">Índice de linearidade →</div>
        </div>
      ) : (
        <div className="ui-empty-state"><div><strong>Sem dados de linearidade</strong></div></div>
      )}
    </section>
  )
}

export function AdvancedAnalytics({ data }: { data: DashboardResponse }) {
  const analytics = data.analytics || emptyAnalytics()
  const topDay = analytics.diasSemana.reduce(
    (best, item) => (!best || item.realizado > best.realizado ? item : best),
    analytics.diasSemana[0],
  )
  const topOperation = analytics.paretoOperacao[0]
  const topSupervisor = data.porSupervisor[0]

  return (
    <div className="advanced-analytics-grid">
      <div className="dashboard-analytics-summary analytics-summary-five">
        <article className="dashboard-metric dashboard-metric-info">
          <span>Dia mais impactante</span>
          <strong>{topDay?.chave || '—'}</strong>
          <small>{topDay ? currency(topDay.realizado) : 'Sem movimento'}</small>
        </article>
        <article className="dashboard-metric">
          <span>Depositante líder</span>
          <strong>{topOperation?.chave || '—'}</strong>
          <small>{topOperation ? `${currency(topOperation.realizado)} · ${percent(topOperation.percentual)}` : 'Sem dados'}</small>
        </article>
        <article className="dashboard-metric">
          <span>Supervisor líder</span>
          <strong>{topSupervisor?.chave || '—'}</strong>
          <small>{topSupervisor ? currency(topSupervisor.realizado) : 'Sem dados'}</small>
        </article>
        <article className="dashboard-metric dashboard-metric-warning">
          <span>Concentração Top 5</span>
          <strong>{percent(analytics.concentracaoTop5Percentual)}</strong>
          <small>{currency(analytics.concentracaoTop5Valor)}</small>
        </article>
        <article className="dashboard-metric dashboard-metric-danger">
          <span>Maior desvio</span>
          <strong>{analytics.maiorDesvio ? percent(analytics.maiorDesvio.diferencaPercentual) : '—'}</strong>
          <small>{analytics.maiorDesvio ? `${analytics.maiorDesvio.chave} · ${currency(analytics.maiorDesvio.diferenca)}` : 'Sem desvio'}</small>
        </article>
      </div>

      <div className="analytics-three-columns">
        <WeekdayChart analytics={analytics} />
        <ParetoChart analytics={analytics} />
        <SupervisorRanking data={data} />
      </div>

      <div className="dashboard-two-columns">
        <Heatmap analytics={analytics} />
        <LinearityScatter analytics={analytics} />
      </div>

      <section className="dashboard-card analytics-opportunities-card">
        <div className="dashboard-card-header">
          <div>
            <span className="ui-eyebrow">OPORTUNIDADES DE REDUÇÃO</span>
            <h2>Achados baseados em evidências</h2>
            <p>Fato observado, evidência e ação recomendada. Economia não é estimada sem regra validada.</p>
          </div>
        </div>
        <div className="analytics-opportunities">
          {analytics.oportunidades.map((item, index) => (
            <article
              className={`analytics-opportunity analytics-opportunity-${item.severidade.toLowerCase()}`}
              key={`${index}-${item.titulo}`}
            >
              <span>{index + 1}</span>
              <div>
                <strong>{item.titulo}</strong>
                <p>{item.evidencia}</p>
                <small>Ação: {item.acao}</small>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
