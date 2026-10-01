'use client'

import { Avatar } from 'primereact/avatar'
import { type AuthUser } from '@/features/auth/services/authService'
import {
  profileLabel,
  type NavItem,
  type Section,
} from '@/features/shell/shellNavigation'

type ShellSidebarProps = {
  user: AuthUser
  section: Section
  allowedItems: NavItem[]
  collapsed: boolean
  mobileOpen: boolean
  onToggleCollapsed: () => void
  onCloseMobile: () => void
  onNavigate: (section: Section) => void
  onExit: () => Promise<void>
}

export function ShellSidebar({
  user,
  section,
  allowedItems,
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
  onNavigate,
  onExit,
}: ShellSidebarProps) {
  const firstAdministrativeIndex = allowedItems.findIndex((item) => item.administrative)

  return (
    <>
      {mobileOpen && (
        <button
          className="nx-sidebar-backdrop"
          type="button"
          aria-label="Fechar menu"
          onClick={onCloseMobile}
        />
      )}

      <aside className={`nx-sidebar ${mobileOpen ? 'is-mobile-open' : ''}`}>
        <div className="nx-sidebar-brand">
          <img src="/brand/unilog-logo-white-transparent.svg" alt="Unilog Express" />
          <button
            type="button"
            className="nx-icon-button nx-desktop-collapse"
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <i className={collapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'} />
          </button>
          <button
            type="button"
            className="nx-icon-button nx-mobile-close"
            onClick={onCloseMobile}
            aria-label="Fechar menu"
          >
            <i className="pi pi-times" />
          </button>
        </div>

        <nav className="nx-navigation" aria-label="Navegação principal">
          {allowedItems.map((item, index) => {
            const firstAdministrative = item.administrative && index === firstAdministrativeIndex

            return (
              <div key={item.key} className={firstAdministrative ? 'nx-admin-group' : ''}>
                {firstAdministrative && <span className="nx-nav-caption">ADMINISTRAÇÃO</span>}
                <button
                  type="button"
                  className={`nx-nav-item ${section === item.key ? 'is-active' : ''}`}
                  onClick={() => onNavigate(item.key)}
                >
                  <i className={item.icon} />
                  <span>{item.label}</span>
                </button>
              </div>
            )
          })}
        </nav>

        <div className="nx-user-card">
          <Avatar
            label={(user.name || user.email || 'U').slice(0, 1).toUpperCase()}
            shape="circle"
            className="nx-avatar"
          />
          <div className="nx-user-copy" title={user.email}>
            <strong>{user.name || user.email}</strong>
            <span>{profileLabel(user.profile)} · {user.operation || 'Sem operação'}</span>
          </div>
          <button type="button" className="nx-icon-button" onClick={() => void onExit()} aria-label="Sair">
            <i className="pi pi-sign-out" />
          </button>
        </div>
      </aside>
    </>
  )
}
