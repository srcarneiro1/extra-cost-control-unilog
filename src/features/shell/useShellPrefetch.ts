'use client'

import { useEffect } from 'react'
import { fetchCatalogoAdminScope, fetchCatalogos, prefetchCatalogoAdminScope } from '@/services/catalogService'
import { prefetchDashboard } from '@/services/dashboardService'
import type { AuthUser } from '@/services/authService'
import { fetchAdministrativeSolicitationMetadata, fetchAdministrativeSolicitations } from '@/services/solicitationService'

function currentPeriod() {
  const now = new Date()
  return {
    anoRegistro: String(now.getFullYear()),
    mesRegistro: String(now.getMonth() + 1).padStart(2, '0'),
  }
}

function adjacentDashboardCompetence(offset: number, operation = 'TODOS') {
  const now = new Date()
  const closingMonth = now.getMonth() + (now.getDate() >= 21 ? 1 : 0)
  const target = new Date(now.getFullYear(), closingMonth + offset, 1)
  return {
    ano: String(target.getFullYear()),
    mesCompetencia: String(target.getMonth() + 1).padStart(2, '0'),
    operacao: operation,
    supervisor: 'TODOS' as const,
    fornecedor: 'TODOS' as const,
    tipo: 'TODOS' as const,
    responsavelCusto: 'TODOS' as const,
    atividade: 'TODOS' as const,
  }
}

export function useShellPrefetch(user: AuthUser) {
  useEffect(() => {
    const canManageCatalogs = user.profile === 'OWNER' || user.profile === 'ADMINISTRATIVO'
    const operation = user.profile === 'OWNER' || !user.operation ? 'TODOS' : user.operation

    const firstWave = window.setTimeout(() => {
      const period = currentPeriod()
      void fetchAdministrativeSolicitations({ pagina: 1, tamanhoPagina: 20, anoRegistro: period.anoRegistro, mesRegistro: period.mesRegistro }).catch(() => undefined)
      void fetchAdministrativeSolicitationMetadata().catch(() => undefined)

      if (canManageCatalogs) {
        void fetchCatalogos().catch(() => undefined)
        ;['RESUMO', 'OPERACOES', 'SUPERVISORES', 'FUNCOES', 'ATIVIDADES', 'FORNECEDORES', 'PRODUTOS'].forEach((scope) => {
          prefetchCatalogoAdminScope(scope as Parameters<typeof prefetchCatalogoAdminScope>[0])
        })
      }
    }, 900)

    const secondWave = window.setTimeout(() => {
      const period = currentPeriod()
      void fetchAdministrativeSolicitations({ pagina: 2, tamanhoPagina: 20, anoRegistro: period.anoRegistro, mesRegistro: period.mesRegistro }).catch(() => undefined)
      prefetchDashboard(adjacentDashboardCompetence(-1, operation))

      if (canManageCatalogs) {
        prefetchCatalogoAdminScope('FERIADOS')
        prefetchCatalogoAdminScope('METAS')
        void fetchCatalogoAdminScope('PRECOS_MO', { pagina: 1, tamanhoPagina: 25 }).catch(() => undefined)
        void fetchCatalogoAdminScope('PRECOS_PRODUTOS', { pagina: 1, tamanhoPagina: 25 }).catch(() => undefined)
      }
    }, 2200)

    const thirdWave = window.setTimeout(() => {
      prefetchDashboard(adjacentDashboardCompetence(-2, operation))
    }, 4200)

    return () => {
      window.clearTimeout(firstWave)
      window.clearTimeout(secondWave)
      window.clearTimeout(thirdWave)
    }
  }, [user])
}
