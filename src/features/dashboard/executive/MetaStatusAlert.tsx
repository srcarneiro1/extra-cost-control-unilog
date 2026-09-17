'use client'

import { Card } from 'primereact/card'
import { currency, percent } from '@/features/dashboard/dashboardFormatters'
import type { DashboardResponse } from '@/types/dashboard'

export function MetaStatusAlert({ data }: { data: DashboardResponse }) {
  const kpis = data.kpis
  const metaAlertMessage = data.alertaMeta.status === 'FORA_DA_META'
    ? `Mantido o ritmo atual, a projeção supera a meta em ${currency(Math.max(data.alertaMeta.desvioProjetadoMeta || 0, 0))}.`
    : data.alertaMeta.mensagem || ''
  const remainingDailyLimit = kpis.metaMaoObra != null && data.projecao.diasRestantes > 0
    ? (kpis.metaMaoObra - kpis.realizadoMaoObra) / data.projecao.diasRestantes
    : null
  const remainingDailyMessage = remainingDailyLimit == null
    ? ''
    : remainingDailyLimit >= 0
      ? `Limite médio restante: ${currency(remainingDailyLimit)}/dia por ${data.projecao.diasRestantes} dia(s).`
      : `A meta realizada já foi excedida em ${currency(Math.abs((kpis.metaMaoObra || 0) - (kpis.realizadoMaoObra || 0)))}.`

  return (
    <Card className={`dashboard-meta-alert dashboard-meta-alert-${data.alertaMeta.status.toLowerCase()} nx-dashboard-alert-card`}>
      <div className="dashboard-meta-alert-icon"><i className={data.alertaMeta.status === 'FORA_DA_META' ? 'pi pi-exclamation-triangle' : data.alertaMeta.status === 'NO_LIMITE_DA_META' ? 'pi pi-exclamation-circle' : data.alertaMeta.status === 'DENTRO_DA_META' ? 'pi pi-check-circle' : 'pi pi-info-circle'} aria-hidden="true" /></div>
      <div><span className="ui-eyebrow">STATUS DA META · MÃO DE OBRA</span><strong>{data.alertaMeta.titulo}</strong><p>{metaAlertMessage}</p>{remainingDailyMessage && <p>{remainingDailyMessage}</p>}</div>
      <div className="dashboard-meta-alert-value"><span>Projeção / Meta</span><strong>{percent(data.alertaMeta.percentualMetaProjetado)}</strong></div>
    </Card>
  )
}
