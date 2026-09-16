'use client'

import dynamic from 'next/dynamic'
import { useMemo, useState } from 'react'
import { Avatar } from 'primereact/avatar'
import { Tag } from 'primereact/tag'
import { type AuthUser } from '@/services/authService'
import { useShellPrefetch } from '@/features/shell/useShellPrefetch'

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

type Section = 'dashboard' | 'solicitacoes' | 'fechamentos' | 'cadastros' | 'usuarios'

type NavItem = {
  key: Section
  label: string
  icon: string
  administrative?: boolean
  ownerOnly?: boolean
}

type FunctionalShellProps = {
  user: AuthUser
  onExit: () => Promise<void>
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Visão geral', icon: 'pi pi-chart-bar' },
  { key: 'solicitacoes', label: 'Solicitações', icon: 'pi pi-receipt' },
  { key: 'fechamentos', label: 'Fechamentos', icon: 'pi pi-wallet', administrative: true },
  { key: 'cadastros', label: 'Cadastros', icon: 'pi pi-sliders-h', administrative: true },
  { key: 'usuarios', label: 'Usuários', icon: 'pi pi-users', administrative: true, ownerOnly: true },
]

const SECTION_COPY: Record<Section, { title: string; scope: string }> = {
  dashboard: { title: 'Visão geral', scope: 'Executivo · Custos extras' },
  solicitacoes: { title: 'Solicitações', scope: 'Custos extras' },
  fechamentos: { title: 'Fechamentos', scope: 'Administrativo · Financeiro' },
  cadastros: { title: 'Cadastros', scope: 'Administrativo · Catálogos' },
  usuarios: { title: 'Usuários', scope: 'Owner · Gestão de acessos' },
}

function canAccess(user: AuthUser, item: NavItem) {
  if (item.ownerOnly) return user.profile === 'OWNER'
  if (item.administrative) return user.profile === 'OWNER' || user.profile === 'ADMINISTRATIVO'
  return true
}

function canNavigate(user: AuthUser, section: Section) {
  const item = NAV_ITEMS.find((candidate) => candidate.key === section)
  return item ? canAccess(user, item) : false
}

function profileLabel(profile: string) {
  if (profile === 'OWNER') return 'Owner'
  if (profile === 'ADMINISTRATIVO') return 'Administrativo'
  return 'Operacional'
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
      {mobileOpen && (
        <button
          className="nx-sidebar-backdrop"
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`nx-sidebar ${mobileOpen ? 'is-mobile-open' : ''}`}>
        <div className="nx-sidebar-brand">
          <img src="/brand/unilog-logo-white-transparent.svg" alt="Unilog Express" />
          <button
            type="button"
            className="nx-icon-button nx-desktop-collapse"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <i className={collapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'} />
          </button>
          <button
            type="button"
            className="nx-icon-button nx-mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >
            <i className="pi pi-times" />
          </button>
        </div>

        <nav className="nx-navigation" aria-label="Navegação principal">
          {allowedItems.map((item) => {
            const firstAdministrative = item.administrative &&
              allowedItems.findIndex((candidate) => candidate.administrative) === allowedItems.indexOf(item)

            return (
              <div key={item.key} className={firstAdministrative ? 'nx-admin-group' : ''}>
                {firstAdministrative && <span className="nx-nav-caption">ADMINISTRAÇÃO</span>}
                <button
                  type="button"
                  className={`nx-nav-item ${section === item.key ? 'is-active' : ''}`}
                  onClick={() => navigate(item.key)}
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
