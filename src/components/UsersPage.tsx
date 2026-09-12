import { useEffect, useMemo, useState } from 'react'
import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Dropdown } from 'primereact/dropdown'
import { InputSwitch } from 'primereact/inputswitch'
import { InputText } from 'primereact/inputtext'
import { Password } from 'primereact/password'
import { Tag } from 'primereact/tag'
import { PageHeader } from './PageHeader'
import { Modal } from './ui/Modal'
import { EmptyState, Panel, PanelHeader, SearchField, Skeleton, SummaryMetrics, type SummaryMetricItem } from './ui/Primitives'
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

const profileOptions = [
  { label: 'Owner', value: 'OWNER' },
  { label: 'Administrativo', value: 'ADMINISTRATIVO' },
  { label: 'Operacional', value: 'OPERACIONAL' },
]

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
      setOperations((catalog.operacoes || []).filter((item) => item.ativo).map((item) => item.nome))
    } catch (requestError) {
      setLoadError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar usuários.')
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
      `${user.nome} ${user.email} ${user.perfil} ${user.operacao}`.toUpperCase().includes(query),
    )
  }, [search, users])

  const summary = useMemo<SummaryMetricItem[]>(() => {
    const active = users.filter((user) => user.ativo).length
    const administrative = users.filter((user) => user.perfil === 'OWNER' || user.perfil === 'ADMINISTRATIVO').length
    const operational = users.filter((user) => user.perfil === 'OPERACIONAL').length
    return [
      { key: 'total', label: 'Usuários', value: users.length, detail: 'cadastros na plataforma', icon: 'manage_accounts' },
      { key: 'active', label: 'Ativos', value: active, detail: 'com acesso liberado', icon: 'verified_user', tone: 'success' },
      { key: 'admin', label: 'Gestão', value: administrative, detail: 'owner + administrativo', icon: 'admin_panel_settings', tone: 'info' },
      { key: 'operational', label: 'Operacionais', value: operational, detail: 'escopo por operação', icon: 'badge' },
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
    setDraft({ email: user.email, nome: user.nome, perfil: user.perfil, operacao: user.operacao, ativo: user.ativo, password: '' })
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
        const next = exists ? current.map((item) => (item.email === saved.email ? saved : item)) : [...current, saved]
        return next.slice().sort((left, right) => left.nome.localeCompare(right.nome, 'pt-BR'))
      })
      setEditorOpen(false)
      setEditingEmail('')
      setDraft(emptyDraft())
      setNotice('Usuário salvo com sucesso.')
    } catch (requestError) {
      setEditorError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar o usuário.')
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
      setUsers((current) => current.map((item) => (item.email === saved.email ? saved : item)))
      closeResetPassword()
      setNotice('Senha redefinida com sucesso. Nenhuma senha em texto puro foi armazenada.')
    } catch (requestError) {
      setResetError(requestError instanceof Error ? requestError.message : 'Não foi possível redefinir a senha.')
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

  const operationOptions = draft.perfil === 'OPERACIONAL'
    ? operations.map((value) => ({ label: value, value }))
    : [{ label: 'Todas as operações', value: 'TODOS' }, ...operations.map((value) => ({ label: value, value }))]

  const userBody = (user: ManagedUser) => (
    <div className="nx-user-cell">
      <strong>{user.nome}</strong>
      <small>{user.email}</small>
    </div>
  )

  const profileBody = (user: ManagedUser) => <Tag value={profileLabel(user.perfil)} severity="secondary" rounded />
  const statusBody = (user: ManagedUser) => <Tag value={user.ativo ? 'Ativo' : 'Inativo'} severity={user.ativo ? 'success' : 'secondary'} rounded />
  const passwordBody = (user: ManagedUser) => <Tag value={user.senhaConfigurada ? 'Configurada' : 'Pendente'} severity={user.senhaConfigurada ? 'success' : 'warning'} rounded />
  const actionBody = (user: ManagedUser) => (
    <Button label="Editar" icon="pi pi-pencil" size="small" outlined onClick={() => editUser(user)} />
  )

  return (
    <section className="admin-page catalog-page nx-modern-page">
      <PageHeader
        eyebrow="ADMINISTRAÇÃO"
        title="Usuários"
        description="Perfis, escopo operacional, ativação e credenciais da plataforma. Disponível somente para OWNER."
      />

      {(notice || loadError) && (
        <div className={`nx-prime-notice ${notice ? 'is-success' : 'is-error'}`} role={loadError ? 'alert' : 'status'}>
          <i className={notice ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'} />
          <span>{notice || loadError}</span>
          <Button text rounded icon="pi pi-times" aria-label="Fechar notificação" onClick={() => { setNotice(''); setLoadError('') }} />
        </div>
      )}

      <SummaryMetrics items={summary} ariaLabel="Resumo dos usuários da plataforma" />

      <Panel className="catalog-provider-list nx-prime-data-panel">
        <PanelHeader
          eyebrow="ACESSOS"
          title="Usuários cadastrados"
          description="Administre perfis e escopos sem expor hash, salt ou senha."
          trailing={<Button label="Novo usuário" icon="pi pi-user-plus" onClick={newUser} className="nx-primary-button" />}
        />

        <div className="nx-table-toolbar">
          <div className="nx-table-search">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Buscar nome, e-mail, perfil ou operação…"
              ariaLabel="Buscar usuários"
            />
          </div>
          <span className="nx-table-count">{filtered.length} de {users.length} usuário(s)</span>
        </div>

        {loading ? (
          <Skeleton lines={7} />
        ) : filtered.length === 0 ? (
          <EmptyState title="Nenhum usuário encontrado" description="Cadastre um usuário ou ajuste a pesquisa." />
        ) : (
          <DataTable
            value={filtered}
            dataKey="email"
            stripedRows
            rowHover
            paginator={filtered.length > 10}
            rows={10}
            rowsPerPageOptions={[10, 20, 50]}
            responsiveLayout="scroll"
            className="nx-prime-table"
            emptyMessage="Nenhum usuário encontrado"
          >
            <Column header="Usuário" body={userBody} sortable sortField="nome" />
            <Column header="Perfil" body={profileBody} sortable sortField="perfil" />
            <Column field="operacao" header="Operação" sortable />
            <Column header="Status" body={statusBody} />
            <Column header="Senha" body={passwordBody} />
            <Column field="ultimaAlteracao" header="Último ajuste" body={(user: ManagedUser) => formatDate(user.ultimaAlteracao)} sortable />
            <Column header="Ação" body={actionBody} style={{ width: '8rem' }} />
          </DataTable>
        )}
      </Panel>

      <Modal
        open={editorOpen}
        titleId="user-editor-title"
        eyebrow={isNew ? 'NOVO ACESSO' : 'EDIÇÃO DE ACESSO'}
        title={isNew ? 'Cadastrar usuário' : draft.nome || draft.email}
        description={isNew ? 'Defina perfil, escopo e senha inicial. A senha será protegida antes de ser gravada.' : `Último ajuste: ${formatDate(editingUser?.ultimaAlteracao || '')}`}
        headerAside={!isNew && editingUser ? <Tag value={editingUser.ativo ? 'Ativo' : 'Inativo'} severity={editingUser.ativo ? 'success' : 'secondary'} rounded /> : undefined}
        onClose={closeEditor}
        busy={saving}
        width="medium"
        bodyClassName="catalog-editor-modal-body"
        footer={
          <>
            {!isNew && <Button label="Redefinir senha" icon="pi pi-key" outlined onClick={openResetPassword} disabled={saving} />}
            <Button label="Cancelar" text onClick={closeEditor} disabled={saving} />
            <Button
              label={saving ? 'Salvando…' : isNew ? 'Cadastrar usuário' : 'Salvar alterações'}
              icon={saving ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
              onClick={() => void handleSave()}
              disabled={saveDisabled}
              className="nx-primary-button"
            />
          </>
        }
      >
        <div className="nx-form-stack">
          {editorError && <div className="nx-inline-error"><i className="pi pi-exclamation-circle" /><span>{editorError}</span></div>}

          <div className="nx-form-grid">
            <label className="nx-field">
              <span>Nome</span>
              <InputText value={draft.nome} onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value }))} autoComplete="name" />
            </label>

            <label className="nx-field">
              <span>E-mail</span>
              <InputText type="email" value={draft.email} disabled={!isNew} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} autoComplete="email" />
              {!isNew && <small>O e-mail identifica a conta e não é alterado na edição.</small>}
            </label>

            <label className="nx-field">
              <span>Perfil</span>
              <Dropdown value={draft.perfil} options={profileOptions} onChange={(event) => updateProfile(event.value as UserProfile)} className="w-full" />
            </label>

            <label className="nx-field">
              <span>Operação</span>
              <Dropdown
                value={draft.perfil === 'OWNER' ? 'TODOS' : draft.operacao}
                options={operationOptions}
                disabled={draft.perfil === 'OWNER'}
                placeholder="Selecione a operação"
                onChange={(event) => setDraft((current) => ({ ...current, operacao: event.value }))}
                filter={operations.length > 8}
                className="w-full"
              />
              <small>{draft.perfil === 'OWNER' ? 'Owner possui escopo global.' : draft.perfil === 'OPERACIONAL' ? 'Operacional deve ficar vinculado a uma operação específica.' : 'Administrativo pode atuar em todas ou em uma operação específica.'}</small>
            </label>

            {isNew && (
              <label className="nx-field">
                <span>Senha inicial</span>
                <Password value={draft.password} onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))} feedback={false} toggleMask inputClassName="w-full" className="w-full" autoComplete="new-password" />
                <small>Mínimo de 8 caracteres. O texto puro não é armazenado.</small>
              </label>
            )}

            <label className="nx-field nx-switch-field">
              <span>Status</span>
              <div className="nx-switch-row">
                <InputSwitch checked={draft.ativo} onChange={(event) => setDraft((current) => ({ ...current, ativo: Boolean(event.value) }))} />
                <strong>{draft.ativo ? 'Ativo' : 'Inativo'}</strong>
              </div>
            </label>
          </div>

          {!isNew && (
            <div className="nx-info-callout">
              <i className="pi pi-info-circle" />
              <p>Alterações de perfil, operação ou status passam a valer integralmente em uma nova autenticação ou após a expiração da sessão atual.</p>
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
        footer={
          <>
            <Button label="Cancelar" text onClick={closeResetPassword} disabled={saving} />
            <Button label={saving ? 'Salvando…' : 'Redefinir senha'} icon={saving ? 'pi pi-spin pi-spinner' : 'pi pi-key'} onClick={() => void handleResetPassword()} disabled={saving || resetPassword.length < 8 || !resetConfirmation} className="nx-primary-button" />
          </>
        }
      >
        <div className="nx-form-stack">
          {resetError && <div className="nx-inline-error"><i className="pi pi-exclamation-circle" /><span>{resetError}</span></div>}
          <label className="nx-field">
            <span>Nova senha</span>
            <Password value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} feedback={false} toggleMask inputClassName="w-full" className="w-full" autoComplete="new-password" />
            <small>Mínimo de 8 caracteres.</small>
          </label>
          <label className="nx-field">
            <span>Confirmar nova senha</span>
            <Password value={resetConfirmation} onChange={(event) => setResetConfirmation(event.target.value)} feedback={false} toggleMask inputClassName="w-full" className="w-full" autoComplete="new-password" />
          </label>
        </div>
      </Modal>
    </section>
  )
}
