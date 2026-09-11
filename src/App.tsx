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
import { prefetchDashboard } from './services/dashboardService'
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

function adjacentDashboardCompetence(offset: number) {
  const now = new Date()
  const closingMonth = now.getMonth() + (now.getDate() >= 21 ? 1 : 0)
  const target = new Date(now.getFullYear(), closingMonth + offset, 1)
  return {
    ano: String(target.getFullYear()),
    mesCompetencia: String(target.getMonth() + 1).padStart(2, '0'),
    operacao: 'TODOS' as const,
    supervisor: 'TODOS' as const,
    fornecedor: 'TODOS' as const,
    tipo: 'TODOS' as const,
    responsavelCusto: 'TODOS' as const,
    atividade: 'TODOS' as const,
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
      prefetchCatalogoAdminScope('FUNCOES')
      prefetchCatalogoAdminScope('ATIVIDADES')
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

      prefetchDashboard(adjacentDashboardCompetence(-1))
      prefetchCatalogoAdminScope('FERIADOS')
      prefetchCatalogoAdminScope('METAS')

      void fetchCatalogoAdminScope('PRECOS_MO', {
        pagina: 1,
        tamanhoPagina: 25,
      }).catch(() => undefined)

      void fetchCatalogoAdminScope('PRECOS_PRODUTOS', {
        pagina: 1,
        tamanhoPagina: 25,
      }).catch(() => undefined)
    }, 2200)

    const thirdWave = window.setTimeout(() => {
      prefetchDashboard(adjacentDashboardCompetence(-2))
    }, 4200)

    return () => {
      window.clearTimeout(firstWave)
      window.clearTimeout(secondWave)
      window.clearTimeout(thirdWave)
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
