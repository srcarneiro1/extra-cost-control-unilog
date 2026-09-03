import type { PropsWithChildren, ReactNode } from 'react'

function Icon({ children }: { children: ReactNode }) {
  return (
    <span className="app-nav-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">{children}</svg>
    </span>
  )
}

function HomeIcon() {
  return <Icon><path d="M3 11.5 12 4l9 7.5v8a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></Icon>
}

function RequestsIcon() {
  return <Icon><path d="M6 3h12a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Zm2 5h8M8 12h8M8 16h5" /></Icon>
}

function SettingsIcon() {
  return <Icon><path d="M12 8.5A3.5 3.5 0 1 0 12 15a3.5 3.5 0 0 0 0-6.5Zm0-5 1.1 2.1 2.3.6 1.9-1.3 1.8 1.8-1.3 1.9.6 2.3 2.1 1.1v2.6l-2.1 1.1-.6 2.3 1.3 1.9-1.8 1.8-1.9-1.3-2.3.6L12 20.5l-1.1-2.1-2.3-.6-1.9 1.3-1.8-1.8 1.3-1.9-.6-2.3L3.5 12v-2.6l2.1-1.1.6-2.3L4.9 4.1l1.8-1.8 1.9 1.3 2.3-.6L12 .9z" /></Icon>
}

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="app-shell">
      <aside className="app-sidebar" aria-label="Navegação principal">
        <div className="app-brand" aria-label="UNILOG Express">
          <div className="app-brand-wordmark">
            <strong>UNILOG</strong>
            <span>EXPRESS</span>
          </div>
          <small>EXTRA COST</small>
        </div>

        <nav className="app-nav" aria-label="Módulos">
          <span className="app-nav-section">GESTÃO</span>
          <span className="app-nav-item">
            <HomeIcon />
            <span>Visão geral</span>
          </span>
          <span className="app-nav-item app-nav-item-active" aria-current="page">
            <RequestsIcon />
            <span>Solicitações</span>
          </span>

          <span className="app-nav-section app-nav-section-spaced">CONFIGURAÇÕES</span>
          <span className="app-nav-item">
            <SettingsIcon />
            <span>Cadastros</span>
          </span>
        </nav>

        <div className="app-sidebar-footer">
          <div className="app-user-avatar">A</div>
          <div>
            <strong>Administrativo</strong>
            <small>Cloudflare Access</small>
          </div>
          <span className="app-user-status" aria-label="Acesso autenticado" />
        </div>
      </aside>

      <div className="app-workspace">
        <header className="app-topbar">
          <div className="app-topbar-title">
            <span>Extra Cost Control</span>
            <strong>Solicitações</strong>
          </div>
          <div className="app-topbar-context">
            <span className="app-context-copy">
              <small>Ambiente</small>
              <strong>Administrativo</strong>
            </span>
            <span className="app-connected-badge">
              <span className="status-dot" />
              Conectado
            </span>
          </div>
        </header>
        <main className="app-main">{children}</main>
      </div>
    </div>
  )
}
