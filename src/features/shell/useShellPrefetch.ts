'use client'

import { useEffect } from 'react'
import { fetchCatalogos, prefetchCatalogoAdminScope } from '@/services/catalogService'
import { prefetchDashboard } from '@/services/dashboardService'
import type { AuthUser } from '@/services/authService'
import { fetchAdministrativeSolicitations } from '@/services/solicitationService'

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

    // Cada requisição aqui é uma execução do Apps Script. Antes eram ~16 em 4s,
    // competindo com o primeiro clique real do usuário. Agora pré-carregamos só
    // o que a tela inicial e as ações mais comuns precisam; o resto é sob demanda.
    // O metadata (que lê a aba de solicitações) não é mais pré-carregado.
    const firstWave = window.setTimeout(() => {
      const period = currentPeriod()
      void fetchAdministrativeSolicitations({ pagina: 1, tamanhoPagina: 20, anoRegistro: period.anoRegistro, mesRegistro: period.mesRegistro }).catch(() => undefined)
      if (canManageCatalogs) void fetchCatalogos().catch(() => undefined)
    }, 900)

    const secondWave = window.setTimeout(() => {
      if (document.visibilityState !== 'visible') return
      prefetchDashboard(adjacentDashboardCompetence(-1, operation))
      if (canManageCatalogs) prefetchCatalogoAdminScope('RESUMO')
    }, 5000)

    return () => {
      window.clearTimeout(firstWave)
      window.clearTimeout(secondWave)
    }
  }, [user])
}
