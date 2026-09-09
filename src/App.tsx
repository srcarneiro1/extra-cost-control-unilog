import { useState } from 'react'
import { AdminSolicitationsPageCurrentPeriod } from './components/AdminSolicitationsPageCurrentPeriod'
import { AppShell, type AppSection } from './components/AppShell'
import { CadastrosPagePaginated } from './components/CadastrosPagePaginated'
import { DashboardPage } from './components/DashboardPage'

export function App() {
  const [section, setSection] = useState<AppSection>('dashboard')
  const [mountedSections, setMountedSections] = useState<Set<AppSection>>(
    () => new Set<AppSection>(['dashboard']),
  )

  function handleNavigate(nextSection: AppSection) {
    setMountedSections((current) => {
      if (current.has(nextSection)) return current
      const next = new Set(current)
      next.add(nextSection)
      return next
    })
    setSection(nextSection)
  }

  return (
    <AppShell section={section} onNavigate={handleNavigate}>
      <div hidden={section !== 'dashboard'}>
        <DashboardPage />
      </div>

      {mountedSections.has('solicitacoes') && (
        <div hidden={section !== 'solicitacoes'}>
          <AdminSolicitationsPageCurrentPeriod />
        </div>
      )}

      {mountedSections.has('cadastros') && (
        <div hidden={section !== 'cadastros'}>
          <CadastrosPagePaginated />
        </div>
      )}
    </AppShell>
  )
}
