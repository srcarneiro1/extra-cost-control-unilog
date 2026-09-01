import type { PropsWithChildren } from 'react'

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Navegação principal">
        <div className="app-brand" aria-label="UNILOG">
          <span className="app-brand-mark">U</span>
          <span className="app-brand-name">UNILOG</span>
        </div>

        <nav className="app-nav" aria-label="Módulos">
          <span className="app-nav-item app-nav-item-active" aria-current="page">
            Início
          </span>
          <span className="app-nav-item">Solicitações</span>
          <span className="app-nav-item">Cadastros</span>
        </nav>

        <div className="app-sidebar-footer">
          <span>Extra Cost Control</span>
          <small>MVP 1</small>
        </div>
      </aside>

      <div className="app-workspace">
        <header className="app-topbar">
          <strong>Extra Cost Control</strong>
          <span className="status-dot" aria-label="Frontend inicializado" />
        </header>
        <main className="app-main">{children}</main>
      </div>
    </div>
  )
}
