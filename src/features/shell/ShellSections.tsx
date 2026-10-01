'use client'

import dynamic from 'next/dynamic'
import { type AuthUser } from '@/features/auth/services/authService'
import { canNavigate, type Section } from '@/features/shell/shellNavigation'

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
  () => import('@/features/solicitations/administrative/AdminSolicitationsPageCurrentPeriod')
    .then((module) => module.AdminSolicitationsPageCurrentPeriod),
  { ssr: false, loading: () => <SectionLoading /> },
)

const CadastrosPagePaginated = dynamic(
  () => import('@/features/catalogs/administrative/CadastrosPagePaginated')
    .then((module) => module.CadastrosPagePaginated),
  { ssr: false, loading: () => <SectionLoading /> },
)

const DashboardPage = dynamic(
  () => import('@/features/dashboard/DashboardPage').then((module) => module.DashboardPage),
  { ssr: false, loading: () => <SectionLoading /> },
)

const FinancialCloseoutPage = dynamic(
  () => import('@/features/closeouts/administrative/FinancialCloseoutPage').then((module) => module.FinancialCloseoutPage),
  { ssr: false, loading: () => <SectionLoading /> },
)

const UsersPage = dynamic(
  () => import('@/features/users/administrative/UsersPage').then((module) => module.UsersPage),
  { ssr: false, loading: () => <SectionLoading /> },
)

type ShellSectionsProps = {
  user: AuthUser
  section: Section
  mountedSections: Set<Section>
}

export function ShellSections({ user, section, mountedSections }: ShellSectionsProps) {
  const canAdministerSolicitations = user.profile === 'OWNER' || user.profile === 'ADMINISTRATIVO'

  return (
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
  )
}
