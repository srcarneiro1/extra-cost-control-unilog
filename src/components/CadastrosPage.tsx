import { useEffect, useMemo, useState } from 'react'
import { CadastrosPagePaginated } from './CadastrosPagePaginated'
import { PageHeader } from './PageHeader'
import { Modal } from './ui/Modal'
import { Badge, EmptyState, Panel, PanelHeader, SearchField, Skeleton } from './ui/Primitives'
import {
  fetchCatalogoAdminScope,
  saveOperacaoAdmin,
  saveSupervisorAdmin,
} from '../services/catalogService'
import type { CatalogoAdminNomeDto } from '../types/catalog'

type CatalogSection = 'OPERACOES' | 'SUPERVISORES' | 'DEMAIS'

type NamedDraft = {
  nome: string
  ativo: boolean
}

const emptyDraft = (): NamedDraft => ({ nome: '', ativo: true })

export function CadastrosPage() {
  const [section, setSection] = useState<CatalogSection>('OPERACOES')
  const [operations, setOperations] = useState<CatalogoAdminNomeDto[]>([])
  const [supervisors, setSupervisors] = useState<CatalogoAdminNomeDto[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingExisting, setEditingExisting] = useState(false)
  const [draft, setDraft] = useState<NamedDraft>(emptyDraft)

  useEffect(() => {
    const controller = new AbortController()

    void Promise.all([
      fetchCatalogoAdminScope('OPERACOES', controller.signal),
      fetchCatalogoAdminScope('SUPERVISORES', controller.signal),
    ])
      .then(([operationData, supervisorData]) => {
        setOperations(operationData.operacoes || [])
        setSupervisors(supervisorData.supervisores || [])
      })
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === 'AbortError') return
        setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar operações e supervisores.')
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [])

  const currentRows = section === 'OPERACOES' ? operations : supervisors
  const filteredRows = useMemo(() => {
    const normalized = search.trim().toUpperCase()
    if (!normalized) return currentRows
    return currentRows.filter((item) => item.nome.toUpperCase().includes(normalized))
  }, [currentRows, search])

  function changeSection(next: CatalogSection) {
    setSection(next)
    setSearch('')
    setNotice('')
    setError('')
  }

  function openNew() {
    setDraft(emptyDraft())
    setEditingExisting(false)
    setError('')
    setEditorOpen(true)
  }

  function openEdit(item: CatalogoAdminNomeDto) {
    setDraft({ nome: item.nome, ativo: item.ativo })
    setEditingExisting(true)
    setError('')
    setEditorOpen(true)
  }

  async function reloadCurrent() {
    if (section === 'DEMAIS') return
    const data = await fetchCatalogoAdminScope(section)
    if (section === 'OPERACOES') setOperations(data.operacoes || [])
    if (section === 'SUPERVISORES') setSupervisors(data.supervisores || [])
  }

  async function handleSave() {
    if (section === 'DEMAIS') return

    if (!draft.nome.trim()) {
      setError(`Informe ${section === 'OPERACOES' ? 'a operação' : 'o supervisor'}.`)
      return
    }

    setSaving(true)
    setError('')

    try {
      if (section === 'OPERACOES') {
        await saveOperacaoAdmin({ nome: draft.nome, ativo: draft.ativo })
      } else {
        await saveSupervisorAdmin({ nome: draft.nome, ativo: draft.ativo })
      }

      setEditorOpen(false)
      await reloadCurrent()
      const entity = section === 'OPERACOES' ? 'Operação' : 'Supervisor'
      setNotice(editingExisting ? `${entity} atualizado com sucesso.` : `${entity} cadastrado com sucesso.`)
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o cadastro.')
    } finally {
      setSaving(false)
    }
  }

  if (section === 'DEMAIS') {
    return (
      <div className="catalog-page">
        <div className="catalog-section-tabs" role="tablist" aria-label="Tipos de cadastro principais">
          <button type="button" role="tab" aria-selected={false} onClick={() => changeSection('OPERACOES')}>Operações</button>
          <button type="button" role="tab" aria-selected={false} onClick={() => changeSection('SUPERVISORES')}>Supervisores</button>
          <button type="button" role="tab" aria-selected className="is-active">Fornecedores, produtos e preços</button>
        </div>
        <CadastrosPagePaginated />
      </div>
    )
  }

  const singular = section === 'OPERACOES' ? 'Operação' : 'Supervisor'
  const plural = section === 'OPERACOES' ? 'Operações' : 'Supervisores'
  const icon = section === 'OPERACOES' ? 'warehouse' : 'badge'

  return (
    <div className="catalog-page">
      <PageHeader
        eyebrow="ADMINISTRAÇÃO"
        title="Cadastros"
        description="Mantenha operações e supervisores com controle de status, preservando o histórico das solicitações existentes."
        actions={(
          <button className="button button-primary" type="button" onClick={openNew}>
            <span className="material-symbols-rounded" aria-hidden="true">add</span>
            Novo {singular.toLowerCase()}
          </button>
        )}
      />

      {notice && <div className="admin-alert admin-alert-success catalog-notice">{notice}</div>}
      {error && !editorOpen && <div className="admin-alert catalog-notice" role="alert">{error}</div>}

      <div className="catalog-section-tabs" role="tablist" aria-label="Tipos de cadastro principais">
        <button type="button" role="tab" aria-selected={section === 'OPERACOES'} className={section === 'OPERACOES' ? 'is-active' : ''} onClick={() => changeSection('OPERACOES')}>Operações</button>
        <button type="button" role="tab" aria-selected={section === 'SUPERVISORES'} className={section === 'SUPERVISORES' ? 'is-active' : ''} onClick={() => changeSection('SUPERVISORES')}>Supervisores</button>
        <button type="button" role="tab" aria-selected={false} onClick={() => changeSection('DEMAIS')}>Fornecedores, produtos e preços</button>
      </div>

      <Panel className="catalog-provider-list">
        <PanelHeader
          eyebrow={plural.toUpperCase()}
          title={`Cadastro de ${plural.toLowerCase()}`}
          description="Inative registros em vez de excluir. Itens inativos deixam de ser oferecidos em novos lançamentos e podem ser reativados a qualquer momento."
        />

        <div className="catalog-list-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder={`Buscar ${plural.toLowerCase()}…`}
            ariaLabel={`Buscar ${plural.toLowerCase()}`}
          />
        </div>

        {loading ? (
          <Skeleton lines={7} />
        ) : filteredRows.length ? (
          <div className="table-wrap embedded">
            <table className="responsive-data-table catalog-table">
              <thead>
                <tr>
                  <th>{singular}</th>
                  <th>Status</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((item) => (
                  <tr key={item.nome}>
                    <td data-label={singular} data-primary="true"><strong>{item.nome}</strong></td>
                    <td data-label="Status"><Badge tone={item.ativo ? 'success' : 'neutral'}>{item.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
                    <td data-label="Ação"><button className="button catalog-edit-button" type="button" onClick={() => openEdit(item)}>{item.ativo ? 'Editar' : 'Reativar'}</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={`Nenhum ${singular.toLowerCase()} encontrado`}
            description={`Ajuste a busca ou cadastre um novo ${singular.toLowerCase()}.`}
            icon={icon}
          />
        )}
      </Panel>

      <Modal
        open={editorOpen}
        titleId="named-catalog-editor-title"
        eyebrow={editingExisting ? `EDIÇÃO DE ${singular.toUpperCase()}` : `NOVO ${singular.toUpperCase()}`}
        title={editingExisting ? draft.nome || `Editar ${singular.toLowerCase()}` : `Cadastrar ${singular.toLowerCase()}`}
        description="O status controla a disponibilidade do registro sem apagar o histórico já existente."
        onClose={() => !saving && setEditorOpen(false)}
        busy={saving}
        width="medium"
        footer={(
          <>
            <button className="button" type="button" onClick={() => setEditorOpen(false)} disabled={saving}>Cancelar</button>
            <button className="button button-primary" type="button" onClick={() => void handleSave()} disabled={saving}>{saving ? 'Salvando…' : editingExisting ? 'Salvar alterações' : 'Cadastrar'}</button>
          </>
        )}
      >
        <div className="catalog-editor-form">
          {error && <div className="admin-alert catalog-editor-error" role="alert">{error}</div>}
          <div className="catalog-form-grid">
            <label>
              {singular}
              <input
                value={draft.nome}
                disabled={editingExisting}
                onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value }))}
              />
            </label>
            <label>
              Status
              <select
                value={draft.ativo ? 'ATIVO' : 'INATIVO'}
                onChange={(event) => setDraft((current) => ({ ...current, ativo: event.target.value === 'ATIVO' }))}
              >
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
              </select>
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}
