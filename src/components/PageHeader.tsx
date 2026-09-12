import type { ReactNode } from 'react'
import { Toolbar } from 'primereact/toolbar'

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}) {
  const start = (
    <div className="nx-page-title-copy">
      <span className="ui-eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  )

  return (
    <Toolbar
      start={start}
      end={actions ? <div className="page-actions nx-modern-actions">{actions}</div> : undefined}
      className="page-header page-header-row nx-prime-page-header"
    />
  )
}
