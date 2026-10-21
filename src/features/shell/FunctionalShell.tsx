'use client'

import { useEffect, useMemo, useState } from 'react'
import { type AuthUser } from '@/features/auth/services/authService'
import { ShellSections } from '@/features/shell/ShellSections'
import { ShellSidebar } from '@/features/shell/ShellSidebar'
import { ShellTopbar } from '@/features/shell/ShellTopbar'
import { useShellPrefetch } from '@/features/shell/useShellPrefetch'
import {
  NAV_ITEMS,
  canAccess,
  canNavigate,
  type Section,
} from '@/features/shell/shellNavigation'

// Tela inicial e memória da tela atual (21/10/2026).
// Antes a tela inicial era fixa em 'dashboard' e, ao recarregar, o usuário sempre voltava à Visão geral.
// Agora: abre em Solicitações; ao recarregar, volta à tela em que estava (endereço #secao e, na falta
// dele, a última tela usada neste navegador). Telas sem permissão para o perfil são ignoradas.
const DEFAULT_SECTION: Section = 'solicitacoes'
const STORAGE_KEY = 'extra-cost:secao'

function isSection(value: string): value is Section {
  return NAV_ITEMS.some((item) => item.key === value)
}

function initialSection(user: AuthUser): Section {
  const candidates: string[] = []
  if (typeof window !== 'undefined') {
    candidates.push(window.location.hash.replace(/^#/, ''))
    try {
      candidates.push(window.localStorage.getItem(STORAGE_KEY) || '')
    } catch {
      // armazenamento indisponível (modo privado restrito): segue para o padrão
    }
  }
  candidates.push(DEFAULT_SECTION)
  for (const candidate of candidates) {
    if (candidate && isSection(candidate) && canNavigate(user, candidate)) return candidate
  }
  return NAV_ITEMS.find((item) => canAccess(user, item))?.key ?? DEFAULT_SECTION
}

function rememberSection(section: Section) {
  if (typeof window === 'undefined') return
  try {
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${section}`)
    window.localStorage.setItem(STORAGE_KEY, section)
  } catch {
    // ignorar: a navegação continua funcionando sem memória
  }
}

type FunctionalShellProps = {
  user: AuthUser
  onExit: () => Promise<void>
}

export function FunctionalShell({ user, onExit }: FunctionalShellProps) {
  const [section, setSection] = useState<Section>(() => initialSection(user))
  const [mountedSections, setMountedSections] = useState<Set<Section>>(
    () => new Set<Section>([section]),
  )
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const allowedItems = useMemo(
    () => NAV_ITEMS.filter((item) => canAccess(user, item)),
    [user],
  )

  useShellPrefetch(user)

  // Mantém o endereço e a memória sincronizados com a tela aberta.
  useEffect(() => { rememberSection(section) }, [section])

  function navigate(next: Section) {
    if (!canNavigate(user, next)) return
    setMountedSections((current) => {
      if (current.has(next)) return current
      const updated = new Set(current)
      updated.add(next)
      return updated
    })
    setSection(next)
    setMobileOpen(false)
  }

  return (
    <main className={`nx-app ${collapsed ? 'is-collapsed' : ''}`}>
      <ShellSidebar
        user={user}
        section={section}
        allowedItems={allowedItems}
        collapsed={collapsed}
        mobileOpen={mobileOpen}
        onToggleCollapsed={() => setCollapsed((current) => !current)}
        onCloseMobile={() => setMobileOpen(false)}
        onNavigate={navigate}
        onExit={onExit}
      />

      <section className="nx-workspace">
        <ShellTopbar
          user={user}
          section={section}
          onOpenMobileMenu={() => setMobileOpen(true)}
        />

        <ShellSections
          user={user}
          section={section}
          mountedSections={mountedSections}
        />
      </section>
    </main>
  )
}
