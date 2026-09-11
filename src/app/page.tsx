'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Avatar } from 'primereact/avatar'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { Tag } from 'primereact/tag'
import {
  getCurrentUser,
  login,
  logout,
  type AuthUser,
} from '@/services/authService'

type Section = 'dashboard' | 'solicitacoes' | 'cadastros' | 'usuarios'

type NavItem = {
  key: Section
  label: string
  icon: string
  administrative?: boolean
  ownerOnly?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', label: 'Visão geral', icon: 'pi pi-chart-bar' },
  { key: 'solicitacoes', label: 'Solicitações', icon: 'pi pi-receipt' },
  { key: 'cadastros', label: 'Cadastros', icon: 'pi pi-sliders-h', administrative: true },
  { key: 'usuarios', label: 'Usuários', icon: 'pi pi-users', administrative: true, ownerOnly: true },
]

const SECTION_COPY: Record<Section, { title: string; eyebrow: string; description: string }> = {
  dashboard: {
    eyebrow: 'EXECUTIVO',
    title: 'Visão geral',
    description: 'Indicadores e leitura consolidada dos custos extras.',
  },
  solicitacoes: {
    eyebrow: 'OPERAÇÃO',
    title: 'Solicitações',
    description: 'Fluxo operacional, triagem e acompanhamento dos lançamentos.',
  },
  cadastros: {
    eyebrow: 'ADMINISTRAÇÃO',
    title: 'Cadastros',
    description: 'Catálogos, fornecedores, preços e parâmetros da operação.',
  },
  usuarios: {
    eyebrow: 'CONTROLE DE ACESSO',
    title: 'Usuários',
    description: 'Perfis, escopos e credenciais da plataforma.',
  },
}

function canAccess(user: AuthUser, item: NavItem) {
  if (item.ownerOnly) return user.profile === 'OWNER'
  if (item.administrative) return user.profile === 'OWNER' || user.profile === 'ADMINISTRATIVO'
  return true
}

function profileLabel(profile: string) {
  if (profile === 'OWNER') return 'Owner'
  if (profile === 'ADMINISTRATIVO') return 'Administrativo'
  return 'Operacional'
}

function LoginExperience({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return

    setLoading(true)
    setError('')
    try {
      const user = await login(email.trim(), password)
      onAuthenticated(user)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível entrar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="nx-login-page">
      <section className="nx-login-card" aria-labelledby="login-title">
        <aside className="nx-login-brand">
          <div className="nx-brand-topline">
            <img src="/brand/unilog-logo-white-transparent.svg" alt="Unilog Express" />
            <span className="nx-product-chip">Extra Cost Control</span>
          </div>

          <div className="nx-brand-copy">
            <span className="nx-overline nx-overline-light">GESTÃO OPERACIONAL</span>
            <h1>Custos extras com leitura simples e controle rigoroso.</h1>
            <p>
              Um ambiente único para operação, administrativo e gestão acompanharem solicitações,
              custos e capacidade de atendimento.
            </p>
          </div>

          <div className="nx-login-proof">
            <span><i className="pi pi-shield" /> Acesso protegido</span>
            <span><i className="pi pi-lock" /> Credenciais seguras</span>
          </div>
        </aside>

        <div className="nx-login-form-panel">
          <div className="nx-login-heading">
            <span className="nx-overline">ACESSO À PLATAFORMA</span>
            <h2 id="login-title">Bem-vindo de volta</h2>
            <p>Entre com o usuário cadastrado pela administração.</p>
          </div>

          <form className="nx-login-form" onSubmit={submit}>
            <label htmlFor="login-email">E-mail</label>
            <span className="p-input-icon-left nx-field-icon">
              <i className="pi pi-envelope" />
              <InputText
                id="login-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nome@empresa.com.br"
                autoComplete="username"
                required
                disabled={loading}
              />
            </span>

            <label htmlFor="login-password">Senha</label>
            <Password
              inputId="login-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              feedback={false}
              toggleMask
              required
              disabled={loading}
              className="nx-password"
              inputClassName="nx-password-input"
            />

            {error && (
              <div className="nx-login-error" role="alert">
                <i className="pi pi-exclamation-circle" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              label={loading ? 'Entrando…' : 'Entrar'}
              icon={loading ? 'pi pi-spin pi-spinner' : 'pi pi-arrow-right'}
              iconPos="right"
              loading={false}
              disabled={loading}
              className="nx-primary-button"
            />
          </form>

          <div className="nx-login-footnote">
            <i className="pi pi-info-circle" />
            <span>O acesso depende de uma conta ativa com perfil e operação definidos.</span>
          </div>
        </div>
      </section>
    </main>
  )
}

function AppShellPreview({ user, onExit }: { user: AuthUser; onExit: () => Promise<void> }) {
  const [section, setSection] = useState<Section>('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const copy = SECTION_COPY[section]

  const allowedItems = useMemo(
    () => NAV_ITEMS.filter((item) => canAccess(user, item)),
    [user],
  )

  return (
    <main className={`nx-app ${collapsed ? 'is-collapsed' : ''}`}>
      {mobileOpen && (
        <button
          className="nx-sidebar-backdrop"
          type="button"
          aria-label="Fechar menu"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`nx-sidebar ${mobileOpen ? 'is-mobile-open' : ''}`}>
        <div className="nx-sidebar-brand">
          <img src="/brand/unilog-logo-white-transparent.svg" alt="Unilog Express" />
          <button
            type="button"
            className="nx-icon-button nx-desktop-collapse"
            onClick={() => setCollapsed((current) => !current)}
            aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          >
            <i className={collapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'} />
          </button>
          <button
            type="button"
            className="nx-icon-button nx-mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Fechar menu"
          >
            <i className="pi pi-times" />
          </button>
        </div>

        <nav className="nx-navigation" aria-label="Navegação principal">
          {allowedItems.map((item, index) => (
            <div key={item.key} className={item.administrative && index > 1 ? 'nx-admin-group' : ''}>
              {item.administrative && index === allowedItems.findIndex((candidate) => candidate.administrative) && (
                <span className="nx-nav-caption">ADMINISTRAÇÃO</span>
              )}
              <button
                type="button"
                className={`nx-nav-item ${section === item.key ? 'is-active' : ''}`}
                onClick={() => {
                  setSection(item.key)
                  setMobileOpen(false)
                }}
              >
                <i className={item.icon} />
                <span>{item.label}</span>
              </button>
            </div>
          ))}
        </nav>

        <div className="nx-user-card">
          <Avatar
            label={(user.name || user.email || 'U').slice(0, 1).toUpperCase()}
            shape="circle"
            className="nx-avatar"
          />
          <div className="nx-user-copy">
            <strong>{user.name || user.email}</strong>
            <span>{profileLabel(user.profile)} · {user.operation || 'Sem operação'}</span>
          </div>
          <button type="button" className="nx-icon-button" onClick={() => void onExit()} aria-label="Sair">
            <i className="pi pi-sign-out" />
          </button>
        </div>
      </aside>

      <section className="nx-workspace">
        <header className="nx-topbar">
          <div className="nx-topbar-title">
            <button
              type="button"
              className="nx-icon-button nx-mobile-menu"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu"
            >
              <i className="pi pi-bars" />
            </button>
            <div>
              <small>EXTRA COST CONTROL</small>
              <strong>{copy.title}</strong>
            </div>
          </div>

          <div className="nx-topbar-status">
            <Tag value={profileLabel(user.profile)} severity="secondary" rounded />
            <span className="nx-gateway-state"><i /> Gateway conectado</span>
          </div>
        </header>

        <div className="nx-content">
          <header className="nx-page-heading">
            <div>
              <span className="nx-overline">{copy.eyebrow}</span>
              <h1>{copy.title}</h1>
              <p>{copy.description}</p>
            </div>
            <Tag value={user.operation || 'TODOS'} severity="secondary" rounded />
          </header>

          <section className="nx-foundation-banner">
            <div className="nx-foundation-icon"><i className="pi pi-sparkles" /></div>
            <div>
              <span className="nx-overline">NOVA FUNDAÇÃO VISUAL</span>
              <h2>Next.js + PrimeReact</h2>
              <p>
                A identidade visual já está aplicada. Nesta branch, as telas funcionais serão reconectadas
                depois da validação do novo shell e dos componentes base.
              </p>
            </div>
          </section>

          <div className="nx-metric-grid">
            <article className="nx-metric-card">
              <span className="nx-metric-icon"><i className="pi pi-bolt" /></span>
              <div><small>STACK</small><strong>Next.js</strong><span>App Router</span></div>
            </article>
            <article className="nx-metric-card">
              <span className="nx-metric-icon"><i className="pi pi-palette" /></span>
              <div><small>COMPONENTES</small><strong>PrimeReact</strong><span>tema Unilog</span></div>
            </article>
            <article className="nx-metric-card">
              <span className="nx-metric-icon"><i className="pi pi-cloud" /></span>
              <div><small>DEPLOY</small><strong>Cloudflare</strong><span>Pages + Functions</span></div>
            </article>
            <article className="nx-metric-card">
              <span className="nx-metric-icon"><i className="pi pi-database" /></span>
              <div><small>BACKEND</small><strong>Preservado</strong><span>Apps Script + Sheets</span></div>
            </article>
          </div>

          <section className="nx-demo-panel">
            <div className="nx-demo-header">
              <div>
                <span className="nx-overline">SISTEMA VISUAL</span>
                <h2>Componentes preparados para as próximas telas</h2>
                <p>Estados, campos, botões, tags e superfícies seguem a mesma linguagem do login.</p>
              </div>
              <Button label="Ação primária" icon="pi pi-plus" className="nx-primary-button nx-compact-button" />
            </div>
            <div className="nx-demo-content">
              <div className="nx-demo-copy">
                <Tag value="Ativo" severity="success" rounded />
                <Tag value="Administrativo" severity="secondary" rounded />
                <Tag value="Atenção" severity="warning" rounded />
              </div>
              <div className="nx-demo-field">
                <label htmlFor="demo-search">Busca padronizada</label>
                <span className="p-input-icon-left nx-field-icon">
                  <i className="pi pi-search" />
                  <InputText id="demo-search" placeholder="Buscar na plataforma…" />
                </span>
              </div>
            </div>
          </section>
        </div>
      </section>
    </main>
  )
}

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

  return <AppShellPreview user={user} onExit={handleLogout} />
}
