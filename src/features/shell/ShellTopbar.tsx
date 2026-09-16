'use client'

import { Tag } from 'primereact/tag'
import { type AuthUser } from '@/services/authService'
import {
  SECTION_COPY,
  profileLabel,
  type Section,
} from '@/features/shell/shellNavigation'

type ShellTopbarProps = {
  user: AuthUser
  section: Section
  onOpenMobileMenu: () => void
}

export function ShellTopbar({ user, section, onOpenMobileMenu }: ShellTopbarProps) {
  const copy = SECTION_COPY[section]

  return (
    <header className="nx-topbar">
      <div className="nx-topbar-title">
        <button
          type="button"
          className="nx-icon-button nx-mobile-menu"
          onClick={onOpenMobileMenu}
          aria-label="Abrir menu"
        >
          <i className="pi pi-bars" />
        </button>
        <div>
          <small>EXTRA COST CONTROL</small>
          <strong>{copy.title}</strong>
        </div>
      </div>

      <div className="nx-topbar-status">
        <span className="nx-scope-chip">
          <small>Escopo ativo</small>
          <strong>{copy.scope}</strong>
        </span>
        <Tag value={profileLabel(user.profile)} severity="secondary" rounded />
        <span className="nx-gateway-state"><i /> Gateway conectado</span>
      </div>
    </header>
  )
}
