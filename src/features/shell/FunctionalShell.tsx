'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { Tag } from 'primereact/tag'
import { type AuthUser } from '@/services/authService'
import { ShellSidebar } from '@/features/shell/ShellSidebar'
import { useShellPrefetch } from '@/features/shell/useShellPrefetch'
import {
  NAV_ITEMS,
  SECTION_COPY,
  canAccess,
  canNavigate,
  profileLabel,
  type Section,
} from '@/features/shell/shellNavigation'

function SectionLoading() {
  return (
    <div
      className="nx-session-loading"
      role="status"
      aria-live="polite"
      style={{ minHeight: '16rem', background: 'transparent' }}
    >
      <i className="pi pi-spin pi-spinner" />
      <span>Carregando seção…</span>
    </div>
  )
}

const AdminSolicitationsPageCurrentPeriod = dynamic(
  () => import('@/components/AdminSolicitationsPageCurrentPeriod')
    .then((module) => module.AdminSolicitationsPageCurrentPeriod),
  { ssr: false, loading: () => <SectionLoading /> },
)

const CadastrosPagePaginated = dynamic(
  () => import('@/components/CadastrosPagePaginated')
    .then((module) => module.CadastrosPagePaginated),
  { ssr: false, loading: () => <SectionLoading /> },
)

const DashboardPage = dynamic(
  () => import('@/components/DashboardPage').then((module) => module.DashboardPage),
  { ssr: false, loading: () => <SectionLoading /> },
)

const FinancialCloseoutPage = dynamic(
  () => import('@/components/FinancialCloseoutPage').then((module) => module.FinancialCloseoutPage),
  { ssr: false, loading: () => <SectionLoading /> },
)

const UsersPage = dynamic(
  () => import('@/components/UsersPage').then((module) => module.UsersPage),
  { ssr: false, loading: () => <SectionLoading /> },
)

type FunctionalShellProps = {
  user: AuthUser
  onExit: () => Promise<void>
}

export function FunctionalShell({ user, onExit }: FunctionalShellProps) {
  const [section, setSection] = useState<Section>('dashboard')
  const [mountedSections, setMountedSections] = useState<Set<Section>>(
    () => new Set<Section>(['dashboard']),
  )
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const copy = SECTION_COPY[section]
  const canAdministerSolicitations = user.profile === 'OWNER' || user.profile === 'ADMINISTRATIVO'

  const allowedItems = useMemo(
    () => NAV_ITEMS.filter((item) => canAccess(user, item)),
    [user],
  )

  useShellPrefetch(user)

  function navigate(next: Section) {
    if (!canNavigate(user, next)) return
    setMountedSections((current) => {
      if (current.has(next)) return current
      const updated = new Set(current)
      updated.add(next)
      return updated
    })
    setSection(next)
    setMobileOpen(false)
  }

  return (
    <main className={`nx-app ${collapsed ? 'is-collapsed' : ''}`}>
      <ShellSidebar
        user={user}
        section={section}
        allowedItems={allowedItems}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapsed={() => setCollapsed((current) => !current)}
        onCloseMobile={() => setMobileOpen(false)}
        onNavigate={navigate}
        onExit={onExit}
      />

      <section className="nx-workspace">
        <header className="nx-topbar">
          <div className="nx-topbar-title">
            <button
              type="button"
              className="nx-icon-button nx-mobile-menu"
              onClick={() => setMobileOpen(true)}
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

        <div className="nx-content nx-functional-content">
          <div hidden={section !== 'dashboard'}>
            <DashboardPage />
          </div>

          {mountedSections.has('solicitacoes') && (
            <div hidden={section !== 'solicitacoes'}>
              <AdminSolicitationsPageCurrentPeriod canAdminister={canAdministerSolicitations} />
            </div>
          )}

          {mountedSections.has('fechamentos') && canNavigate(user, 'fechamentos') && (
            <div hidden={section !== 'fechamentos'}>
              <FinancialCloseoutPage />
            </div>
          )}

          {mountedSections.has('cadastros') && canNavigate(user, 'cadastros') && (
            <div hidden={section !== 'cadastros'}>
              <CadastrosPagePaginated />
            </div>
          )}

          {mountedSections.has('usuarios') && canNavigate(user, 'usuarios') && (
            <div hidden={section !== 'usuarios'}>
              <UsersPage />
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
