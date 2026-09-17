'use client'

import { Card } from 'primereact/card'
import type { DashboardCompetenceComparison } from '@/types/dashboard'
import {
  competenceLabel,
  currency,
  economyPercent,
  percent,
  quantity,
  shortDate,
  signedPercent,
} from '@/features/dashboard/dashboardFormatters'

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

export function CompetenceComparison({ comparison }: { comparison: DashboardCompetenceComparison | undefined }) {
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
          <small>{volumeSentence('Mão de obra', variation.quantidadeMaoObraPercentual)} {volumeSentence('Lanches e bebidas', variation.quantidadeMaoObraPercentual)}</small>
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
