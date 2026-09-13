import { useEffect, useState } from 'react'
import { AdminSolicitationsPageCurrentPeriod } from './components/AdminSolicitationsPageCurrentPeriod'
import { AppShell, type AppSection } from './components/AppShell'
import { CadastrosPagePaginated } from './components/CadastrosPagePaginated'
import { DashboardPage } from './components/DashboardPage'
import { LoginPage } from './components/LoginPage'
import { UsersPage } from './components/UsersPage'
import { fetchCatalogos } from './services/catalogService'
import { getCurrentUser, logout, type AuthUser } from './services/authService'
import { fetchAdministrativeSolicitationMetadata } from './services/solicitationService'

export function App() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)
  const [section, setSection] = useState<AppSection>('dashboard')
  const [mountedSections, setMountedSections] = useState<Set<AppSection>>(
    () => new Set<AppSection>(['dashboard']),
  )

  useEffect(() => {
    const controller = new AbortController()

    void getCurrentUser(controller.signal)
      .then(setUser)
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setUser(null)
      })

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!user) return
    const canManageCatalogs = user.profile === 'OWNER' || user.profile === 'ADMINISTRATIVO'

    const idleWarmup = window.setTimeout(() => {
      void fetchAdministrativeSolicitationMetadata().catch(() => undefined)
      if (canManageCatalogs) void fetchCatalogos().catch(() => undefined)
    }, 3000)

    return () => window.clearTimeout(idleWarmup)
  }, [user])

  function canNavigate(nextSection: AppSection) {
    if (!user) return false
    if (nextSection === 'usuarios') return user.profile === 'OWNER'
    if (nextSection === 'cadastros') return user.profile === 'OWNER' || user.profile === 'ADMINISTRATIVO'
    return true
  }

  function handleNavigate(nextSection: AppSection) {
    if (!canNavigate(nextSection)) return
    setMountedSections((current) => {
      if (current.has(nextSection)) return current
      const next = new Set(current)
      next.add(nextSection)
      return next
    })
    setSection(nextSection)
  }

  async function handleLogout() {
    const currentUser = user
    await logout(currentUser)
    setUser(null)
    setSection('dashboard')
    setMountedSections(new Set<AppSection>(['dashboard']))
  }

  if (user === undefined) {
    return <div className="auth-loading"><span>Verificando acesso…</span></div>
  }

  if (!user) {
    return <LoginPage onAuthenticated={setUser} />
  }

  const canAdministerSolicitations = user.profile === 'OWNER' || user.profile === 'ADMINISTRATIVO'

  return (
    <AppShell section={section} onNavigate={handleNavigate} user={user} onLogout={() => void handleLogout()}>
      <div hidden={section !== 'dashboard'}>
        <DashboardPage />
      </div>

      {mountedSections.has('solicitacoes') && (
        <div hidden={section !== 'solicitacoes'}>
          <AdminSolicitationsPageCurrentPeriod canAdminister={canAdministerSolicitations} />
        </div>
      )}

      {mountedSections.has('cadastros') && canNavigate('cadastros') && (
        <div hidden={section !== 'cadastros'}>
          <CadastrosPagePaginated />
        </div>
      )}

      {mountedSections.has('usuarios') && canNavigate('usuarios') && (
        <div hidden={section !== 'usuarios'}>
          <UsersPage />
        </div>
      )}
    </AppShell>
  )
}
