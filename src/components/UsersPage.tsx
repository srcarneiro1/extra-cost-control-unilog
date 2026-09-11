import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from './PageHeader'
import { Badge, EmptyState, Panel, PanelHeader, SearchField, Skeleton } from './ui/Primitives'
import { fetchCatalogoAdminScope } from '../services/catalogService'
import { fetchUsers, resetUserPassword, saveUser, type ManagedUser, type UserProfile } from '../services/userService'

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

export function UsersPage() {
  const [users, setUsers] = useState<ManagedUser[]>([])
  const [operations, setOperations] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<Draft>(emptyDraft)
  const [editingEmail, setEditingEmail] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const [loadedUsers, catalog] = await Promise.all([
        fetchUsers(),
        fetchCatalogoAdminScope('OPERACOES'),
      ])
      setUsers(loadedUsers)
      setOperations((catalog.operacoes || []).filter((item) => item.ativo).map((item) => item.nome))
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível carregar usuários.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void load() }, [])

  const filtered = useMemo(() => {
    const query = search.trim().toUpperCase()
    if (!query) return users
    return users.filter((user) => `${user.nome} ${user.email} ${user.perfil} ${user.operacao}`.toUpperCase().includes(query))
  }, [search, users])

  function newUser() {
    setEditingEmail('')
    setDraft(emptyDraft())
    setNotice('')
    setError('')
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
    setNotice('')
    setError('')
  }

  function updateProfile(profile: UserProfile) {
    setDraft((current) => ({
      ...current,
      perfil: profile,
      operacao: profile === 'OWNER' ? 'TODOS' : profile === 'OPERACIONAL' && current.operacao === 'TODOS' ? '' : current.operacao,
    }))
  }

  async function handleSave() {
    setSaving(true)
    setError('')
    setNotice('')
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
        return exists ? current.map((item) => item.email === saved.email ? saved : item) : [...current, saved]
      })
      setEditingEmail(saved.email)
      setDraft((current) => ({ ...current, email: saved.email, password: '' }))
      setNotice('Usuário salvo com sucesso.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível salvar o usuário.')
    } finally {
      setSaving(false)
    }
  }

  async function handleResetPassword() {
    if (!editingEmail) return
    const password = window.prompt('Digite a nova senha. Mínimo de 8 caracteres.')
    if (password == null) return
    if (password.length < 8) {
      setError('A senha deve possuir pelo menos 8 caracteres.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const saved = await resetUserPassword(editingEmail, password)
      setUsers((current) => current.map((item) => item.email === saved.email ? saved : item))
      setNotice('Senha redefinida com sucesso. Nenhuma senha em texto puro foi armazenada.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível redefinir a senha.')
    } finally {
      setSaving(false)
    }
  }

  const isNew = !editingEmail

  return (
    <section className="admin-page">
      <PageHeader
        eyebrow="ADMINISTRAÇÃO"
        title="Usuários"
        description="Perfis, escopo operacional, ativação e credenciais da plataforma. Disponível somente para OWNER."
      />

      {(notice || error) && (
        <div className={`admin-alert ${notice ? 'admin-alert-success' : ''}`.trim()} role={error ? 'alert' : 'status'}>
          <span className="material-symbols-rounded" aria-hidden="true">{notice ? 'check_circle' : 'error'}</span>
          <span>{notice || error}</span>
        </div>
      )}

      <div className="admin-two-column">
        <Panel>
          <PanelHeader
            eyebrow="ACESSOS"
            title="Usuários cadastrados"
            description="A lista nunca expõe hash, salt ou senha."
            trailing={<button type="button" className="button button-primary" onClick={newUser}><span className="material-symbols-rounded" aria-hidden="true">person_add</span>Novo usuário</button>}
          />
          <SearchField ariaLabel="Pesquisar usuários" placeholder="Nome, e-mail, perfil ou operação" value={search} onChange={setSearch} />

          {loading ? <Skeleton lines={6} /> : filtered.length === 0 ? (
            <EmptyState title="Nenhum usuário encontrado" description="Cadastre um usuário ou ajuste a pesquisa." />
          ) : (
            <div className="table-wrap embedded">
              <table className="responsive-data-table">
                <thead><tr><th>Usuário</th><th>Perfil</th><th>Operação</th><th>Status</th><th>Senha</th><th>Ação</th></tr></thead>
                <tbody>
                  {filtered.map((user) => (
                    <tr key={user.email}>
                      <td data-label="Usuário"><div className="table-primary"><strong>{user.nome}</strong><small>{user.email}</small></div></td>
                      <td data-label="Perfil"><strong>{user.perfil}</strong></td>
                      <td data-label="Operação"><strong>{user.operacao || '—'}</strong></td>
                      <td data-label="Status"><Badge tone={user.ativo ? 'success' : 'neutral'}>{user.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
                      <td data-label="Senha"><Badge tone={user.senhaConfigurada ? 'success' : 'warning'}>{user.senhaConfigurada ? 'Configurada' : 'Pendente'}</Badge></td>
                      <td data-label="Ação"><button type="button" className="button button-compact" onClick={() => editUser(user)}>Editar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel>
          <PanelHeader eyebrow={isNew ? 'NOVO ACESSO' : 'EDIÇÃO'} title={isNew ? 'Cadastrar usuário' : draft.nome || draft.email} description={isNew ? 'A senha inicial é obrigatória e será convertida em hash imediatamente.' : `Último ajuste: ${formatDate(users.find((item) => item.email === editingEmail)?.ultimaAlteracao || '')}`} />

          <div className="admin-form-grid">
            <label><span>Nome</span><input value={draft.nome} onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value }))} /></label>
            <label><span>E-mail</span><input type="email" value={draft.email} disabled={!isNew} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} /></label>
            <label><span>Perfil</span><select value={draft.perfil} onChange={(event) => updateProfile(event.target.value as UserProfile)}><option value="OWNER">OWNER</option><option value="ADMINISTRATIVO">ADMINISTRATIVO</option><option value="OPERACIONAL">OPERACIONAL</option></select></label>
            <label><span>Operação</span><select value={draft.perfil === 'OWNER' ? 'TODOS' : draft.operacao} disabled={draft.perfil === 'OWNER'} onChange={(event) => setDraft((current) => ({ ...current, operacao: event.target.value }))}><option value="">Selecione</option>{draft.perfil === 'ADMINISTRATIVO' && <option value="TODOS">TODOS</option>}{operations.map((operation) => <option key={operation} value={operation}>{operation}</option>)}</select></label>
            {isNew && <label><span>Senha inicial</span><input type="password" value={draft.password} onChange={(event) => setDraft((current) => ({ ...current, password: event.target.value }))} minLength={8} /></label>}
            <label><span>Status</span><select value={draft.ativo ? 'SIM' : 'NAO'} onChange={(event) => setDraft((current) => ({ ...current, ativo: event.target.value === 'SIM' }))}><option value="SIM">Ativo</option><option value="NAO">Inativo</option></select></label>
          </div>

          <div className="modal-actions">
            {!isNew && <button type="button" className="button" onClick={() => void handleResetPassword()} disabled={saving}>Redefinir senha</button>}
            <button type="button" className="button button-primary" onClick={() => void handleSave()} disabled={saving || !draft.nome.trim() || !draft.email.trim() || (isNew && draft.password.length < 8) || (draft.perfil === 'OPERACIONAL' && !draft.operacao)}>{saving ? 'Salvando…' : 'Salvar usuário'}</button>
          </div>
        </Panel>
      </div>
    </section>
  )
}
