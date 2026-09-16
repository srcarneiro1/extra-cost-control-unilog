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

