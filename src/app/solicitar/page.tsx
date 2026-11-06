'use client'

import { PublicRequestPage } from '@/features/public-request/PublicRequestPage'

// Tela aberta de solicitação (sem login). A gestão continua em "/", com acesso restrito.
export default function SolicitarPage() {
  return <PublicRequestPage />
}
