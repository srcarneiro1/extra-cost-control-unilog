import type { ReactNode } from 'react'
import { Button } from 'primereact/button'
import { Card } from 'primereact/card'
import { InputText } from 'primereact/inputtext'
import { Skeleton as PrimeSkeleton } from 'primereact/skeleton'
import { Tag } from 'primereact/tag'

export type SummaryMetricTone = 'neutral' | 'success' | 'warning' | 'danger' | 'info'

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <Card className={`ui-panel nx-prime-panel ${className}`.trim()}>
      {children}
    </Card>
  )
}

export function PanelHeader({
  eyebrow,
  title,
  description,
  trailing,
}: {
  eyebrow?: string
  title: string
  description?: string
  trailing?: ReactNode
}) {
  return (
    <header className="ui-panel-header nx-prime-panel-header">
      <div className="ui-panel-header-copy">
        {eyebrow && <span className="ui-eyebrow">{eyebrow}</span>}
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      {trailing && <div className="ui-panel-header-trailing">{trailing}</div>}
    </header>
  )
}

export function SearchField({
  value,
  onChange,
  placeholder = 'Buscar…',
  ariaLabel,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel: string
}) {
  return (
    <span className="p-input-icon-left ui-search-field nx-prime-search">
      <i className="pi pi-search" aria-hidden="true" />
      <InputText
        type="search"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </span>
  )
}

export function PageToolbar({
  search,
  filters,
  actions,
  ariaLabel = 'Ferramentas da página',
  embedded = false,
}: {
  search?: ReactNode
  filters?: ReactNode
  actions?: ReactNode
  ariaLabel?: string
  embedded?: boolean
}) {
  return (
    <div
      className={`ui-page-toolbar nx-prime-toolbar ${embedded ? 'ui-page-toolbar-embedded' : ''}`.trim()}
      role="region"
      aria-label={ariaLabel}
    >
      <div className="ui-page-toolbar-main">
        {search && <div className="ui-page-toolbar-search">{search}</div>}
        {filters && <div className="ui-page-toolbar-filters">{filters}</div>}
      </div>
      {actions && <div className="ui-page-toolbar-actions">{actions}</div>}
    </div>
  )
}

export interface SummaryMetricItem {
  key: string
  label: string
  value: ReactNode
  detail?: ReactNode
  tone?: SummaryMetricTone
  icon?: string
  active?: boolean
  onClick?: () => void
}

const metricPrimeIcon: Record<string, string> = {
  dataset: 'pi pi-database',
  pending_actions: 'pi pi-clock',
  groups: 'pi pi-users',
  error: 'pi pi-exclamation-triangle',
  manage_accounts: 'pi pi-users',
  verified_user: 'pi pi-shield',
  admin_panel_settings: 'pi pi-lock',
  badge: 'pi pi-id-card',
  inventory_2: 'pi pi-box',
  payments: 'pi pi-wallet',
  local_shipping: 'pi pi-truck',
  receipt_long: 'pi pi-receipt',
  category: 'pi pi-tags',
  calendar_month: 'pi pi-calendar',
}

export function SummaryMetrics({
  items,
  ariaLabel = 'Resumo da página',
}: {
  items: SummaryMetricItem[]
  ariaLabel?: string
}) {
  return (
    <div className="ui-summary-metrics ui-summary-metrics-filters nx-prime-metrics" role="group" aria-label={ariaLabel}>
      {items.map((item) => {
        const tone = item.tone ?? 'neutral'
        const content = (
          <>
            {item.icon && (
              <span className={`ui-summary-metric-icon ${metricPrimeIcon[item.icon] || 'pi pi-chart-bar'}`} aria-hidden="true" />
            )}
            <div className="ui-summary-metric-copy">
              <span>{item.label}</span>
              <strong>{item.value}</strong>
              {item.detail && <small>{item.detail}</small>}
            </div>
          </>
        )

        if (item.onClick) {
          return (
            <Button
              key={item.key}
              type="button"
              text
              className={`ui-summary-metric ui-summary-metric-${tone} nx-prime-metric ${item.active ? 'is-active' : ''}`.trim()}
              aria-pressed={item.active}
              onClick={item.onClick}
            >
              {content}
            </Button>
          )
        }

        return (
          <Card key={item.key} className={`ui-summary-metric ui-summary-metric-${tone} nx-prime-metric`}>
            {content}
          </Card>
        )
      })}
    </div>
  )
}

export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
}) {
  const severity = tone === 'neutral' ? 'secondary' : tone
  return <Tag value={children} severity={severity} rounded className={`ui-badge ui-badge-${tone} nx-prime-tag`} />
}

export function Chip({ children }: { children: ReactNode }) {
  return <Tag value={children} severity="secondary" rounded className="ui-chip nx-prime-chip" />
}

export function EmptyState({
  title,
  description,
  icon = 'inbox',
  tone = 'neutral',
}: {
  title: string
  description?: string
  icon?: string
  tone?: 'neutral' | 'error'
}) {
  return (
    <div className={`ui-empty-state ui-empty-state-${tone} nx-prime-empty`} role={tone === 'error' ? 'alert' : undefined}>
      <span className="nx-prime-empty-icon"><i className={tone === 'error' ? 'pi pi-exclamation-circle' : 'pi pi-inbox'} aria-hidden="true" /></span>
      <div>
        <strong>{title}</strong>
        {description && <p>{description}</p>}
      </div>
    </div>
  )
}

export function Skeleton({ lines = 5 }: { lines?: number }) {
  return (
    <div className="ui-skeleton nx-prime-skeleton" aria-hidden="true">
      {Array.from({ length: lines }, (_, index) => (
        <PrimeSkeleton key={index} height={index === 0 ? '1.25rem' : '.9rem'} width={index % 3 === 0 ? '92%' : index % 2 === 0 ? '76%' : '84%'} />
      ))}
    </div>
  )
}
