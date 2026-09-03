import { useState, type PropsWithChildren } from 'react'

const BRAND_LOGO='/brand/unilog-logo-white-transparent.svg'

export function AppShell({children}:PropsWithChildren){
  const[collapsed,setCollapsed]=useState(()=>localStorage.getItem('extra-cost:sidebar')==='collapsed')
  const[mobileOpen,setMobileOpen]=useState(false)

  function toggleCollapsed(){
    setCollapsed(current=>{
      const next=!current
      localStorage.setItem('extra-cost:sidebar',next?'collapsed':'expanded')
      return next
    })
  }

  return <div className={`app-shell ${collapsed?'sidebar-collapsed':''}`}>
    {mobileOpen&&<button className="sidebar-backdrop" type="button" aria-label="Fechar menu de navegação" onClick={()=>setMobileOpen(false)}/>} 
    <aside className={`sidebar ${mobileOpen?'mobile-open':''}`} aria-label="Navegação principal">
      <div className="sidebar-brand">
        <img src={BRAND_LOGO} alt="Unilog Express"/>
        <button type="button" className="sidebar-collapse" onClick={toggleCollapsed} title={collapsed?'Expandir menu':'Recolher menu'} aria-label={collapsed?'Expandir menu lateral':'Recolher menu lateral'}><span className="material-symbols-rounded shell-menu-icon" aria-hidden="true">{collapsed?'menu':'menu_open'}</span></button>
        <button type="button" className="sidebar-mobile-close" onClick={()=>setMobileOpen(false)} aria-label="Fechar menu"><span className="material-symbols-rounded" aria-hidden="true">close</span></button>
      </div>

      <nav className="sidebar-nav" aria-label="Seções do Extra Cost Control">
        <div><span className="nav-section-label">GESTÃO</span></div>
        <div><span className="sidebar-link"><span className="material-symbols-rounded" aria-hidden="true">space_dashboard</span><span className="nav-label">Visão geral</span></span></div>
        <div><span className="sidebar-link active" aria-current="page"><span className="material-symbols-rounded" aria-hidden="true">receipt_long</span><span className="nav-label">Solicitações</span></span></div>
        <div className="admin-nav-item"><span className="nav-section-label">ADMINISTRAÇÃO</span><span className="sidebar-link"><span className="material-symbols-rounded" aria-hidden="true">tune</span><span className="nav-label">Cadastros</span></span></div>
      </nav>

      <div className="sidebar-user"><div className="user-avatar">A</div><div className="sidebar-user-copy"><strong>Administrativo</strong><span>Cloudflare Access</span></div><span className="sidebar-user-connected" title="Acesso autenticado"><span className="sync-dot"/></span></div>
    </aside>

    <div className="workspace">
      <header className="topbar">
        <div className="topbar-title"><button type="button" className="mobile-menu-button" onClick={()=>setMobileOpen(true)} aria-label="Abrir menu de navegação"><span className="material-symbols-rounded shell-menu-icon" aria-hidden="true">menu</span></button><div><span className="topbar-kicker">EXTRA COST CONTROL</span><strong>Solicitações</strong></div></div>
        <div className="topbar-profile"><span className="topbar-scope"><small>Escopo ativo</small><strong>Administrativo · Custos extras</strong></span><span className="topbar-sync"><span className="sync-dot"/><span>Gateway conectado</span></span></div>
      </header>
      <main className="content">{children}</main>
    </div>
  </div>
}
