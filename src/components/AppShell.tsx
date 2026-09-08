import { useEffect, useRef, useState, type PropsWithChildren } from 'react'

const BRAND_LOGO='/brand/unilog-logo-white-transparent.svg'
const MOBILE_SIDEBAR_ID='extra-cost-mobile-sidebar'

export type AppSection='solicitacoes'|'cadastros'

type Props=PropsWithChildren<{
  section:AppSection
  onNavigate:(section:AppSection)=>void
}>

export function AppShell({children,section,onNavigate}:Props){
  const[collapsed,setCollapsed]=useState(()=>localStorage.getItem('extra-cost:sidebar')==='collapsed')
  const[mobileOpen,setMobileOpen]=useState(false)
  const[identityEmail,setIdentityEmail]=useState('')
  const sidebarRef=useRef<HTMLElement>(null)
  const mobileMenuButtonRef=useRef<HTMLButtonElement>(null)
  const wasMobileOpen=useRef(false)

  useEffect(()=>{
    let active=true
    void fetch('/cdn-cgi/access/get-identity',{headers:{accept:'application/json'}})
      .then(response=>response.ok?response.json():null)
      .then((payload:unknown)=>{
        if(!active||!payload||typeof payload!=='object')return
        const email='email' in payload&&typeof payload.email==='string'?payload.email.trim().toLowerCase():''
        if(email)setIdentityEmail(email)
      })
      .catch(()=>undefined)
    return()=>{active=false}
  },[])

  useEffect(()=>{
    if(wasMobileOpen.current&&!mobileOpen)mobileMenuButtonRef.current?.focus()
    wasMobileOpen.current=mobileOpen
  },[mobileOpen])

  useEffect(()=>{
    if(!mobileOpen)return
    const sidebar=sidebarRef.current
    if(!sidebar)return

    const previousOverflow=document.body.style.overflow
    document.body.style.overflow='hidden'
    const selector='button:not([disabled]),a[href],select:not([disabled]),input:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    const focusable=()=>Array.from(sidebar.querySelectorAll<HTMLElement>(selector)).filter(element=>element.offsetParent!==null)
    const initial=sidebar.querySelector<HTMLButtonElement>('.sidebar-mobile-close')??focusable()[0]
    initial?.focus()

    function handleKeyDown(event:KeyboardEvent){
      if(event.key==='Escape'){
        event.preventDefault()
        setMobileOpen(false)
        return
      }
      if(event.key!=='Tab')return
      const elements=focusable()
      if(!elements.length)return
      const first=elements[0]
      const last=elements[elements.length-1]
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}
    }

    document.addEventListener('keydown',handleKeyDown)
    return()=>{
      document.body.style.overflow=previousOverflow
      document.removeEventListener('keydown',handleKeyDown)
    }
  },[mobileOpen])

  function toggleCollapsed(){
    setCollapsed(current=>{
      const next=!current
      localStorage.setItem('extra-cost:sidebar',next?'collapsed':'expanded')
      return next
    })
  }

  function navigate(next:AppSection){
    onNavigate(next)
    setMobileOpen(false)
  }

  function signOut(){
    window.location.assign('/cdn-cgi/access/logout')
  }

  const identityLabel=identityEmail||'Administrativo'
  const avatar=(identityEmail||'A').slice(0,1).toUpperCase()
  const pageTitle=section==='cadastros'?'Cadastros':'Solicitações'
  const scopeTitle=section==='cadastros'?'Administrativo · Catálogos':'Administrativo · Custos extras'

  return <div className={`app-shell ${collapsed?'sidebar-collapsed':''}`}>
    {mobileOpen&&<button className="sidebar-backdrop" type="button" aria-label="Fechar menu de navegação" onClick={()=>setMobileOpen(false)}/>} 
    <aside id={MOBILE_SIDEBAR_ID} ref={sidebarRef} className={`sidebar ${mobileOpen?'mobile-open':''}`} aria-label="Navegação principal" {...(mobileOpen?{role:'dialog','aria-modal':true as const}:{})}>
      <div className="sidebar-brand">
        <img src={BRAND_LOGO} alt="Unilog Express"/>
        <button type="button" className="sidebar-collapse" onClick={toggleCollapsed} title={collapsed?'Expandir menu':'Recolher menu'} aria-label={collapsed?'Expandir menu lateral':'Recolher menu lateral'}><span className="material-symbols-rounded shell-menu-icon" aria-hidden="true">{collapsed?'menu':'menu_open'}</span></button>
        <button type="button" className="sidebar-mobile-close" onClick={()=>setMobileOpen(false)} aria-label="Fechar menu"><span className="material-symbols-rounded" aria-hidden="true">close</span></button>
      </div>

      <nav className="sidebar-nav" aria-label="Seções do Extra Cost Control">
        <div><span className="sidebar-link sidebar-link-disabled" aria-disabled="true" title="Visão geral em construção"><span className="material-symbols-rounded" aria-hidden="true">space_dashboard</span><span className="nav-label">Visão geral</span></span></div>
        <div><button type="button" className={`sidebar-link ${section==='solicitacoes'?'active':''}`.trim()} aria-current={section==='solicitacoes'?'page':undefined} onClick={()=>navigate('solicitacoes')}><span className="material-symbols-rounded" aria-hidden="true">receipt_long</span><span className="nav-label">Solicitações</span></button></div>
        <div className="admin-nav-item"><span className="nav-section-label">ADMINISTRAÇÃO</span><button type="button" className={`sidebar-link ${section==='cadastros'?'active':''}`.trim()} aria-current={section==='cadastros'?'page':undefined} onClick={()=>navigate('cadastros')}><span className="material-symbols-rounded" aria-hidden="true">tune</span><span className="nav-label">Cadastros</span></button></div>
      </nav>

      <div className="sidebar-user"><div className="user-avatar">{avatar}</div><div className="sidebar-user-copy" title={identityEmail||undefined}><strong>{identityLabel}</strong><span>Cloudflare Access</span></div><button type="button" onClick={signOut} title="Sair" aria-label="Sair do Extra Cost Control"><span className="material-symbols-rounded" aria-hidden="true">logout</span></button></div>
    </aside>

    <div className="workspace">
      <header className="topbar">
        <div className="topbar-title"><button ref={mobileMenuButtonRef} type="button" className="mobile-menu-button" onClick={()=>setMobileOpen(true)} aria-label="Abrir menu de navegação" aria-expanded={mobileOpen} aria-controls={MOBILE_SIDEBAR_ID}><span className="material-symbols-rounded shell-menu-icon" aria-hidden="true">menu</span></button><div><span className="topbar-kicker">EXTRA COST CONTROL</span><strong>{pageTitle}</strong></div></div>
        <div className="topbar-profile"><span className="topbar-scope"><small>Escopo ativo</small><strong>{scopeTitle}</strong></span><span className="topbar-sync"><span className="sync-dot"/><span>Gateway conectado</span></span></div>
      </header>
      <main className="content">{children}</main>
    </div>
  </div>
}
