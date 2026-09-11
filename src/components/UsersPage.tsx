import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from './PageHeader'
import { Modal } from './ui/Modal'
import {
  Badge,
  EmptyState,
  Panel,
  PanelHeader,
  SearchField,
  Skeleton,
  SummaryMetrics,
  type SummaryMetricItem,
} from './ui/Primitives'
import { fetchCatalogoAdminScope } from '../services/catalogService'
import {
  fetchUsers,
  resetUserPassword,
  saveUser,
  type ManagedUser,
  type UserProfile,
} from '../services/userService'

type Draft = {
  email: string
  nome: string
  perfil: UserProfile
  operacao: string
  ativo: boolean
  password: string
}

const emptyDraft = (): Draft => ({
  email: '',
  nome: '',
  perfil: 'OPERACIONAL',
  operacao: '',
  ativo: true,
  password: '',
})

function formatDate(value: string) {
  if (!value) return '—'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR')
}

function profileLabel(profile: UserProfile) {
  if (profile === 'OWNER') return 'Owner'
  if (profile === 'ADMINISTRATIVO') return 'Administrativo'
  return 'Operacional'
}

export function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [operations, setOperations] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingEmail, setEditingEmail] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [loadError, setLoadError] = useState('')
  const [editorError, setEditorError] = useState('')

  const [resetTarget, setResetTarget] = useState<ManagedUser | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [resetConfirmation, setResetConfirmation] = useState('')
  const [resetError, setResetError] = useState('')

  async function load() {
    setLoading(true)
    setLoadError('')
    try {
      const [loadedUsers, catalog] = await Promise.all([
        fetchUsers(),
        fetchCatalogoAdminScope('OPERACOES'),
      ])
      setUsers(loadedUsers)
      setOperations(
        (catalog.operacoes || [])
          .filter((item) => item.ativo)
          .map((item) => item.nome),
      )
    } catch (requestError) {
      setLoadError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível carregar usuários.',
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
  }, [])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(''), 4500)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const filtered = useMemo(() => {
    const query = search.trim().toUpperCase()
    if (!query) return users
    return users.filter((user) =>
      `${user.nome} ${user.email} ${user.perfil} ${user.operacao}`
        .toUpperCase()
        .includes(query),
    )
  }, [search, users])

  const summary = useMemo<SummaryMetricItem[]>(() => {
    const active = users.filter((user) => user.ativo).length
    const administrative = users.filter(
      (user) => user.perfil === 'OWNER' || user.perfil === 'ADMINISTRATIVO',
    ).length
    const operational = users.filter((user) => user.perfil === 'OPERACIONAL').length

    return [
      {
        key: 'total',
        label: 'Usuários',
        value: users.length,
        detail: 'cadastros na plataforma',
        icon: 'manage_accounts',
        tone: 'neutral',
      },
      {
        key: 'active',
        label: 'Ativos',
        value: active,
        detail: 'com acesso liberado',
        icon: 'verified_user',
        tone: 'success',
      },
      {
        key: 'admin',
        label: 'Gestão',
        value: administrative,
        detail: 'owner + administrativo',
        icon: 'admin_panel_settings',
        tone: 'info',
      },
      {
        key: 'operational',
        label: 'Operacionais',
        value: operational,
        detail: 'escopo por operação',
        icon: 'badge',
        tone: 'neutral',
      },
    ]
  }, [users])

  const isNew = !editingEmail
  const editingUser = users.find((item) => item.email === editingEmail) || null

  function closeEditor() {
    if (saving) return
    setEditorOpen(false)
    setEditorError('')
  }

  function newUser() {
    setEditingEmail('')
    setDraft(emptyDraft())
    setEditorError('')
    setEditorOpen(true)
  }

  function editUser(user: ManagedUser) {
    setEditingEmail(user.email)
    setDraft({
      email: user.email,
      nome: user.nome,
      perfil: user.perfil,
      operacao: user.operacao,
      ativo: user.ativo,
      password: '',
    })
    setEditorError('')
    setEditorOpen(true)
  }

  function updateProfile(profile: UserProfile) {
    setDraft((current) => ({
      ...current,
      perfil: profile,
      operacao:
        profile === 'OWNER'
          ? 'TODOS'
          : profile === 'ADMINISTRATIVO' && !current.operacao
            ? 'TODOS'
            : profile === 'OPERACIONAL' && current.operacao === 'TODOS'
              ? ''
              : current.operacao,
    }))
  }

  async function handleSave() {
    setSaving(true)
    setEditorError('')
    try {
      const saved = await saveUser({
        email: draft.email.trim(),
        nome: draft.nome.trim(),
        perfil: draft.perfil,
        operacao: draft.perfil === 'OWNER' ? 'TODOS' : draft.operacao,
        ativo: draft.ativo,
        ...(draft.password ? { password: draft.password } : {}),
      })

      setUsers((current) => {
        const exists = current.some((item) => item.email === saved.email)
        const next = exists
          ? current.map((item) => (item.email === saved.email ? saved : item))
          : [...current, saved]
        return next.slice().sort((left, right) => left.nome.localeCompare(right.nome, 'pt-BR'))
      })

      setEditorOpen(false)
      setEditingEmail('')
      setDraft(emptyDraft())
      setNotice('Usuário salvo com sucesso.')
    } catch (requestError) {
      setEditorError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível salvar o usuário.',
      )
    } finally {
      setSaving(false)
    }
  }

  function openResetPassword() {
    if (!editingUser) return
    setEditorOpen(false)
    setResetTarget(editingUser)
    setResetPassword('')
    setResetConfirmation('')
    setResetError('')
  }

  function closeResetPassword() {
    if (saving) return
    setResetTarget(null)
    setResetPassword('')
    setResetConfirmation('')
    setResetError('')
  }

  async function handleResetPassword() {
    if (!resetTarget) return

    if (resetPassword.length < 8) {
      setResetError('A nova senha deve possuir pelo menos 8 caracteres.')
      return
    }

    if (resetPassword !== resetConfirmation) {
      setResetError('A confirmação da senha não confere.')
      return
    }

    setSaving(true)
    setResetError('')
    try {
      const saved = await resetUserPassword(resetTarget.email, resetPassword)
      setUsers((current) =>
        current.map((item) => (item.email === saved.email ? saved : item)),
      )
      closeResetPassword()
      setNotice('Senha redefinida com sucesso. Nenhuma senha em texto puro foi armazenada.')
    } catch (requestError) {
      setResetError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível redefinir a senha.',
      )
    } finally {
      setSaving(false)
    }
  }

  const saveDisabled =
    saving ||
    !draft.nome.trim() ||
    !draft.email.trim() ||
    (isNew && draft.password.length < 8) ||
    (draft.perfil === 'OPERACIONAL' && !draft.operacao)

  return (
    <section className="admin-page catalog-page">
      <PageHeader
        eyebrow="ADMINISTRAÇÃO"
        title="Usuários"
        description="Perfis, escopo operacional, ativação e credenciais da plataforma. Disponível somente para OWNER."
      />

      {(notice || loadError) && (
        <div
          className={`admin-alert ${notice ? 'admin-alert-success' : ''}`.trim()}
          role={loadError ? 'alert' : 'status'}
        >
          <span className="material-symbols-rounded" aria-hidden="true">
            {notice ? 'check_circle' : 'error'}
          </span>
          <span>{notice || loadError}</span>
          <button
            type="button"
            className="icon-button"
            onClick={() => {
              setNotice('')
              setLoadError('')
            }}
            aria-label="Fechar notificação"
          >
            <span className="material-symbols-rounded" aria-hidden="true">close</span>
          </button>
        </div>
      )}

      <SummaryMetrics items={summary} ariaLabel="Resumo dos usuários da plataforma" />

      <Panel className="catalog-provider-list">
        <PanelHeader
          eyebrow="ACESSOS"
          title="Usuários cadastrados"
          description="Administre perfis e escopos sem expor hash, salt ou senha."
          trailing={
            <button
              type="button"
              className="button button-primary"
              onClick={newUser}
            >
              <span className="material-symbols-rounded" aria-hidden="true">person_add</span>
              Novo usuário
            </button>
          }
        />

        <div className="catalog-list-toolbar">
          <SearchField
            ariaLabel="Pesquisar usuários"
            placeholder="Buscar nome, e-mail, perfil ou operação…"
            value={search}
            onChange={setSearch}
          />
        </div>

        {loading ? (
          <Skeleton lines={7} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Nenhum usuário encontrado"
            description="Cadastre um usuário ou ajuste a pesquisa."
            icon="manage_accounts"
          />
        ) : (
          <div className="table-wrap embedded">
            <table className="responsive-data-table catalog-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>Perfil</th>
                  <th>Operação</th>
                  <th>Status</th>
                  <th>Senha</th>
                  <th>Último ajuste</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => (
                  <tr key={user.email}>
                    <td data-label="Usuário" data-primary="true">
                      <div className="table-primary">
                        <strong>{user.nome}</strong>
                        <small>{user.email}</small>
                      </div>
                    </td>
                    <td data-label="Perfil">
                      <Badge>{profileLabel(user.perfil)}</Badge>
                    </td>
                    <td data-label="Operação">
                      <strong>{user.operacao || '—'}</strong>
                    </td>
                    <td data-label="Status">
                      <Badge tone={user.ativo ? 'success' : 'neutral'}>
                        {user.ativo ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </td>
                    <td data-label="Senha">
                      <Badge tone={user.senhaConfigurada ? 'success' : 'warning'}>
                        {user.senhaConfigurada ? 'Configurada' : 'Pendente'}
                      </Badge>
                    </td>
                    <td data-label="Último ajuste">{formatDate(user.ultimaAlteracao)}</td>
                    <td data-label="Ação">
                      <button
                        type="button"
                        className="button catalog-edit-button"
                        onClick={() => editUser(user)}
                      >
                        Editar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Modal
        open={editorOpen}
        titleId="user-editor-title"
        eyebrow={isNew ? 'NOVO ACESSO' : 'EDIÇÃO DE ACESSO'}
        title={isNew ? 'Cadastrar usuário' : draft.nome || draft.email}
        description={
          isNew
            ? 'Defina perfil, escopo e senha inicial. A senha será protegida antes de ser gravada.'
            : `Último ajuste: ${formatDate(editingUser?.ultimaAlteracao || '')}`
        }
        headerAside={
          !isNew && editingUser
            ? <Badge tone={editingUser.ativo ? 'success' : 'neutral'}>{editingUser.ativo ? 'Ativo' : 'Inativo'}</Badge>
            : undefined
        }
        onClose={closeEditor}
        busy={saving}
        width="medium"
        bodyClassName="catalog-editor-modal-body"
        footer={
          <>
            {!isNew && (
              <button
                className="button"
                type="button"
                onClick={openResetPassword}
                disabled={saving}
              >
                Redefinir senha
              </button>
            )}
            <button className="button" type="button" onClick={closeEditor} disabled={saving}>
              Cancelar
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={() => void handleSave()}
              disabled={saveDisabled}
            >
              {saving ? 'Salvando…' : isNew ? 'Cadastrar usuário' : 'Salvar alterações'}
            </button>
          </>
        }
      >
        <div className="catalog-editor-form">
          {editorError && (
            <div className="admin-alert catalog-editor-error" role="alert">
              <span className="material-symbols-rounded" aria-hidden="true">error</span>
              <span>{editorError}</span>
            </div>
          )}

          <div className="catalog-form-grid">
            <label>
              <span>Nome</span>
              <input
                value={draft.nome}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, nome: event.target.value }))
                }
                autoComplete="name"
              />
            </label>

            <label>
              <span>E-mail</span>
              <input
                type="email"
                value={draft.email}
                disabled={!isNew}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, email: event.target.value }))
                }
                autoComplete="email"
              />
              {!isNew && <small>O e-mail identifica a conta e não é alterado na edição.</small>}
            </label>

            <label>
              <span>Perfil</span>
              <select
                value={draft.perfil}
                onChange={(event) => updateProfile(event.target.value as UserProfile)}
              >
                <option value="OWNER">Owner</option>
                <option value="ADMINISTRATIVO">Administrativo</option>
                <option value="OPERACIONAL">Operacional</option>
              </select>
            </label>

            <label>
              <span>Operação</span>
              <select
                value={draft.perfil === 'OWNER' ? 'TODOS' : draft.operacao}
                disabled={draft.perfil === 'OWNER'}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, operacao: event.target.value }))
                }
              >
                {draft.perfil === 'OPERACIONAL' ? (
                  <option value="">Selecione a operação</option>
                ) : (
                  <option value="TODOS">Todas as operações</option>
                )}
                {operations.map((operation) => (
                  <option key={operation} value={operation}>{operation}</option>
                ))}
              </select>
              <small>
                {draft.perfil === 'OWNER'
                  ? 'Owner possui escopo global.'
                  : draft.perfil === 'OPERACIONAL'
                    ? 'Operacional deve ficar vinculado a uma operação específica.'
                    : 'Administrativo pode atuar em todas ou em uma operação específica.'}
              </small>
            </label>

            {isNew && (
              <label>
                <span>Senha inicial</span>
                <input
                  type="password"
                  value={draft.password}
                  onChange={(event) =>
                    setDraft((current) => ({ ...current, password: event.target.value }))
                  }
                  minLength={8}
                  autoComplete="new-password"
                />
                <small>Mínimo de 8 caracteres. O texto puro não é armazenado.</small>
              </label>
            )}

            <label>
              <span>Status</span>
              <select
                value={draft.ativo ? 'SIM' : 'NAO'}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, ativo: event.target.value === 'SIM' }))
                }
              >
                <option value="SIM">Ativo</option>
                <option value="NAO">Inativo</option>
              </select>
            </label>
          </div>

          {!isNew && (
            <div className="catalog-version-note">
              <span className="material-symbols-rounded" aria-hidden="true">info</span>
              <p>
                Alterações de perfil, operação ou status passam a valer integralmente em uma nova autenticação ou após a expiração da sessão atual.
              </p>
            </div>
          )}
        </div>
      </Modal>

      <Modal
        open={Boolean(resetTarget)}
        titleId="user-password-reset-title"
        eyebrow="CREDENCIAL"
        title="Redefinir senha"
        description={resetTarget ? `${resetTarget.nome} · ${resetTarget.email}` : ''}
        onClose={closeResetPassword}
        busy={saving}
        width="medium"
        bodyClassName="catalog-editor-modal-body"
        footer={
          <>
            <button className="button" type="button" onClick={closeResetPassword} disabled={saving}>
              Cancelar
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={() => void handleResetPassword()}
              disabled={saving || resetPassword.length < 8 || !resetConfirmation}
            >
              {saving ? 'Salvando…' : 'Redefinir senha'}
            </button>
          </>
        }
      >
        <div className="catalog-editor-form">
          {resetError && (
            <div className="admin-alert catalog-editor-error" role="alert">
              <span className="material-symbols-rounded" aria-hidden="true">error</span>
              <span>{resetError}</span>
            </div>
          )}

          <label>
            <span>Nova senha</span>
            <input
              type="password"
              value={resetPassword}
              onChange={(event) => setResetPassword(event.target.value)}
              minLength={8}
              autoComplete="new-password"
            />
            <small>Mínimo de 8 caracteres.</small>
          </label>

          <label>
            <span>Confirmar nova senha</span>
            <input
              type="password"
              value={resetConfirmation}
              onChange={(event) => setResetConfirmation(event.target.value)}
              minLength={8}
              autoComplete="new-password"
            />
          </label>
        </div>
      </Modal>
    </section>
  )
}
