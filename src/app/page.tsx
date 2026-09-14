'use client'

import dynamic from 'next/dynamic'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Avatar } from 'primereact/avatar'
import { Button } from 'primereact/button'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { Tag } from 'primereact/tag'
import {
  fetchCatalogoAdminScope,
  fetchCatalogos,
  prefetchCatalogoAdminScope,
} from '@/services/catalogService'
import { prefetchDashboard } from '@/services/dashboardService'
import {
  AuthServiceError,
  completeFirstAccess,
  getCurrentUser,
  login,
  logout,
  type AuthUser,
} from '@/services/authService'
import {
  fetchAdministrativeSolicitationMetadata,
  fetchAdministrativeSolicitations,
} from '@/services/solicitationService'

function SectionLoading() {
  return (
    <div
      className="nx-session-loading"
      role="status"
      aria-live="polite"
      style={{ minHeight: '16rem', background: 'transparent' }}
    >
      <i className="pi pi-spin pi-spinner" />
      <span>Carregando seção…</span>
    </div>
  )
}

const AdminSolicitationsPageCurrentPeriod = dynamic(
  () => import('@/components/AdminSolicitationsPageCurrentPeriod')
    .then((module) => module.AdminSolicitationsPageCurrentPeriod),
  { ssr: false, loading: () => <SectionLoading /> },
)

const CadastrosPagePaginated = dynamic(
  () => import('@/components/CadastrosPagePaginated')
    .then((module) => module.CadastrosPagePaginated),
  { ssr: false, loading: () => <SectionLoading /> },
)

const DashboardPage = dynamic(
  () => import('@/components/DashboardPage').then((module) => module.DashboardPage),
  { ssr: false, loading: () => <SectionLoading /> },
)

const FinancialCloseoutPage = dynamic(
  () => import('@/components/FinancialCloseoutPage').then((module) => module.FinancialCloseoutPage),
  { ssr: false, loading: () => <SectionLoading /> },
)

const UsersPage = dynamic(
  () => import('@/components/UsersPage').then((module) => module.UsersPage),
  { ssr: false, loading: () => <SectionLoading /> },
)

type Section = 'dashboard' | 'solicitacoes' | 'fechamentos' | 'cadastros' | 'usuarios'

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
  { key: 'fechamentos', label: 'Fechamentos', icon: 'pi pi-wallet', administrative: true },
  { key: 'cadastros', label: 'Cadastros', icon: 'pi pi-sliders-h', administrative: true },
  { key: 'usuarios', label: 'Usuários', icon: 'pi pi-users', administrative: true, ownerOnly: true },
]

const SECTION_COPY: Record<Section, { title: string; scope: string }> = {
  dashboard: { title: 'Visão geral', scope: 'Executivo · Custos extras' },
  solicitacoes: { title: 'Solicitações', scope: 'Custos extras' },
  fechamentos: { title: 'Fechamentos', scope: 'Administrativo · Financeiro' },
  cadastros: { title: 'Cadastros', scope: 'Administrativo · Catálogos' },
  usuarios: { title: 'Usuários', scope: 'Owner · Gestão de acessos' },
}

function currentPeriod() {
  const now = new Date()
  return {
    anoRegistro: String(now.getFullYear()),
    mesRegistro: String(now.getMonth() + 1).padStart(2, '0'),
  }
}

function adjacentDashboardCompetence(offset: number, operation = 'TODOS') {
  const now = new Date()
  const closingMonth = now.getMonth() + (now.getDate() >= 21 ? 1 : 0)
  const target = new Date(now.getFullYear(), closingMonth + offset, 1)
  return {
    ano: String(target.getFullYear()),
    mesCompetencia: String(target.getMonth() + 1).padStart(2, '0'),
    operacao: operation,
    supervisor: 'TODOS' as const,
    fornecedor: 'TODOS' as const,
    tipo: 'TODOS' as const,
    responsavelCusto: 'TODOS' as const,
    atividade: 'TODOS' as const,
  }
}

function canAccess(user: AuthUser, item: NavItem) {
  if (item.ownerOnly) return user.profile === 'OWNER'
  if (item.administrative) return user.profile === 'OWNER' || user.profile === 'ADMINISTRATIVO'
  return true
}

function canNavigate(user: AuthUser, section: Section) {
  const item = NAV_ITEMS.find((candidate) => candidate.key === section)
  return item ? canAccess(user, item) : false
}

function profileLabel(profile: string) {
  if (profile === 'OWNER') return 'Owner'
  if (profile === 'ADMINISTRATIVO') return 'Administrativo'
  return 'Operacional'
}

function LoginExperience({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [firstAccess, setFirstAccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (loading) return

    if (firstAccess) {
      if (newPassword.length < 8) {
        setError('A nova senha deve possuir pelo menos 8 caracteres.')
        return
      }
      if (newPassword !== confirmPassword) {
        setError('A confirmação da nova senha não confere.')
        return
      }
    }

    setLoading(true)
    setError('')
    try {
      const user = firstAccess
        ? await completeFirstAccess(email.trim(), password, newPassword)
        : await login(email.trim(), password)
      onAuthenticated(user)
    } catch (requestError) {
      if (requestError instanceof AuthServiceError && requestError.code === 'PASSWORD_CHANGE_REQUIRED') {
        setFirstAccess(true)
        setNewPassword('')
        setConfirmPassword('')
        return
      }
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
            <span className="nx-overline">{firstAccess ? 'PRIMEIRO ACESSO' : 'ACESSO À PLATAFORMA'}</span>
            <h2 id="login-title">{firstAccess ? 'Crie sua própria senha' : 'Bem-vindo de volta'}</h2>
            <p>
              {firstAccess
                ? 'A senha recebida é temporária. Defina uma nova senha para liberar seu acesso.'
                : 'Entre com o usuário cadastrado pela administração.'}
            </p>
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
                disabled={loading || firstAccess}
              />
            </span>

            <label htmlFor="login-password">{firstAccess ? 'Senha temporária' : 'Senha'}</label>
            <Password
              inputId="login-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite sua senha"
              autoComplete="current-password"
              feedback={false}
              toggleMask
              required
              disabled={loading || firstAccess}
              className="nx-password"
              inputClassName="nx-password-input"
            />

            {firstAccess && (
              <>
                <label htmlFor="new-password">Nova senha</label>
                <Password
                  inputId="new-password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  placeholder="Mínimo de 8 caracteres"
                  autoComplete="new-password"
                  feedback={false}
                  toggleMask
                  required
                  disabled={loading}
                  className="nx-password"
                  inputClassName="nx-password-input"
                />

                <label htmlFor="confirm-password">Confirmar nova senha</label>
                <Password
                  inputId="confirm-password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                  feedback={false}
                  toggleMask
                  required
                  disabled={loading}
                  className="nx-password"
                  inputClassName="nx-password-input"
                />
              </>
            )}

            {error && (
              <div className="nx-login-error" role="alert">
                <i className="pi pi-exclamation-circle" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              label={loading ? 'Salvando…' : firstAccess ? 'Definir minha senha' : 'Entrar'}
              icon={loading ? 'pi pi-spin pi-spinner' : firstAccess ? 'pi pi-check' : 'pi pi-arrow-right'}
              iconPos="right"
              disabled={loading}
              className="nx-primary-button"
            />
          </form>

          <div className="nx-login-footnote">
            <i className="pi pi-info-circle" />
            <span>
              {firstAccess
                ? 'A nova senha substitui a senha temporária e não é armazenada em texto puro.'
                : 'O acesso depende de uma conta ativa com perfil e operação definidos.'}
            </span>
          </div>
        </div>
      </section>
    </main>
  )
}

function FunctionalShell({ user, onExit }: { user: AuthUser; onExit: () => Promise<void> }) {
  const [section, setSection] = useState<Section>('dashboard')
  const [mountedSections, setMountedSections] = useState<Set<Section>>(
    () => new Set<Section>(['dashboard']),
  )
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const copy = SECTION_COPY[section]
  const canAdministerSolicitations = user.profile === 'OWNER' || user.profile === 'ADMINISTRATIVO'

  const allowedItems = useMemo(
    () => NAV_ITEMS.filter((item) => canAccess(user, item)),
    [user],
  )

  useEffect(() => {
    const canManageCatalogs = user.profile === 'OWNER' || user.profile === 'ADMINISTRATIVO'
    const operation = user.profile === 'OWNER' || !user.operation ? 'TODOS' : user.operation

    const firstWave = window.setTimeout(() => {
      const period = currentPeriod()
      void fetchAdministrativeSolicitations({
        pagina: 1,
        tamanhoPagina: 20,
        anoRegistro: period.anoRegistro,
        mesRegistro: period.mesRegistro,
      }).catch(() => undefined)
      void fetchAdministrativeSolicitationMetadata().catch(() => undefined)

      if (canManageCatalogs) {
        void fetchCatalogos().catch(() => undefined)
        prefetchCatalogoAdminScope('RESUMO')
        prefetchCatalogoAdminScope('OPERACOES')
        prefetchCatalogoAdminScope('SUPERVISORES')
        prefetchCatalogoAdminScope('FUNCOES')
        prefetchCatalogoAdminScope('ATIVIDADES')
        prefetchCatalogoAdminScope('FORNECEDORES')
        prefetchCatalogoAdminScope('PRODUTOS')
      }
    }, 900)

    const secondWave = window.setTimeout(() => {
      const period = currentPeriod()
      void fetchAdministrativeSolicitations({
        pagina: 2,
        tamanhoPagina: 20,
        anoRegistro: period.anoRegistro,
        mesRegistro: period.mesRegistro,
      }).catch(() => undefined)
      prefetchDashboard(adjacentDashboardCompetence(-1, operation))

      if (canManageCatalogs) {
        prefetchCatalogoAdminScope('FERIADOS')
        prefetchCatalogoAdminScope('METAS')
        void fetchCatalogoAdminScope('PRECOS_MO', {
          pagina: 1,
          tamanhoPagina: 25,
        }).catch(() => undefined)
        void fetchCatalogoAdminScope('PRECOS_PRODUTOS', {
          pagina: 1,
          tamanhoPagina: 25,
        }).catch(() => undefined)
      }
    }, 2200)

    const thirdWave = window.setTimeout(() => {
      prefetchDashboard(adjacentDashboardCompetence(-2, operation))
    }, 4200)

    return () => {
      window.clearTimeout(firstWave)
      window.clearTimeout(secondWave)
      window.clearTimeout(thirdWave)
    }
  }, [user])

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
          {allowedItems.map((item) => {
            const firstAdministrative = item.administrative &&
              allowedItems.findIndex((candidate) => candidate.administrative) === allowedItems.indexOf(item)

            return (
              <div key={item.key} className={firstAdministrative ? 'nx-admin-group' : ''}>
                {firstAdministrative && <span className="nx-nav-caption">ADMINISTRAÇÃO</span>}
                <button
                  type="button"
                  className={`nx-nav-item ${section === item.key ? 'is-active' : ''}`}
                  onClick={() => navigate(item.key)}
                >
                  <i className={item.icon} />
                  <span>{item.label}</span>
                </button>
              </div>
            )
          })}
        </nav>

        <div className="nx-user-card">
          <Avatar
            label={(user.name || user.email || 'U').slice(0, 1).toUpperCase()}
            shape="circle"
            className="nx-avatar"
          />
          <div className="nx-user-copy" title={user.email}>
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
            <span className="nx-scope-chip">
              <small>Escopo ativo</small>
              <strong>{copy.scope}</strong>
            </span>
            <Tag value={profileLabel(user.profile)} severity="secondary" rounded />
            <span className="nx-gateway-state"><i /> Gateway conectado</span>
          </div>
        </header>

        <div className="nx-content nx-functional-content">
          <div hidden={section !== 'dashboard'}>
            <DashboardPage />
          </div>

          {mountedSections.has('solicitacoes') && (
            <div hidden={section !== 'solicitacoes'}>
              <AdminSolicitationsPageCurrentPeriod canAdminister={canAdministerSolicitations} />
            </div>
          )}

          {mountedSections.has('fechamentos') && canNavigate(user, 'fechamentos') && (
            <div hidden={section !== 'fechamentos'}>
              <FinancialCloseoutPage />
            </div>
          )}

          {mountedSections.has('cadastros') && canNavigate(user, 'cadastros') && (
            <div hidden={section !== 'cadastros'}>
              <CadastrosPagePaginated />
            </div>
          )}

          {mountedSections.has('usuarios') && canNavigate(user, 'usuarios') && (
            <div hidden={section !== 'usuarios'}>
              <UsersPage />
            </div>
          )}
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

  return <FunctionalShell user={user} onExit={handleLogout} />
}