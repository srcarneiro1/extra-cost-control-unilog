import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from './PageHeader'
import { Modal } from './ui/Modal'
import { Badge, EmptyState, Panel, PanelHeader, SearchField, Skeleton, SummaryMetrics } from './ui/Primitives'
import {
  fetchCatalogos,
  fetchCatalogosAdmin,
  saveFornecedorAdmin,
  saveProdutoAdmin,
  savePrecoMaoObraAdmin,
  savePrecoProdutoAdmin,
} from '../services/catalogService'
import type {
  CatalogosAdminDto,
  CatalogosDto,
  CategoriaProduto,
  FornecedorAdminDto,
  PrecoMaoObraAdminDto,
  PrecoProdutoAdminDto,
  ProdutoAdminDto,
  TipoDia,
  WhatsappDestino,
} from '../types/catalog'

type CatalogSection = 'FORNECEDORES' | 'PRODUTOS' | 'PRECOS_MO' | 'PRECOS_PRODUTOS'

type ProviderDraft = {
  nome: string
  maoDeObra: boolean
  alimentacao: boolean
  ativo: boolean
  whatsappDestino: WhatsappDestino
  whatsappNumero: string
  whatsappGrupoLink: string
}

type ProductDraft = {
  nome: string
  categoria: CategoriaProduto
  ativo: boolean
}

type LaborPriceDraft = {
  fornecedor: string
  funcao: string
  turno: 'DIURNO' | 'NOTURNO'
  tipoDia: TipoDia
  vigenciaInicio: string
  precoUnitario: string
}

type ProductPriceDraft = {
  fornecedor: string
  produto: string
  vigenciaInicio: string
  precoUnitario: string
}

const emptyProviderDraft = (): ProviderDraft => ({
  nome: '',
  maoDeObra: true,
  alimentacao: false,
  ativo: true,
  whatsappDestino: 'NENHUM',
  whatsappNumero: '',
  whatsappGrupoLink: '',
})

const emptyProductDraft = (): ProductDraft => ({
  nome: '',
  categoria: 'ALIMENTACAO',
  ativo: true,
})

const emptyLaborPriceDraft = (): LaborPriceDraft => ({
  fornecedor: '',
  funcao: '',
  turno: 'DIURNO',
  tipoDia: 'UTIL',
  vigenciaInicio: '',
  precoUnitario: '',
})

const emptyProductPriceDraft = (): ProductPriceDraft => ({
  fornecedor: '',
  produto: '',
  vigenciaInicio: '',
  precoUnitario: '',
})

function destinationLabel(item: FornecedorAdminDto) {
  if (item.whatsappDestino === 'NUMERO' && item.whatsappNumero) return `Número · ${item.whatsappNumero}`
  if (item.whatsappDestino === 'GRUPO' && item.whatsappGrupoLink) return 'Grupo · link configurado'
  return 'Não configurado'
}

function money(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0)
}

function dateLabel(value: string) {
  if (!value) return 'Em aberto'
  const [year, month, day] = value.split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function dayTypeLabel(value: TipoDia) {
  if (value === 'SABADO') return 'Sábado'
  if (value === 'DOMINGO_FERIADO') return 'Domingo / feriado'
  return 'Dia útil'
}

function categoryLabel(value: CategoriaProduto) {
  return value === 'BEBIDA' ? 'Bebida' : 'Alimentação'
}

function priceStatus(item: { ativo: boolean; vigenciaFim: string }) {
  if (!item.ativo) return { label: 'Inativo', tone: 'neutral' as const }
  if (item.vigenciaFim) return { label: 'Histórico', tone: 'neutral' as const }
  return { label: 'Vigente', tone: 'success' as const }
}

export function CadastrosPage() {
  const [catalogs, setCatalogs] = useState<CatalogosDto | null>(null)
  const [adminCatalogs, setAdminCatalogs] = useState<CatalogosAdminDto | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [editorError, setEditorError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [section, setSection] = useState<CatalogSection>('FORNECEDORES')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingExisting, setEditingExisting] = useState(false)
  const [reactivatingPrice, setReactivatingPrice] = useState(false)
  const [providerDraft, setProviderDraft] = useState<ProviderDraft>(emptyProviderDraft)
  const [catalogProductDraft, setCatalogProductDraft] = useState<ProductDraft>(emptyProductDraft)
  const [laborDraft, setLaborDraft] = useState<LaborPriceDraft>(emptyLaborPriceDraft)
  const [productPriceDraft, setProductPriceDraft] = useState<ProductPriceDraft>(emptyProductPriceDraft)

  async function loadCatalogs(signal?: AbortSignal) {
    setLoading(true)
    setLoadError('')
    try {
      const [activeData, adminData] = await Promise.all([
        fetchCatalogos(signal),
        fetchCatalogosAdmin(signal),
      ])
      setCatalogs(activeData)
      setAdminCatalogs(adminData)
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === 'AbortError') return
      setLoadError(loadError instanceof Error ? loadError.message : 'Não foi possível carregar os cadastros.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void loadCatalogs(controller.signal)
    return () => controller.abort()
  }, [])

  const normalizedSearch = search.trim().toUpperCase()

  const providers = useMemo(() => {
    const rows = adminCatalogs?.fornecedores || []
    if (!normalizedSearch) return rows
    return rows.filter((item) => `${item.nome} ${destinationLabel(item)}`.toUpperCase().includes(normalizedSearch))
  }, [adminCatalogs, normalizedSearch])

  const products = useMemo(() => {
    const rows = adminCatalogs?.produtos || []
    if (!normalizedSearch) return rows
    return rows.filter((item) => `${item.nome} ${item.categoria}`.toUpperCase().includes(normalizedSearch))
  }, [adminCatalogs, normalizedSearch])

  const laborPrices = useMemo(() => {
    const rows = adminCatalogs?.precosMaoObra || []
    if (!normalizedSearch) return rows
    return rows.filter((item) =>
      `${item.fornecedor} ${item.funcao} ${item.turno} ${item.tipoDia}`.toUpperCase().includes(normalizedSearch),
    )
  }, [adminCatalogs, normalizedSearch])

  const productPrices = useMemo(() => {
    const rows = adminCatalogs?.precosProdutos || []
    if (!normalizedSearch) return rows
    return rows.filter((item) =>
      `${item.fornecedor} ${item.produto} ${item.categoria}`.toUpperCase().includes(normalizedSearch),
    )
  }, [adminCatalogs, normalizedSearch])

  const laborProviders = (adminCatalogs?.fornecedores || []).filter((item) => item.maoDeObra)
  const foodProviders = (adminCatalogs?.fornecedores || []).filter((item) => item.alimentacao)

  const metrics = [
    { key: 'operacoes', label: 'Operações', value: catalogs?.operacoes.length ?? '—', icon: 'warehouse' },
    { key: 'supervisores', label: 'Supervisores', value: catalogs?.supervisores.length ?? '—', icon: 'badge' },
    { key: 'fornecedores', label: 'Fornecedores ativos', value: catalogs?.fornecedores.length ?? '—', icon: 'local_shipping' },
    { key: 'atividades', label: 'Atividades', value: catalogs?.atividades.length ?? '—', icon: 'task_alt' },
    { key: 'funcoes', label: 'Funções', value: catalogs?.funcoes.length ?? '—', icon: 'engineering' },
    { key: 'produtos', label: 'Produtos ativos', value: catalogs?.produtos.length ?? '—', icon: 'inventory_2' },
  ]

  function resetMessages() {
    setNotice('')
    setEditorError('')
    setReactivatingPrice(false)
  }

  function changeSection(nextSection: CatalogSection) {
    setSection(nextSection)
    setSearch('')
    setNotice('')
    setEditorError('')
  }

  function openNew() {
    resetMessages()
    setEditingExisting(false)
    if (section === 'FORNECEDORES') setProviderDraft(emptyProviderDraft())
    if (section === 'PRODUTOS') setCatalogProductDraft(emptyProductDraft())
    if (section === 'PRECOS_MO') setLaborDraft(emptyLaborPriceDraft())
    if (section === 'PRECOS_PRODUTOS') setProductPriceDraft(emptyProductPriceDraft())
    setEditorOpen(true)
  }

  function editProvider(item: FornecedorAdminDto) {
    resetMessages()
    setEditingExisting(true)
    setProviderDraft({
      nome: item.nome,
      maoDeObra: item.maoDeObra,
      alimentacao: item.alimentacao,
      ativo: item.ativo,
      whatsappDestino: item.whatsappDestino,
      whatsappNumero: item.whatsappNumero,
      whatsappGrupoLink: item.whatsappGrupoLink,
    })
    setEditorOpen(true)
  }

  function editProduct(item: ProdutoAdminDto) {
    resetMessages()
    setEditingExisting(true)
    setCatalogProductDraft({
      nome: item.nome,
      categoria: item.categoria,
      ativo: item.ativo,
    })
    setEditorOpen(true)
  }

  function openLaborVersion(item: PrecoMaoObraAdminDto, reactivate = false) {
    resetMessages()
    setReactivatingPrice(reactivate)
    setLaborDraft({
      fornecedor: item.fornecedor,
      funcao: item.funcao,
      turno: item.turno,
      tipoDia: item.tipoDia,
      vigenciaInicio: '',
      precoUnitario: reactivate ? String(item.precoUnitario) : '',
    })
    setEditorOpen(true)
  }

  function openProductPriceVersion(item: PrecoProdutoAdminDto, reactivate = false) {
    resetMessages()
    setReactivatingPrice(reactivate)
    setProductPriceDraft({
      fornecedor: item.fornecedor,
      produto: item.produto,
      vigenciaInicio: '',
      precoUnitario: reactivate ? String(item.precoUnitario) : '',
    })
    setEditorOpen(true)
  }

  function closeEditor() {
    if (saving) return
    setEditorOpen(false)
    setEditorError('')
    setReactivatingPrice(false)
  }

  async function handleSave() {
    setSaving(true)
    setEditorError('')
    setNotice('')

    try {
      if (section === 'FORNECEDORES') {
        if (!providerDraft.nome.trim()) throw new Error('Informe o nome do fornecedor.')
        if (!providerDraft.maoDeObra && !providerDraft.alimentacao) throw new Error('O fornecedor precisa atender mão de obra e/ou alimentação.')
        if (providerDraft.whatsappDestino === 'NUMERO' && !providerDraft.whatsappNumero.trim()) throw new Error('Informe o número do WhatsApp em formato internacional.')
        if (providerDraft.whatsappDestino === 'GRUPO' && !providerDraft.whatsappGrupoLink.trim()) throw new Error('Informe o link de convite do grupo do WhatsApp.')

        await saveFornecedorAdmin({
          fornecedor: providerDraft.nome,
          maoDeObra: providerDraft.maoDeObra,
          alimentacao: providerDraft.alimentacao,
          ativo: providerDraft.ativo,
          whatsappDestino: providerDraft.whatsappDestino,
          whatsappNumero: providerDraft.whatsappNumero || undefined,
          whatsappGrupoLink: providerDraft.whatsappGrupoLink || undefined,
        })
        setNotice(editingExisting ? 'Fornecedor atualizado com sucesso.' : 'Fornecedor cadastrado com sucesso.')
      }

      if (section === 'PRODUTOS') {
        if (!catalogProductDraft.nome.trim()) throw new Error('Informe o nome do produto.')
        await saveProdutoAdmin({
          produto: catalogProductDraft.nome,
          categoria: catalogProductDraft.categoria,
          ativo: catalogProductDraft.ativo,
        })
        setNotice(editingExisting ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.')
      }

      if (section === 'PRECOS_MO') {
        if (!laborDraft.fornecedor || !laborDraft.funcao || !laborDraft.vigenciaInicio || !laborDraft.precoUnitario) {
          throw new Error('Preencha fornecedor, função, vigência e preço.')
        }
        await savePrecoMaoObraAdmin({
          fornecedor: laborDraft.fornecedor,
          funcao: laborDraft.funcao,
          turno: laborDraft.turno,
          tipoDia: laborDraft.tipoDia,
          vigenciaInicio: laborDraft.vigenciaInicio,
          precoUnitario: Number(laborDraft.precoUnitario.replace(',', '.')),
        })
        setNotice(reactivatingPrice
          ? 'Preço reativado por nova vigência. O registro inativo foi preservado no histórico.'
          : 'Nova vigência de mão de obra criada. A versão anterior foi preservada no histórico.')
      }

      if (section === 'PRECOS_PRODUTOS') {
        if (!productPriceDraft.fornecedor || !productPriceDraft.produto || !productPriceDraft.vigenciaInicio || !productPriceDraft.precoUnitario) {
          throw new Error('Preencha fornecedor, produto, vigência e preço.')
        }
        await savePrecoProdutoAdmin({
          fornecedor: productPriceDraft.fornecedor,
          produto: productPriceDraft.produto,
          vigenciaInicio: productPriceDraft.vigenciaInicio,
          precoUnitario: Number(productPriceDraft.precoUnitario.replace(',', '.')),
        })
        setNotice(reactivatingPrice
          ? 'Preço de produto reativado por nova vigência. O registro inativo foi preservado no histórico.'
          : 'Nova vigência de produto criada. A versão anterior foi preservada no histórico.')
      }

      setEditorOpen(false)
      setReactivatingPrice(false)
      await loadCatalogs()
    } catch (saveError) {
      setEditorError(saveError instanceof Error ? saveError.message : 'Não foi possível salvar o cadastro.')
    } finally {
      setSaving(false)
    }
  }

  const pageActionLabel = section === 'FORNECEDORES'
    ? 'Novo fornecedor'
    : section === 'PRODUTOS'
      ? 'Novo produto'
      : section === 'PRECOS_MO'
        ? 'Novo preço de mão de obra'
        : 'Novo preço de produto'

  return (
    <div className="catalog-page">
      <PageHeader
        eyebrow="ADMINISTRAÇÃO"
        title="Cadastros"
        description="Mantenha fornecedores, produtos e tabelas de preço com rastreabilidade. Cadastros podem ser reativados; preços voltam por nova vigência, sem reescrever histórico."
        actions={(
          <button className="button button-primary" type="button" onClick={openNew}>
            <span className="material-symbols-rounded" aria-hidden="true">add</span>
            {pageActionLabel}
          </button>
        )}
      />

      {notice && <div className="admin-alert admin-alert-success catalog-notice">{notice}</div>}
      {loadError && <div className="admin-alert catalog-notice" role="alert">{loadError}</div>}

      <SummaryMetrics items={metrics} ariaLabel="Catálogos ativos" />

      <div className="catalog-section-tabs" role="tablist" aria-label="Tipos de cadastro">
        <button type="button" className={section === 'FORNECEDORES' ? 'is-active' : ''} onClick={() => changeSection('FORNECEDORES')}>Fornecedores</button>
        <button type="button" className={section === 'PRODUTOS' ? 'is-active' : ''} onClick={() => changeSection('PRODUTOS')}>Produtos</button>
        <button type="button" className={section === 'PRECOS_MO' ? 'is-active' : ''} onClick={() => changeSection('PRECOS_MO')}>Preços de mão de obra</button>
        <button type="button" className={section === 'PRECOS_PRODUTOS' ? 'is-active' : ''} onClick={() => changeSection('PRECOS_PRODUTOS')}>Preços de produtos</button>
      </div>

      {section === 'FORNECEDORES' && (
        <Panel className="catalog-provider-list">
          <PanelHeader eyebrow="FORNECEDORES" title="Fornecedores e contato" description="Inative registros em vez de excluir. Um fornecedor inativo pode ser reativado pelo mesmo botão Editar." />
          <CatalogSearch value={search} onChange={setSearch} placeholder="Buscar fornecedor ou destino…" label="Buscar fornecedores" />
          {loading ? <Skeleton lines={7} /> : providers.length ? (
            <div className="table-wrap embedded">
              <table className="responsive-data-table catalog-table">
                <thead><tr><th>Fornecedor</th><th>Atendimento</th><th>WhatsApp</th><th>Status</th><th>Ação</th></tr></thead>
                <tbody>{providers.map((item) => (
                  <tr key={item.nome}>
                    <td data-label="Fornecedor" data-primary="true"><strong>{item.nome}</strong></td>
                    <td data-label="Atendimento"><div className="catalog-badge-stack">{item.maoDeObra && <Badge>Mão de obra</Badge>}{item.alimentacao && <Badge>Alimentação</Badge>}</div></td>
                    <td data-label="WhatsApp">{destinationLabel(item)}</td>
                    <td data-label="Status"><Badge tone={item.ativo ? 'success' : 'neutral'}>{item.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
                    <td data-label="Ação"><button className="button catalog-edit-button" type="button" onClick={() => editProvider(item)}>{item.ativo ? 'Editar' : 'Reativar'}</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EmptyState title="Nenhum fornecedor encontrado" description="Ajuste a busca ou cadastre um novo fornecedor." icon="local_shipping" />}
        </Panel>
      )}

      {section === 'PRODUTOS' && (
        <Panel className="catalog-provider-list">
          <PanelHeader eyebrow="CATÁLOGO" title="Produtos" description="Produtos inativos permanecem no histórico e podem ser reativados. A disponibilidade no Forms ainda depende de fornecedor e preço vigente elegíveis." />
          <CatalogSearch value={search} onChange={setSearch} placeholder="Buscar produto ou categoria…" label="Buscar produtos" />
          {loading ? <Skeleton lines={7} /> : products.length ? (
            <div className="table-wrap embedded">
              <table className="responsive-data-table catalog-table">
                <thead><tr><th>Produto</th><th>Categoria</th><th>Status</th><th>Ação</th></tr></thead>
                <tbody>{products.map((item) => (
                  <tr key={item.nome}>
                    <td data-label="Produto" data-primary="true"><strong>{item.nome}</strong></td>
                    <td data-label="Categoria">{categoryLabel(item.categoria)}</td>
                    <td data-label="Status"><Badge tone={item.ativo ? 'success' : 'neutral'}>{item.ativo ? 'Ativo' : 'Inativo'}</Badge></td>
                    <td data-label="Ação"><button className="button catalog-edit-button" type="button" onClick={() => editProduct(item)}>{item.ativo ? 'Editar' : 'Reativar'}</button></td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EmptyState title="Nenhum produto encontrado" description="Ajuste a busca ou cadastre um novo produto." icon="inventory_2" />}
        </Panel>
      )}

      {section === 'PRECOS_MO' && (
        <Panel className="catalog-provider-list">
          <PanelHeader eyebrow="TABELA VERSIONADA" title="Preços de mão de obra" description="Preço inativo não é religado na mesma linha. Reativar cria nova vigência e preserva o registro anterior exatamente como ficou." />
          <CatalogSearch value={search} onChange={setSearch} placeholder="Buscar fornecedor, função, turno…" label="Buscar preços de mão de obra" />
          {loading ? <Skeleton lines={7} /> : laborPrices.length ? (
            <div className="table-wrap embedded">
              <table className="responsive-data-table catalog-table catalog-price-table">
                <thead><tr><th>Fornecedor</th><th>Função</th><th>Turno</th><th>Tipo de dia</th><th>Vigência</th><th>Preço</th><th>Status</th><th>Ação</th></tr></thead>
                <tbody>{laborPrices.map((item, index) => {
                  const status = priceStatus(item)
                  return (
                    <tr key={`${item.fornecedor}-${item.funcao}-${item.turno}-${item.tipoDia}-${item.vigenciaInicio}-${index}`}>
                      <td data-label="Fornecedor" data-primary="true"><strong>{item.fornecedor}</strong></td>
                      <td data-label="Função">{item.funcao}</td>
                      <td data-label="Turno">{item.turno}</td>
                      <td data-label="Tipo de dia">{dayTypeLabel(item.tipoDia)}</td>
                      <td data-label="Vigência">{dateLabel(item.vigenciaInicio)} → {dateLabel(item.vigenciaFim)}</td>
                      <td data-label="Preço"><strong>{money(item.precoUnitario)}</strong></td>
                      <td data-label="Status"><Badge tone={status.tone}>{status.label}</Badge></td>
                      <td data-label="Ação">
                        {item.ativo && !item.vigenciaFim && <button className="button catalog-edit-button" type="button" onClick={() => openLaborVersion(item)}>Nova vigência</button>}
                        {!item.ativo && <button className="button catalog-edit-button" type="button" onClick={() => openLaborVersion(item, true)}>Reativar</button>}
                      </td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          ) : <EmptyState title="Nenhum preço de mão de obra encontrado" description="Cadastre a primeira vigência para começar o histórico controlado." icon="payments" />}
        </Panel>
      )}

      {section === 'PRECOS_PRODUTOS' && (
        <Panel className="catalog-provider-list">
          <PanelHeader eyebrow="TABELA VERSIONADA" title="Preços de produtos" description="Preços inativos podem voltar por uma nova vigência. O fornecedor e o produto precisam estar ativos no momento da reativação." />
          <CatalogSearch value={search} onChange={setSearch} placeholder="Buscar fornecedor, produto, categoria…" label="Buscar preços de produtos" />
          {loading ? <Skeleton lines={7} /> : productPrices.length ? (
            <div className="table-wrap embedded">
              <table className="responsive-data-table catalog-table catalog-price-table">
                <thead><tr><th>Fornecedor</th><th>Produto</th><th>Categoria</th><th>Vigência</th><th>Preço</th><th>Status</th><th>Ação</th></tr></thead>
                <tbody>{productPrices.map((item, index) => {
                  const status = priceStatus(item)
                  return (
                    <tr key={`${item.fornecedor}-${item.produto}-${item.vigenciaInicio}-${index}`}>
                      <td data-label="Fornecedor" data-primary="true"><strong>{item.fornecedor}</strong></td>
                      <td data-label="Produto">{item.produto}</td>
                      <td data-label="Categoria">{categoryLabel(item.categoria)}</td>
                      <td data-label="Vigência">{dateLabel(item.vigenciaInicio)} → {dateLabel(item.vigenciaFim)}</td>
                      <td data-label="Preço"><strong>{money(item.precoUnitario)}</strong></td>
                      <td data-label="Status"><Badge tone={status.tone}>{status.label}</Badge></td>
                      <td data-label="Ação">
                        {item.ativo && !item.vigenciaFim && <button className="button catalog-edit-button" type="button" onClick={() => openProductPriceVersion(item)}>Nova vigência</button>}
                        {!item.ativo && <button className="button catalog-edit-button" type="button" onClick={() => openProductPriceVersion(item, true)}>Reativar</button>}
                      </td>
                    </tr>
                  )
                })}</tbody>
              </table>
            </div>
          ) : <EmptyState title="Nenhum preço de produto encontrado" description="Cadastre a primeira vigência para começar o histórico controlado." icon="sell" />}
        </Panel>
      )}

      <Modal
        open={editorOpen}
        titleId="catalog-editor-title"
        eyebrow={modalEyebrow(section, editingExisting, reactivatingPrice)}
        title={modalTitle(section, editingExisting, providerDraft, catalogProductDraft, reactivatingPrice)}
        description={modalDescription(section, reactivatingPrice)}
        onClose={closeEditor}
        busy={saving}
        width="medium"
        bodyClassName="catalog-editor-modal-body"
        footer={(
          <>
            <button className="button" type="button" onClick={closeEditor} disabled={saving}>Cancelar</button>
            <button className="button button-primary" type="button" onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Salvando…' : saveButtonLabel(section, editingExisting, reactivatingPrice)}
            </button>
          </>
        )}
      >
        <div className="catalog-editor-form">
          {editorError && <div className="admin-alert catalog-editor-error" role="alert">{editorError}</div>}
          {section === 'FORNECEDORES' && <ProviderForm draft={providerDraft} setDraft={setProviderDraft} editingExisting={editingExisting} />}
          {section === 'PRODUTOS' && <ProductForm draft={catalogProductDraft} setDraft={setCatalogProductDraft} editingExisting={editingExisting} />}
          {section === 'PRECOS_MO' && <LaborPriceForm draft={laborDraft} setDraft={setLaborDraft} catalogs={catalogs} providers={laborProviders} />}
          {section === 'PRECOS_PRODUTOS' && <ProductPriceForm draft={productPriceDraft} setDraft={setProductPriceDraft} products={adminCatalogs?.produtos || []} providers={foodProviders} />}
        </div>
      </Modal>
    </div>
  )
}

function modalEyebrow(section: CatalogSection, editing: boolean, reactivating: boolean) {
  if (section === 'FORNECEDORES') return editing ? 'EDIÇÃO DE FORNECEDOR' : 'NOVO FORNECEDOR'
  if (section === 'PRODUTOS') return editing ? 'EDIÇÃO DE PRODUTO' : 'NOVO PRODUTO'
  return reactivating ? 'REATIVAÇÃO POR NOVA VIGÊNCIA' : 'NOVA VIGÊNCIA'
}

function modalTitle(section: CatalogSection, editing: boolean, provider: ProviderDraft, product: ProductDraft, reactivating: boolean) {
  if (section === 'FORNECEDORES') return editing ? provider.nome || 'Editar fornecedor' : 'Cadastrar fornecedor'
  if (section === 'PRODUTOS') return editing ? product.nome || 'Editar produto' : 'Cadastrar produto'
  if (section === 'PRECOS_MO') return reactivating ? 'Reativar preço de mão de obra' : 'Preço de mão de obra'
  return reactivating ? 'Reativar preço de produto' : 'Preço de produto'
}

function modalDescription(section: CatalogSection, reactivating: boolean) {
  if (section === 'FORNECEDORES') return 'Configure elegibilidade, status e destino de WhatsApp.'
  if (section === 'PRODUTOS') return 'Defina categoria e status. Reativar o produto não altera preços históricos.'
  if (reactivating) return 'A reativação cria uma nova vigência ativa. O registro anterior permanece inalterado para rastreabilidade.'
  return 'A nova vigência encerrará automaticamente a versão vigente anterior para a mesma combinação.'
}

function saveButtonLabel(section: CatalogSection, editing: boolean, reactivating: boolean) {
  if (section === 'FORNECEDORES') return editing ? 'Salvar alterações' : 'Salvar fornecedor'
  if (section === 'PRODUTOS') return editing ? 'Salvar alterações' : 'Salvar produto'
  return reactivating ? 'Reativar com nova vigência' : 'Criar nova vigência'
}

function CatalogSearch({ value, onChange, placeholder, label }: { value: string; onChange: (value: string) => void; placeholder: string; label: string }) {
  return <div className="catalog-list-toolbar"><SearchField value={value} onChange={onChange} placeholder={placeholder} ariaLabel={label} /></div>
}

function ProviderForm({ draft, setDraft, editingExisting }: { draft: ProviderDraft; setDraft: React.Dispatch<React.SetStateAction<ProviderDraft>>; editingExisting: boolean }) {
  return <>
    <label>Fornecedor<input value={draft.nome} disabled={editingExisting} onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value.toUpperCase() }))} placeholder="Ex.: MULT" />{editingExisting && <small>Para trocar o nome, crie um novo fornecedor e inative o anterior.</small>}</label>
    <fieldset className="catalog-fieldset"><legend>Atende</legend><label className="catalog-check"><input type="checkbox" checked={draft.maoDeObra} onChange={(event) => setDraft((current) => ({ ...current, maoDeObra: event.target.checked }))} /><span>Mão de obra</span></label><label className="catalog-check"><input type="checkbox" checked={draft.alimentacao} onChange={(event) => setDraft((current) => ({ ...current, alimentacao: event.target.checked }))} /><span>Alimentação / bebida</span></label></fieldset>
    <label>Destino do WhatsApp<select value={draft.whatsappDestino} onChange={(event) => setDraft((current) => ({ ...current, whatsappDestino: event.target.value as WhatsappDestino }))}><option value="NENHUM">Não configurado</option><option value="NUMERO">Número individual</option><option value="GRUPO">Grupo do WhatsApp</option></select></label>
    {draft.whatsappDestino === 'NUMERO' && <label>Número do WhatsApp<input inputMode="tel" value={draft.whatsappNumero} onChange={(event) => setDraft((current) => ({ ...current, whatsappNumero: event.target.value }))} placeholder="Ex.: 5527999999999" /><small>Use formato internacional completo.</small></label>}
    {draft.whatsappDestino === 'GRUPO' && <label>Link de convite do grupo<input type="url" value={draft.whatsappGrupoLink} onChange={(event) => setDraft((current) => ({ ...current, whatsappGrupoLink: event.target.value }))} placeholder="https://chat.whatsapp.com/..." /></label>}
    <label>Status<select value={draft.ativo ? 'ATIVO' : 'INATIVO'} onChange={(event) => setDraft((current) => ({ ...current, ativo: event.target.value === 'ATIVO' }))}><option value="ATIVO">Ativo</option><option value="INATIVO">Inativo</option></select></label>
  </>
}

function ProductForm({ draft, setDraft, editingExisting }: { draft: ProductDraft; setDraft: React.Dispatch<React.SetStateAction<ProductDraft>>; editingExisting: boolean }) {
  return <>
    <label>Produto<input value={draft.nome} disabled={editingExisting} onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value.toUpperCase() }))} placeholder="Ex.: MARMITA P" />{editingExisting && <small>O nome fica imutável para preservar referências históricas.</small>}</label>
    <label>Categoria<select value={draft.categoria} onChange={(event) => setDraft((current) => ({ ...current, categoria: event.target.value as CategoriaProduto }))}><option value="ALIMENTACAO">Alimentação</option><option value="BEBIDA">Bebida</option></select></label>
    <label>Status<select value={draft.ativo ? 'ATIVO' : 'INATIVO'} onChange={(event) => setDraft((current) => ({ ...current, ativo: event.target.value === 'ATIVO' }))}><option value="ATIVO">Ativo</option><option value="INATIVO">Inativo</option></select></label>
    <div className="catalog-version-note"><span className="material-symbols-rounded" aria-hidden="true">info</span><p>Produto ativo só aparece no fluxo operacional quando também existe fornecedor ativo e preço ativo/vigente elegível.</p></div>
  </>
}

function LaborPriceForm({ draft, setDraft, catalogs, providers }: { draft: LaborPriceDraft; setDraft: React.Dispatch<React.SetStateAction<LaborPriceDraft>>; catalogs: CatalogosDto | null; providers: FornecedorAdminDto[] }) {
  return <>
    <div className="catalog-form-grid"><label>Fornecedor<select value={draft.fornecedor} onChange={(event) => setDraft((current) => ({ ...current, fornecedor: event.target.value }))}><option value="">Selecione</option>{providers.map((item) => <option key={item.nome} value={item.nome} disabled={!item.ativo}>{item.nome}{!item.ativo ? ' · INATIVO' : ''}</option>)}</select></label><label>Função<select value={draft.funcao} onChange={(event) => setDraft((current) => ({ ...current, funcao: event.target.value, turno: event.target.value === 'AUXILIAR OPERACIONAL' ? 'DIURNO' : current.turno }))}><option value="">Selecione</option>{(catalogs?.funcoes || []).map((item) => <option key={item.nome} value={item.nome}>{item.nome}</option>)}</select></label></div>
    <div className="catalog-form-grid"><label>Turno<select value={draft.turno} disabled={draft.funcao === 'AUXILIAR OPERACIONAL'} onChange={(event) => setDraft((current) => ({ ...current, turno: event.target.value as 'DIURNO' | 'NOTURNO' }))}><option value="DIURNO">Diurno</option><option value="NOTURNO">Noturno</option></select></label><label>Tipo de dia<select value={draft.tipoDia} onChange={(event) => setDraft((current) => ({ ...current, tipoDia: event.target.value as TipoDia }))}><option value="UTIL">Dia útil</option><option value="SABADO">Sábado</option><option value="DOMINGO_FERIADO">Domingo / feriado</option></select></label></div>
    <div className="catalog-form-grid"><label>Início da vigência<input type="date" value={draft.vigenciaInicio} onChange={(event) => setDraft((current) => ({ ...current, vigenciaInicio: event.target.value }))} /></label><label>Preço unitário<input type="number" min="0.01" step="0.01" inputMode="decimal" value={draft.precoUnitario} onChange={(event) => setDraft((current) => ({ ...current, precoUnitario: event.target.value }))} placeholder="0,00" /></label></div>
    <div className="catalog-version-note"><span className="material-symbols-rounded" aria-hidden="true">history</span><p>Reativação de preço sempre cria nova vigência. Fornecedor e função precisam estar ativos para salvar.</p></div>
  </>
}

function ProductPriceForm({ draft, setDraft, products, providers }: { draft: ProductPriceDraft; setDraft: React.Dispatch<React.SetStateAction<ProductPriceDraft>>; products: ProdutoAdminDto[]; providers: FornecedorAdminDto[] }) {
  return <>
    <div className="catalog-form-grid"><label>Fornecedor<select value={draft.fornecedor} onChange={(event) => setDraft((current) => ({ ...current, fornecedor: event.target.value }))}><option value="">Selecione</option>{providers.map((item) => <option key={item.nome} value={item.nome} disabled={!item.ativo}>{item.nome}{!item.ativo ? ' · INATIVO' : ''}</option>)}</select></label><label>Produto<select value={draft.produto} onChange={(event) => setDraft((current) => ({ ...current, produto: event.target.value }))}><option value="">Selecione</option>{products.map((item) => <option key={item.nome} value={item.nome} disabled={!item.ativo}>{item.nome} · {categoryLabel(item.categoria)}{!item.ativo ? ' · INATIVO' : ''}</option>)}</select></label></div>
    <div className="catalog-form-grid"><label>Início da vigência<input type="date" value={draft.vigenciaInicio} onChange={(event) => setDraft((current) => ({ ...current, vigenciaInicio: event.target.value }))} /></label><label>Preço unitário<input type="number" min="0.01" step="0.01" inputMode="decimal" value={draft.precoUnitario} onChange={(event) => setDraft((current) => ({ ...current, precoUnitario: event.target.value }))} placeholder="0,00" /></label></div>
    <div className="catalog-version-note"><span className="material-symbols-rounded" aria-hidden="true">history</span><p>Reativação cria uma nova vigência. Se fornecedor ou produto estiver inativo, reative o cadastro correspondente antes de salvar o preço.</p></div>
  </>
}
