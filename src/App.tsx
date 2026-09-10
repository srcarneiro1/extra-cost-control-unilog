import { useEffect, useState } from 'react'
import { AdminSolicitationsPageCurrentPeriod } from './components/AdminSolicitationsPageCurrentPeriod'
import { AppShell, type AppSection } from './components/AppShell'
import { CadastrosPagePaginated } from './components/CadastrosPagePaginated'
import { DashboardPage } from './components/DashboardPage'
import {
  fetchCatalogoAdminScope,
  fetchCatalogos,
  prefetchCatalogoAdminScope,
} from './services/catalogService'
import {
  fetchAdministrativeSolicitationMetadata,
  fetchAdministrativeSolicitations,
} from './services/solicitationService'

function currentPeriod() {
  const now = new Date()
  return {
    anoRegistro: String(now.getFullYear()),
    mesRegistro: String(now.getMonth() + 1).padStart(2, '0'),
  }
}

export function App() {
  const [section, setSection] = useState<AppSection>('dashboard')
  const [mountedSections, setMountedSections] = useState<Set<AppSection>>(
    () => new Set<AppSection>(['dashboard']),
  )

  useEffect(() => {
    const firstWave = window.setTimeout(() => {
      const period = currentPeriod()

      void fetchAdministrativeSolicitations({
        pagina: 1,
        tamanhoPagina: 20,
        anoRegistro: period.anoRegistro,
        mesRegistro: period.mesRegistro,
      }).catch(() => undefined)

      void fetchAdministrativeSolicitationMetadata().catch(() => undefined)
      void fetchCatalogos().catch(() => undefined)

      prefetchCatalogoAdminScope('RESUMO')
      prefetchCatalogoAdminScope('OPERACOES')
      prefetchCatalogoAdminScope('SUPERVISORES')
      prefetchCatalogoAdminScope('FORNECEDORES')
      prefetchCatalogoAdminScope('PRODUTOS')
    }, 900)

    const secondWave = window.setTimeout(() => {
      const period = currentPeriod()

      void fetchAdministrativeSolicitations({
        pagina: 2,
        tamanhoPagina: 20,
        anoRegistro: period.anoRegistro,
        mesRegistro: period.mesRegistro,
      }).catch(() => undefined)

      void fetchCatalogoAdminScope('PRECOS_MO', {
        pagina: 1,
        tamanhoPagina: 25,
      }).catch(() => undefined)

      void fetchCatalogoAdminScope('PRECOS_PRODUTOS', {
        pagina: 1,
        tamanhoPagina: 25,
      }).catch(() => undefined)
    }, 2200)

    return () => {
      window.clearTimeout(firstWave)
      window.clearTimeout(secondWave)
    }
  }, [])

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
