'use client'

import { useEffect, useState } from 'react'
import { LoginExperience } from '@/features/auth/LoginExperience'
import { FunctionalShell } from '@/features/shell/FunctionalShell'
import {
  getCurrentUser,
  logout,
  type AuthUser,
} from '@/services/authService'

export default function Home() {
  const [user, setUser] = useState<AuthUser | null | undefined>(undefined)

  useEffect(() => {
    const controller = new AbortController()
    void getCurrentUser(controller.signal)
      .then(setUser)
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setUser(null)
      })
    return () => controller.abort()
  }, [])

  async function handleLogout() {
    const current = user
    await logout(current)
    setUser(null)
  }

  if (user === undefined) {
    return (
      <main className="nx-session-loading">
        <i className="pi pi-spin pi-spinner" />
        <span>Verificando acesso…</span>
      </main>
    )
  }

  if (!user) return <LoginExperience onAuthenticated={setUser} />

  return <FunctionalShell user={user} onExit={handleLogout} />
}
