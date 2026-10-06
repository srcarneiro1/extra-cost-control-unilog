'use client'

import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Tag } from 'primereact/tag'
import {
  consideredQuantityBody,
  formatDate,
  formatDateTime,
  formatMoney,
  requestedQuantityBody,
  statusInfo,
  typeLabel,
} from '@/features/solicitations/administrative/solicitationPresentation'
import type { AdministrativeSolicitationListItem, AdministrativeTransitionStatus } from '@/types/solicitation'

type Props = {
  items: AdministrativeSolicitationListItem[]
  canAdminister: boolean
  detailLoading: boolean
  deleteLoading: string | null
  quickLoading: string | null
  quickActionKey: string | null
  onScheduleDetailPrefetch: (idSolicitacao: string, delay?: number) => void
  onCancelDetailPrefetch: () => void
  onEnsureCatalogsForAction: () => void
  onQuickStatus: (item: AdministrativeSolicitationListItem, status: AdministrativeTransitionStatus, message: string) => void
  onCopySummary: (item: AdministrativeSolicitationListItem) => void
  onOpenSupplier: (item: AdministrativeSolicitationListItem) => void
  onOpenDetail: (idSolicitacao: string) => void
  onOpenCorrection: (idSolicitacao: string) => void
  onOpenDelete: (item: AdministrativeSolicitationListItem) => void
}

export function AdminSolicitationsTable({
  items,
  canAdminister,
  detailLoading,
  deleteLoading,
  quickLoading,
  quickActionKey,
  onScheduleDetailPrefetch,
  onCancelDetailPrefetch,
  onEnsureCatalogsForAction,
  onQuickStatus,
  onCopySummary,
  onOpenSupplier,
  onOpenDetail,
  onOpenCorrection,
  onOpenDelete,
}: Props) {
  const solicitationBody = (item: AdministrativeSolicitationListItem) => (
    <div className="nx-user-cell"><strong>{item.idSolicitacao}</strong><small>{item.supervisor || 'Sem supervisor'}</small></div>
  )
  const typeBody = (item: AdministrativeSolicitationListItem) => <Tag value={typeLabel(item.tipoSolicitacao)} severity="secondary" rounded />
  const statusBody = (item: AdministrativeSolicitationListItem) => {
    const status = statusInfo(item)
    return <Tag value={status.label} severity={status.severity} rounded className="nx-solicitation-status-tag" />
  }
  const actionsBody = (item: AdministrativeSolicitationListItem) => {
    const busy = Boolean(deleteLoading) || quickLoading === item.idSolicitacao
    const activeAction = quickLoading === item.idSolicitacao ? quickActionKey : null
    const actionIcon = (key: string, icon: string) => activeAction === key ? 'pi pi-spin pi-spinner' : icon
    const canShare = canAdminister && item.triagemConcluida && ['EM_TRIAGEM', 'ENVIADA_AO_FORNECEDOR', 'EM_ATENDIMENTO'].includes(item.status)
    return (
      <div
        className={`nx-modern-actions nx-solicitation-row-actions ${canAdminister ? 'is-admin' : 'is-readonly'}`}
        onMouseEnter={() => onScheduleDetailPrefetch(item.idSolicitacao)}
        onMouseLeave={onCancelDetailPrefetch}
        onFocusCapture={() => onScheduleDetailPrefetch(item.idSolicitacao, 0)}
      >
        {canAdminister && item.status === 'ENVIADA' && item.triagemConcluida && <Button icon={actionIcon('status:EM_TRIAGEM', 'pi pi-arrow-right')} aria-label="Retomar triagem" title="Retomar triagem" size="small" outlined disabled={busy} onClick={() => onQuickStatus(item, 'EM_TRIAGEM', 'Solicitação retomada para triagem.')} />}
        {canAdminister && item.status === 'EM_TRIAGEM' && <Button icon={actionIcon('status:AGUARDANDO_AJUSTE', 'pi pi-undo')} aria-label="Aguardando ajuste" title="Aguardando ajuste" size="small" outlined disabled={busy} onClick={() => onQuickStatus(item, 'AGUARDANDO_AJUSTE', 'Solicitação direcionada para ajuste.')} />}
        {canShare && <Button icon={actionIcon('copy', 'pi pi-copy')} aria-label="Copiar resumo" title="Copiar resumo" size="small" text disabled={busy} onClick={() => onCopySummary(item)} />}
        {canShare && <Button icon={actionIcon('supplier', 'pi pi-whatsapp')} aria-label="Abrir fornecedor" title="Abrir fornecedor" size="small" text disabled={busy} onMouseEnter={onEnsureCatalogsForAction} onFocus={onEnsureCatalogsForAction} onClick={() => onOpenSupplier(item)} />}
        {/* Fluxo simplificado: alimentação/bebida é concluída direto da triagem (registros antigos em
            "Enviada ao fornecedor"/"Em atendimento" também podem ser concluídos). Mão de obra conclui
            pelo registro de comparecimento, no detalhe. */}
        {canAdminister && item.tipoSolicitacao === 'ALIMENTACAO_BEBIDA' && item.triagemConcluida && ['EM_TRIAGEM', 'ENVIADA_AO_FORNECEDOR', 'EM_ATENDIMENTO'].includes(item.status) && <Button icon={actionIcon('status:ATENDIDA', 'pi pi-check')} aria-label="Marcar atendida" title="Marcar atendida" size="small" severity="success" disabled={busy} onClick={() => onQuickStatus(item, 'ATENDIDA', 'Solicitação marcada como atendida.')} />}
        <Button icon="pi pi-external-link" aria-label="Abrir detalhes" title="Abrir detalhes" size="small" onClick={() => onOpenDetail(item.idSolicitacao)} disabled={busy || detailLoading} className="nx-primary-button" />
        {canAdminister && <Button icon="pi pi-pencil" aria-label="Editar solicitação" title="Editar solicitação" size="small" outlined onClick={() => onOpenCorrection(item.idSolicitacao)} disabled={busy || detailLoading} />}
        {canAdminister && <Button icon="pi pi-trash" aria-label="Excluir solicitação" title="Excluir solicitação" size="small" severity="danger" text onClick={() => onOpenDelete(item)} disabled={busy || detailLoading} />}
      </div>
    )
  }

  return (
    <>
      <DataTable value={items} dataKey="idSolicitacao" stripedRows rowHover scrollable responsiveLayout="scroll" tableStyle={{ tableLayout: 'fixed' }} className="nx-prime-table" emptyMessage="Nenhuma solicitação encontrada">
        <Column header="Solicitação" body={solicitationBody} frozen />
        <Column header="Registro" body={(item: AdministrativeSolicitationListItem) => formatDateTime(item.dataCriacao)} />
        <Column header="Data operacional" body={(item: AdministrativeSolicitationListItem) => formatDate(item.dataOperacional)} />
        <Column field="operacao" header="Operação" />
        <Column header="Tipo" body={typeBody} />
        <Column header="Status" body={statusBody} style={{ width: '12rem' }} />
        <Column header="Qtd. solicitada" body={requestedQuantityBody} />
        <Column header="Qtd. considerada" body={consideredQuantityBody} />
        <Column header="Previsto" body={(item: AdministrativeSolicitationListItem) => formatMoney(item.valorPrevisto)} />
        <Column header="Valor real" body={(item: AdministrativeSolicitationListItem) => formatMoney(item.valorReal)} />
        <Column header="Ações" body={actionsBody} style={{ width: canAdminister ? '22rem' : '4rem' }} />
      </DataTable>
    </>
  )
}
