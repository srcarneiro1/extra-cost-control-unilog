import { useEffect, type ReactNode } from 'react'

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
  useEffect(() => {
    if (!open) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose()
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, busy, onClose])

  if (!open) return null

  return (
    <div
      className="ui-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose()
      }}
    >
      <section
        className={`ui-modal ui-modal-${width}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
      >
        <header className="ui-modal-header">
          <div className="ui-modal-header-copy">
            {eyebrow && <span className="ui-eyebrow">{eyebrow}</span>}
            <div className="ui-modal-title-row">
              <h2 id={titleId}>{title}</h2>
              {headerAside}
            </div>
            {description && <p>{description}</p>}
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar modal"
          >
            <span className="material-symbols-rounded" aria-hidden="true">close</span>
          </button>
        </header>

        <div className={`ui-modal-body ${bodyClassName}`.trim()}>{children}</div>

        {footer && <footer className="ui-modal-footer">{footer}</footer>}
      </section>
    </div>
  )
}
