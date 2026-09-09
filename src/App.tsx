import { useState } from 'react'
import { AdminSolicitationsPageCurrentPeriod } from './components/AdminSolicitationsPageCurrentPeriod'
import { AppShell, type AppSection } from './components/AppShell'
import { CadastrosPagePaginated } from './components/CadastrosPagePaginated'

export function App() {
  const [section, setSection] = useState<AppSection>('solicitacoes')
  const [mountedSections, setMountedSections] = useState<Set<AppSection>>(
    () => new Set<AppSection>(['solicitacoes']),
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
      <div hidden={section !== 'solicitacoes'}>
        <AdminSolicitationsPageCurrentPeriod />
      </div>

      {mountedSections.has('cadastros') && (
        <div hidden={section !== 'cadastros'}>
          <CadastrosPagePaginated />
        </div>
      )}
    </AppShell>
  )
}
