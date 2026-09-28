'use client'

import { useMemo, useState } from 'react'
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

type FunctionalShellProps = {
  user: AuthUser
  onExit: () => Promise<void>
}

export function FunctionalShell({ user, onExit }: FunctionalShellProps) {
  const [section, setSection] = useState<Section>('dashboard')
  const [mountedSections, setMountedSections] = useState<Set<Section>>(
    () => new Set<Section>(['dashboard']),
  )
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const allowedItems = useMemo(
    () => NAV_ITEMS.filter((item) => canAccess(user, item)),
    [user],
  )

  useShellPrefetch(user)

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
