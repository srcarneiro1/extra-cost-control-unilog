import { useEffect, useRef, type ReactNode } from 'react'

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

const FOCUSABLE_SELECTOR = [
  'button:not([disabled])',
  'a[href]',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',')

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
  const modalRef = useRef<HTMLElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    restoreFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const frame = window.requestAnimationFrame(() => {
      modalRef.current?.focus({ preventScroll: true })
    })

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const modal = modalRef.current
      if (!modal) return

      const focusable = Array.from(
        modal.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((element) => element.offsetParent !== null)

      if (!focusable.length) {
        event.preventDefault()
        modal.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      window.cancelAnimationFrame(frame)
      document.body.style.overflow = previousOverflow
      document.removeEventListener('keydown', onKeyDown)

      const restoreTarget = restoreFocusRef.current
      if (restoreTarget?.isConnected) {
        window.requestAnimationFrame(() => restoreTarget.focus({ preventScroll: true }))
      }
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
        ref={modalRef}
        tabIndex={-1}
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
