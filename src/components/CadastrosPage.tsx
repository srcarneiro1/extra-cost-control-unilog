import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from './PageHeader'
import { Badge, EmptyState, Panel, PanelHeader, SearchField, Skeleton, SummaryMetrics } from './ui/Primitives'
import {
  fetchCatalogos,
  fetchCatalogosAdmin,
  saveFornecedorAdmin,
} from '../services/catalogService'
import type {
  CatalogosAdminDto,
  CatalogosDto,
  FornecedorAdminDto,
  WhatsappDestino,
} from '../types/catalog'

type ProviderDraft = {
  nome: string
  maoDeObra: boolean
  alimentacao: boolean
  ativo: boolean
  whatsappDestino: WhatsappDestino
  whatsappNumero: string
  whatsappGrupoLink: string
}

const emptyDraft = (): ProviderDraft => ({
  nome: '',
  maoDeObra: true,
  alimentacao: false,
  ativo: true,
  whatsappDestino: 'NENHUM',
  whatsappNumero: '',
  whatsappGrupoLink: '',
})

function destinationLabel(item: FornecedorAdminDto) {
  if (item.whatsappDestino === 'NUMERO' && item.whatsappNumero) {
    return `Número · ${item.whatsappNumero}`
  }
  if (item.whatsappDestino === 'GRUPO' && item.whatsappGrupoLink) {
    return 'Grupo · link configurado'
  }
  return 'Não configurado'
}

export function CadastrosPage() {
  const [catalogs, setCatalogs] = useState<CatalogosDto | null>(null)
  const [adminCatalogs, setAdminCatalogs] = useState<CatalogosAdminDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [editingExisting, setEditingExisting] = useState(false)
  const [draft, setDraft] = useState<ProviderDraft>(emptyDraft)

  async function loadCatalogs(signal?: AbortSignal) {
    setLoading(true)
    setError('')
    try {
      const [activeData, adminData] = await Promise.all([
        fetchCatalogos(signal),
        fetchCatalogosAdmin(signal),
      ])
      setCatalogs(activeData)
      setAdminCatalogs(adminData)
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return
      setError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os cadastros.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void loadCatalogs(controller.signal)
    return () => controller.abort()
  }, [])

  const providers = useMemo(() => {
    const normalizedSearch = search.trim().toUpperCase()
    const rows = adminCatalogs?.fornecedores || []
    if (!normalizedSearch) return rows
    return rows.filter((item) =>
      `${item.nome} ${destinationLabel(item)}`.toUpperCase().includes(normalizedSearch),
    )
  }, [adminCatalogs, search])

  const metrics = [
    { key: 'operacoes', label: 'Operações', value: catalogs?.operacoes.length ?? '—', icon: 'warehouse' },
    { key: 'supervisores', label: 'Supervisores', value: catalogs?.supervisores.length ?? '—', icon: 'badge' },
    { key: 'fornecedores', label: 'Fornecedores ativos', value: catalogs?.fornecedores.length ?? '—', icon: 'local_shipping' },
    { key: 'atividades', label: 'Atividades', value: catalogs?.atividades.length ?? '—', icon: 'task_alt' },
    { key: 'funcoes', label: 'Funções', value: catalogs?.funcoes.length ?? '—', icon: 'engineering' },
    { key: 'produtos', label: 'Produtos', value: catalogs?.produtos.length ?? '—', icon: 'inventory_2' },
  ]

  function newProvider() {
    setEditingExisting(false)
    setDraft(emptyDraft())
    setNotice('')
    setError('')
  }

  function editProvider(item: FornecedorAdminDto) {
    setEditingExisting(true)
    setDraft({
      nome: item.nome,
      maoDeObra: item.maoDeObra,
      alimentacao: item.alimentacao,
      ativo: item.ativo,
      whatsappDestino: item.whatsappDestino,
      whatsappNumero: item.whatsappNumero,
      whatsappGrupoLink: item.whatsappGrupoLink,
    })
    setNotice('')
    setError('')
  }

  async function handleSave() {
    if (!draft.nome.trim()) {
      setError('Informe o nome do fornecedor.')
      return
    }
    if (!draft.maoDeObra && !draft.alimentacao) {
      setError('O fornecedor precisa atender mão de obra e/ou alimentação.')
      return
    }
    if (draft.whatsappDestino === 'NUMERO' && !draft.whatsappNumero.trim()) {
      setError('Informe o número do WhatsApp em formato internacional.')
      return
    }
    if (draft.whatsappDestino === 'GRUPO' && !draft.whatsappGrupoLink.trim()) {
      setError('Informe o link de convite do grupo do WhatsApp.')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    try {
      const saved = await saveFornecedorAdmin({
        fornecedor: draft.nome,
        maoDeObra: draft.maoDeObra,
        alimentacao: draft.alimentacao,
        ativo: draft.ativo,
        whatsappDestino: draft.whatsappDestino,
        whatsappNumero: draft.whatsappNumero || undefined,
        whatsappGrupoLink: draft.whatsappGrupoLink || undefined,
      })
      setEditingExisting(true)
      setDraft({
        nome: saved.nome,
        maoDeObra: saved.maoDeObra,
        alimentacao: saved.alimentacao,
        ativo: saved.ativo,
        whatsappDestino: saved.whatsappDestino,
        whatsappNumero: saved.whatsappNumero,
        whatsappGrupoLink: saved.whatsappGrupoLink,
      })
      setNotice('Fornecedor salvo com sucesso.')
      await loadCatalogs()
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o fornecedor.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="catalog-page">
      <PageHeader
        eyebrow="ADMINISTRAÇÃO"
        title="Cadastros"
        description="Mantenha os catálogos operacionais sem apagar histórico. Fornecedores podem ter destino direto de WhatsApp por número ou por grupo."
        actions={(
          <button className="button button-primary" type="button" onClick={newProvider}>
            <span className="material-symbols-rounded" aria-hidden="true">add</span>
            Novo fornecedor
          </button>
        )}
      />

      {notice && <div className="admin-alert admin-alert-success catalog-notice">{notice}</div>}
      {error && <div className="admin-alert catalog-notice" role="alert">{error}</div>}

      <SummaryMetrics items={metrics} ariaLabel="Catálogos ativos" />

      <div className="catalog-admin-layout">
        <Panel className="catalog-provider-list">
          <PanelHeader
            eyebrow="FORNECEDORES"
            title="Fornecedores e contato"
            description="Inative registros em vez de excluir. O nome do fornecedor fica imutável após a criação para preservar referências históricas."
          />
          <div className="catalog-list-toolbar">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Buscar fornecedor ou destino…"
              ariaLabel="Buscar fornecedores"
            />
          </div>

          {loading ? (
            <Skeleton lines={7} />
          ) : providers.length ? (
            <div className="table-wrap embedded">
              <table className="responsive-data-table catalog-table">
                <thead>
                  <tr>
                    <th>Fornecedor</th>
                    <th>Atendimento</th>
                    <th>WhatsApp</th>
                    <th>Status</th>
                    <th>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((item) => (
                    <tr key={item.nome}>
                      <td data-label="Fornecedor" data-primary="true"><strong>{item.nome}</strong></td>
                      <td data-label="Atendimento">
                        <div className="catalog-badge-stack">
                          {item.maoDeObra && <Badge>Mão de obra</Badge>}
                          {item.alimentacao && <Badge>Alimentação</Badge>}
                        </div>
                      </td>
                      <td data-label="WhatsApp"><span>{destinationLabel(item)}</span></td>
                      <td data-label="Status">
                        <Badge tone={item.ativo ? 'success' : 'neutral'}>{item.ativo ? 'Ativo' : 'Inativo'}</Badge>
                      </td>
                      <td data-label="Ação">
                        <button className="button catalog-edit-button" type="button" onClick={() => editProvider(item)}>
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Nenhum fornecedor encontrado" description="Ajuste a busca ou cadastre um novo fornecedor." icon="local_shipping" />
          )}
        </Panel>

        <Panel className="catalog-editor-panel">
          <PanelHeader
            eyebrow={editingExisting ? 'EDIÇÃO' : 'NOVO REGISTRO'}
            title={editingExisting ? draft.nome || 'Fornecedor' : 'Cadastrar fornecedor'}
            description="Configure elegibilidade e o destino usado pelo botão de WhatsApp nas solicitações."
          />

          <div className="catalog-editor-form">
            <label>
              Fornecedor
              <input
                value={draft.nome}
                disabled={editingExisting}
                onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value.toUpperCase() }))}
                placeholder="Ex.: MULT"
              />
              {editingExisting && <small>Para trocar o nome, crie um novo fornecedor e inative o anterior.</small>}
            </label>

            <fieldset className="catalog-fieldset">
              <legend>Atende</legend>
              <label className="catalog-check">
                <input type="checkbox" checked={draft.maoDeObra} onChange={(event) => setDraft((current) => ({ ...current, maoDeObra: event.target.checked }))} />
                <span>Mão de obra</span>
              </label>
              <label className="catalog-check">
                <input type="checkbox" checked={draft.alimentacao} onChange={(event) => setDraft((current) => ({ ...current, alimentacao: event.target.checked }))} />
                <span>Alimentação / bebida</span>
              </label>
            </fieldset>

            <label>
              Destino do WhatsApp
              <select
                value={draft.whatsappDestino}
                onChange={(event) => setDraft((current) => ({ ...current, whatsappDestino: event.target.value as WhatsappDestino }))}
              >
                <option value="NENHUM">Não configurado</option>
                <option value="NUMERO">Número individual</option>
                <option value="GRUPO">Grupo do WhatsApp</option>
              </select>
            </label>

            {draft.whatsappDestino === 'NUMERO' && (
              <label>
                Número do WhatsApp
                <input
                  inputMode="tel"
                  value={draft.whatsappNumero}
                  onChange={(event) => setDraft((current) => ({ ...current, whatsappNumero: event.target.value }))}
                  placeholder="Ex.: 5527999999999"
                />
                <small>Use formato internacional completo. O sistema abrirá a conversa exata com a mensagem preenchida.</small>
              </label>
            )}

            {draft.whatsappDestino === 'GRUPO' && (
              <label>
                Link de convite do grupo
                <input
                  type="url"
                  value={draft.whatsappGrupoLink}
                  onChange={(event) => setDraft((current) => ({ ...current, whatsappGrupoLink: event.target.value }))}
                  placeholder="https://chat.whatsapp.com/..."
                />
                <small>Para grupos, o sistema copia a mensagem e abre o link do grupo; o WhatsApp não oferece mensagem pré-preenchida oficial para grupos.</small>
              </label>
            )}

            <label>
              Status
              <select value={draft.ativo ? 'ATIVO' : 'INATIVO'} onChange={(event) => setDraft((current) => ({ ...current, ativo: event.target.value === 'ATIVO' }))}>
                <option value="ATIVO">Ativo</option>
                <option value="INATIVO">Inativo</option>
              </select>
            </label>

            <div className="catalog-editor-actions">
              <button className="button" type="button" onClick={newProvider} disabled={saving}>Limpar</button>
              <button className="button button-primary" type="button" onClick={() => void handleSave()} disabled={saving}>
                {saving ? 'Salvando…' : 'Salvar fornecedor'}
              </button>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  )
}
