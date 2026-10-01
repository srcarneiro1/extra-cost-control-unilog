'use client'

import { Button } from 'primereact/button'
import { InputTextarea } from 'primereact/inputtextarea'
import { Message } from 'primereact/message'
import { Modal } from '@/components/ui/Modal'
import type { AdministrativeSolicitationListItem } from '@/types/solicitation'

type Props = {
  canAdminister: boolean
  target: AdministrativeSolicitationListItem | null
  reason: string
  error: string
  loading: string | null
  onReasonChange: (value: string) => void
  onClose: () => void
  onConfirm: () => void
}

export function AdminSolicitationDeleteModal({
  canAdminister,
  target,
  reason,
  error,
  loading,
  onReasonChange,
  onClose,
  onConfirm,
}: Props) {
  if (!canAdminister) return null
  const busy = Boolean(loading)

  return (
    <Modal
      open={Boolean(target)}
      titleId="delete-solicitation-title"
      eyebrow="EXCLUSÃO ADMINISTRATIVA"
      title={target ? `Excluir ${target.idSolicitacao}` : 'Excluir solicitação'}
      description="A solicitação e eventuais jornadas parciais serão removidas da base operacional. Um snapshot será preservado na auditoria."
      onClose={onClose}
      busy={busy}
      width="medium"
      bodyClassName="nx-delete-dialog"
      footer={<><Button label="Cancelar" text onClick={onClose} disabled={busy} /><Button label={loading ? 'Excluindo…' : 'Excluir solicitação'} icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-trash'} severity="danger" onClick={onConfirm} disabled={busy || reason.trim().length < 5} /></>}
    >
      <div className="nx-delete-dialog-body">
        <Message severity="warn" text="Esta ação é definitiva na base operacional e ficará registrada na auditoria." />
        {error && <Message severity="error" text={error} />}
        <label className="nx-workflow-field">
          <span>Motivo da exclusão</span>
          <InputTextarea value={reason} onChange={(event) => onReasonChange(event.target.value)} rows={4} autoResize placeholder="Descreva o motivo com pelo menos 5 caracteres." />
          <small>{reason.trim().length}/5 caracteres mínimos</small>
        </label>
      </div>
    </Modal>
  )
}
