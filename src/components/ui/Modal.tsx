import type { ReactNode } from 'react'
import { Dialog } from 'primereact/dialog'

type ModalWidth = 'medium' | 'large'

type Props = {
  open: boolean
  titleId: string
  eyebrow?: string
  title: ReactNode
  description?: ReactNode
  headerAside?: ReactNode
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  busy?: boolean
  width?: ModalWidth
  bodyClassName?: string
}

export function Modal({
  open,
  titleId,
  eyebrow,
  title,
  description,
  headerAside,
  children,
  footer,
  onClose,
  busy = false,
  width = 'medium',
  bodyClassName = '',
}: Props) {
  const header = (
    <div className="ui-modal-header-copy nx-dialog-header-copy">
      {eyebrow && <span className="ui-eyebrow">{eyebrow}</span>}
      <div className="ui-modal-title-row">
        <h2 id={titleId}>{title}</h2>
        {headerAside}
      </div>
      {description && <p>{description}</p>}
    </div>
  )

  return (
    <Dialog
      visible={open}
      onHide={() => {
        if (!busy) onClose()
      }}
      header={header}
      footer={footer ? <div className="ui-modal-footer nx-dialog-footer">{footer}</div> : undefined}
      modal
      closable={!busy}
      dismissableMask={!busy}
      closeOnEscape={!busy}
      draggable={false}
      resizable={false}
      blockScroll
      focusOnShow
      className={`ui-modal ui-modal-${width} nx-prime-dialog`}
      contentClassName={`ui-modal-body nx-dialog-body ${bodyClassName}`.trim()}
      style={{ width: width === 'large' ? 'min(1080px, 94vw)' : 'min(720px, 94vw)' }}
      breakpoints={{ '960px': '94vw', '640px': '96vw' }}
      aria-labelledby={titleId}
    >
      {children}
    </Dialog>
  )
}
