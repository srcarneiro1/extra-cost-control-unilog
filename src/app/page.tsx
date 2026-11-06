'use client'

import { useEffect, useState } from 'react'
import { PublicRequestPage } from '@/features/public-request/PublicRequestPage'

// Raiz "/" abre a tela de solicitação (06/11/2026). A gestão fica em "/gestao".
// Favoritos antigos da gestão ("/#solicitacoes", "/#cadastros"…) seguem direto para "/gestao".
export default function Home() {
  const [redirecting, setRedirecting] = useState(false)

  useEffect(() => {
    const goToManagement = () => {
      if (window.location.hash.length > 1) {
        setRedirecting(true)
        window.location.replace(`/gestao/${window.location.hash}`)
      }
    }
    goToManagement()
    window.addEventListener('hashchange', goToManagement)
    return () => window.removeEventListener('hashchange', goToManagement)
  }, [])

  if (redirecting) return null
  return <PublicRequestPage />
}
