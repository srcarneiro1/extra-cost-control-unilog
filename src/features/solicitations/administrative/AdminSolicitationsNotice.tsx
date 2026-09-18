'use client'

import { Button } from 'primereact/button'

export type AdminSolicitationsNoticeValue = {
  tone: 'success' | 'error'
  message: string
}

type Props = {
  notice: AdminSolicitationsNoticeValue | null
  onClose: () => void
}

export function AdminSolicitationsNotice({ notice, onClose }: Props) {
  if (!notice) return null

  return (
    <div className={`nx-prime-notice ${notice.tone === 'success' ? 'is-success' : 'is-error'}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
      <i className={notice.tone === 'success' ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'} />
      <span>{notice.message}</span>
      <Button text rounded icon="pi pi-times" aria-label="Fechar notificação" onClick={onClose} />
    </div>
  )
}
