'use client'

import { useEffect } from 'react'
import {
  fetchCatalogoAdminScope,
  fetchCatalogos,
  prefetchCatalogoAdminScope,
} from '@/services/catalogService'
import { prefetchDashboard } from '@/services/dashboardService'
import { type AuthUser } from '@/services/authService'
import {
  fetchAdministrativeSolicitationMetadata,
  fetchAdministrativeSolicitations,
} from '@/services/solicitationService'

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

export function useShellPrefetch