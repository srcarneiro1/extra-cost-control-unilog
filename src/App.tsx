import { useState } from 'react'
import { AdminSolicitationsPageCurrentPeriod } from './components/AdminSolicitationsPageCurrentPeriod'
import { AppShell, type AppSection } from './components/AppShell'
import { CadastrosPage } from './components/CadastrosPage'

export function App() {
  const [section, setSection] = useState<AppSection>('solicitacoes')

  return (
    <AppShell section={section} onNavigate={setSection}>
      {section === 'cadastros' ? <CadastrosPage /> : <AdminSolicitationsPageCurrentPeriod />}
    </AppShell>
  )
}
