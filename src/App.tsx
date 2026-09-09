import { useState } from 'react'
import { AdminSolicitationsPageCurrentPeriod } from './components/AdminSolicitationsPageCurrentPeriod'
import { AppShell, type AppSection } from './components/AppShell'
import { CadastrosPagePaginated } from './components/CadastrosPagePaginated'

export function App() {
  const [section, setSection] = useState<AppSection>('solicitacoes')

  return (
    <AppShell section={section} onNavigate={setSection}>
      {section === 'cadastros' ? <CadastrosPagePaginated /> : <AdminSolicitationsPageCurrentPeriod />}
    </AppShell>
  )
}
