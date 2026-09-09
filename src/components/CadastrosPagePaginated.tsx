import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { PageHeader } from './PageHeader'
import { Modal } from './ui/Modal'
import { Badge, EmptyState, Panel, PanelHeader, SearchField, Skeleton, SummaryMetrics } from './ui/Primitives'
import {
  fetchCatalogoAdminScope,
  saveFornecedorAdmin,
  saveProdutoAdmin,
  savePrecoMaoObraAdmin,
  savePrecoProdutoAdmin,
} from '../services/catalogService'
import type {
  CatalogAdminPaginationDto,
  CatalogAdminScope,
  CatalogosAdminResumoDto,
  CatalogosAdminScopeDto,
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

type ProductDraft = { nome: string; categoria: CategoriaProduto; ativo: boolean }
type LaborPriceDraft = {
  fornecedor: string
  funcao: string
  turno: 'DIURNO' | 'NOTURNO'
  tipoDia: TipoDia
  vigenciaInicio: string
  precoUnitario: string
}
type ProductPriceDraft = { fornecedor: string; produto: string; vigenciaInicio: string; precoUnitario: string }

const PRICE_PAGE_SIZE = 25

const emptyProviderDraft = (): ProviderDraft => ({
  nome: '',
  maoDeObra: true,
  alimentacao: false,
  ativo: true,
  whatsappDestino: 'NENHUM',
  whatsappNumero: '',
  whatsappGrupoLink: '',
})
const emptyProductDraft = (): ProductDraft => ({ nome: '', categoria: 'ALIMENTACAO', ativo: true })
const emptyLaborPriceDraft = (): LaborPriceDraft => ({
  fornecedor: '',
  funcao: '',
  turno: 'DIURNO',
  tipoDia: 'UTIL',
  vigenciaInicio: '',
  precoUnitario: '',
})
const emptyProductPriceDraft = (): ProductPriceDraft => ({ fornecedor: '', produto: '', vigenciaInicio: '', precoUnitario: '' })

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

function isPriceSection(section: CatalogSection) {
  return section === 'PRECOS_MO' || section === 'PRECOS_PRODUTOS'
}

export function CadastrosPagePaginated() {
  const [summary, setSummary] = useState<CatalogosAdminResumoDto | null>(null)
  const [functions, setFunctions] = useState<{ nome: string }[]>([])
  const [providerRows, setProviderRows] = useState<FornecedorAdminDto[]>([])
  const [productRows, setProductRows] = useState<ProdutoAdminDto[]>([])
  const [laborPriceRows, setLaborPriceRows] = useState<PrecoMaoObraAdminDto[]>([])
  const [productPriceRows, setProductPriceRows] = useState<PrecoProdutoAdminDto[]>([])
  const [pricePagination, setPricePagination] = useState<CatalogAdminPaginationDto | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [editorError, setEditorError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [section, setSection] = useState<CatalogSection>('FORNECEDORES')
  const [pricePage, setPricePage] = useState(1)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingExisting, setEditingExisting] = useState(false)
  const [reactivatingPrice, setReactivatingPrice] = useState(false)
  const [providerDraft, setProviderDraft] = useState<ProviderDraft>(emptyProviderDraft)
  const [catalogProductDraft, setCatalogProductDraft] = useState<ProductDraft>(emptyProductDraft)
  const [laborDraft, setLaborDraft] = useState<LaborPriceDraft>(emptyLaborPriceDraft)
  const [productPriceDraft, setProductPriceDraft] = useState<ProductPriceDraft>(emptyProductPriceDraft)

  const loadedStaticScopesRef = useRef(new Set<CatalogAdminScope>())
  const requestRef = useRef(0)

  function applyScope(data: CatalogosAdminScopeDto) {
    if (data.resumoAtivos) setSummary(data.resumoAtivos)
    if (data.funcoes) setFunctions(data.funcoes)
    if (data.fornecedores) setProviderRows(data.fornecedores)
    if (data.produtos) setProductRows(data.produtos)
    if (data.precosMaoObra) setLaborPriceRows(data.precosMaoObra)
    if (data.precosProdutos) setProductPriceRows(data.precosProdutos)
    if (data.paginacao) setPricePagination(data.paginacao)
  }

  async function loadStaticScope(scope: CatalogAdminScope, options?: { force?: boolean; signal?: AbortSignal; background?: boolean }) {
    if (!options?.force && loadedStaticScopesRef.current.has(scope)) return
    const requestId = options?.background ? 0 : ++requestRef.current
    if (!options?.background) setLoading(true)
    setLoadError('')
    try {
      const data = await fetchCatalogoAdminScope(scope, options?.signal || new AbortController().signal)
      applyScope(data)
      loadedStaticScopesRef.current.add(scope)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar os cadastros.')
    } finally {
      if (!options?.background && requestId === requestRef.current) setLoading(false)
    }
  }

  async function loadPriceScope(targetSection: 'PRECOS_MO' | 'PRECOS_PRODUTOS', page: number, query: string) {
    const requestId = ++requestRef.current
    setLoading(true)
    setLoadError('')
    try {
      const data = await fetchCatalogoAdminScope(targetSection, {
        pagina: page,
        tamanhoPagina: PRICE_PAGE_SIZE,
        busca: query,
      })
      if (requestId !== requestRef.current) return
      applyScope(data)
      if (data.paginacao && data.paginacao.pagina !== page) setPricePage(data.paginacao.pagina)
    } catch (error) {
      if (requestId !== requestRef.current) return
      setLoadError(error instanceof Error ? error.message : 'Não foi possível carregar o histórico de preços.')
    } finally {
      if (requestId === requestRef.current) setLoading(false)
    }
  }

  useEffect(() => {
    const controller = new AbortController()
    void loadStaticScope('FORNECEDORES', { signal: controller.signal })
    void loadStaticScope('RESUMO', { signal: controller.signal, background: true })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    if (!isPriceSection(section)) return
    setPricePage(1)
  }, [debouncedSearch, section])

  useEffect(() => {
    if (section === 'FORNECEDORES') void loadStaticScope('FORNECEDORES')
    if (section === 'PRODUTOS') void loadStaticScope('PRODUTOS')
    if (section === 'PRECOS_MO') void loadPriceScope('PRECOS_MO', pricePage, debouncedSearch)
    if (section === 'PRECOS_PRODUTOS') void loadPriceScope('PRECOS_PRODUTOS', pricePage, debouncedSearch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, pricePage, debouncedSearch])

  const normalizedSearch = search.trim().toUpperCase()
  const providers = useMemo(() => {
    if (!normalizedSearch) return providerRows
    return providerRows.filter((item) => `${item.nome} ${destinationLabel(item)}`.toUpperCase().includes(normalizedSearch))
  }, [providerRows, normalizedSearch])
  const products = useMemo(() => {
    if (!normalizedSearch) return productRows
    return productRows.filter((item) => `${item.nome} ${item.categoria}`.toUpperCase().includes(normalizedSearch))
  }, [productRows, normalizedSearch])

  const laborProviders = providerRows.filter((item) => item.maoDeObra)
  const foodProviders = providerRows.filter((item) => item.alimentacao)

  const metrics = [
    { key: 'operacoes', label: 'Operações', value: summary?.operacoes ?? '—', icon: 'warehouse' },
    { key: 'supervisores', label: 'Supervisores', value: summary?.supervisores ?? '—', icon: 'badge' },
    { key: 'fornecedores', label: 'Fornecedores ativos', value: summary?.fornecedores ?? '—', icon: 'local_shipping' },
    { key: 'atividades', label: 'Atividades', value: summary?.atividades ?? '—', icon: 'task_alt' },
    { key: 'funcoes', label: 'Funções', value: summary?.funcoes ?? '—', icon: 'engineering' },
    { key: 'produtos', label: 'Produtos ativos', value: summary?.produtos ?? '—', icon: 'inventory_2' },
  ]

  function changeSection(nextSection: CatalogSection) {
    setSection(nextSection)
    setSearch('')
    setDebouncedSearch('')
    setPricePage(1)
    setPricePagination(null)
    setNotice('')
    setEditorError('')
  }

  function resetMessages() {
    setNotice('')
    setEditorError('')
    setReactivatingPrice(false)
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
    setCatalogProductDraft({ nome: item.nome, categoria: item.categoria, ativo: item.ativo })
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

  async function reloadAfterSave() {
    if (section === 'FORNECEDORES' || section === 'PRODUTOS') {
      loadedStaticScopesRef.current.delete(section)
      await loadStaticScope(section, { force: true })
    } else {
      await loadPriceScope(section, pricePage, debouncedSearch)
    }
    loadedStaticScopesRef.current.delete('RESUMO')
    void loadStaticScope('RESUMO', { force: true, background: true })
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
        await saveProdutoAdmin({ produto: catalogProductDraft.nome, categoria: catalogProductDraft.categoria, ativo: catalogProductDraft.ativo })
        setNotice(editingExisting ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.')
      }

      if (section === 'PRECOS_MO') {
        if (!laborDraft.fornecedor || !laborDraft.funcao || !laborDraft.vigenciaInicio || !laborDraft.precoUnitario) throw new Error('Preencha fornecedor, função, vigência e preço.')
        await savePrecoMaoObraAdmin({
          fornecedor: laborDraft.fornecedor,
          funcao: laborDraft.funcao,
          turno: laborDraft.turno,
          tipoDia: laborDraft.tipoDia,
          vigenciaInicio: laborDraft.vigenciaInicio,
          precoUnitario: Number(laborDraft.precoUnitario.replace(',', '.')),
        })
        setNotice(reactivatingPrice ? 'Preço reativado por nova vigência. O registro anterior foi preservado.' : 'Nova vigência de mão de obra criada.')
      }

      if (section === 'PRECOS_PRODUTOS') {
        if (!productPriceDraft.fornecedor || !productPriceDraft.produto || !productPriceDraft.vigenciaInicio || !productPriceDraft.precoUnitario) throw new Error('Preencha fornecedor, produto, vigência e preço.')
        await savePrecoProdutoAdmin({
          fornecedor: productPriceDraft.fornecedor,
          produto: productPriceDraft.produto,
          vigenciaInicio: productPriceDraft.vigenciaInicio,
          precoUnitario: Number(productPriceDraft.precoUnitario.replace(',', '.')),
        })
        setNotice(reactivatingPrice ? 'Preço de produto reativado por nova vigência. O registro anterior foi preservado.' : 'Nova vigência de produto criada.')
      }

      setEditorOpen(false)
      setReactivatingPrice(false)
      await reloadAfterSave()
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
        description="Mantenha fornecedores, produtos e tabelas de preço com rastreabilidade. Históricos extensos são paginados no servidor."
        actions={<button className="button button-primary" type="button" onClick={openNew}><span className="material-symbols-rounded" aria-hidden="true">add</span>{pageActionLabel}</button>}
      />

      {notice && <div className="admin-alert admin-alert-success catalog-notice">{notice}</div>}
      {loadError && <div className="admin-alert catalog-notice" role="alert">{loadError}</div>}
      <SummaryMetrics items={metrics} ariaLabel="Catálogos ativos" />

      <div className="catalog-section-tabs" role="tablist" aria-label="Tipos de cadastro">
        <button type="button" role="tab" aria-selected={section === 'FORNECEDORES'} className={section === 'FORNECEDORES' ? 'is-active' : ''} onClick={() => changeSection('FORNECEDORES')}>Fornecedores</button>
        <button type="button" role="tab" aria-selected={section === 'PRODUTOS'} className={section === 'PRODUTOS' ? 'is-active' : ''} onClick={() => changeSection('PRODUTOS')}>Produtos</button>
        <button type="button" role="tab" aria-selected={section === 'PRECOS_MO'} className={section === 'PRECOS_MO' ? 'is-active' : ''} onClick={() => changeSection('PRECOS_MO')}>Preços de mão de obra</button>
        <button type="button" role="tab" aria-selected={section === 'PRECOS_PRODUTOS'} className={section === 'PRECOS_PRODUTOS' ? 'is-active' : ''} onClick={() => changeSection('PRECOS_PRODUTOS')}>Preços de produtos</button>
      </div>

      {section === 'FORNECEDORES' && <ProviderPanel loading={loading} items={providers} search={search} setSearch={setSearch} onEdit={editProvider} />}
      {section === 'PRODUTOS' && <ProductPanel loading={loading} items={products} search={search} setSearch={setSearch} onEdit={editProduct} />}
      {section === 'PRECOS_MO' && <LaborPricePanel loading={loading} items={laborPriceRows} search={search} setSearch={setSearch} onVersion={openLaborVersion} pagination={pricePagination} onPage={setPricePage} />}
      {section === 'PRECOS_PRODUTOS' && <ProductPricePanel loading={loading} items={productPriceRows} search={search} setSearch={setSearch} onVersion={openProductPriceVersion} pagination={pricePagination} onPage={setPricePage} />}

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
        footer={<><button className="button" type="button" onClick={closeEditor} disabled={saving}>Cancelar</button><button className="button button-primary" type="button" onClick={() => void handleSave()} disabled={saving}>{saving ? 'Salvando…' : saveButtonLabel(section, editingExisting, reactivatingPrice)}</button></>}
      >
        <div className="catalog-editor-form">
          {editorError && <div className="admin-alert catalog-editor-error" role="alert">{editorError}</div>}
          {section === 'FORNECEDORES' && <ProviderForm draft={providerDraft} setDraft={setProviderDraft} editingExisting={editingExisting} />}
          {section === 'PRODUTOS' && <ProductForm draft={catalogProductDraft} setDraft={setCatalogProductDraft} editingExisting={editingExisting} />}
          {section === 'PRECOS_MO' && <LaborPriceForm draft={laborDraft} setDraft={setLaborDraft} functions={functions} providers={laborProviders} />}
          {section === 'PRECOS_PRODUTOS' && <ProductPriceForm draft={productPriceDraft} setDraft={setProductPriceDraft} products={productRows} providers={foodProviders} />}
        </div>
      </Modal>
    </div>
  )
}

function CatalogSearch({ value, onChange, placeholder, label }: { value: string; onChange: (value: string) => void; placeholder: string; label: string }) {
  return <div className="catalog-list-toolbar"><SearchField value={value} onChange={onChange} placeholder={placeholder} ariaLabel={label} /></div>
}

function PricePagination({ pagination, onPage }: { pagination: CatalogAdminPaginationDto | null; onPage: (page: number) => void }) {
  if (!pagination?.paginado) return null
  const start = pagination.total === 0 ? 0 : (pagination.pagina - 1) * pagination.tamanhoPagina + 1
  const end = Math.min(pagination.pagina * pagination.tamanhoPagina, pagination.total)
  return (
    <footer className="admin-pagination">
      <span className="admin-pagination-range">{start}–{end} de {pagination.total}</span>
      <div className="admin-pagination-nav" aria-label="Navegação de páginas do histórico">
        <button type="button" className="icon-button" onClick={() => onPage(Math.max(1, pagination.pagina - 1))} disabled={pagination.pagina <= 1} aria-label="Página anterior">
          <span className="material-symbols-rounded" aria-hidden="true">chevron_left</span>
        </button>
        <span>Página {pagination.pagina} de {pagination.totalPaginas}</span>
        <button type="button" className="icon-button" onClick={() => onPage(Math.min(pagination.totalPaginas, pagination.pagina + 1))} disabled={pagination.pagina >= pagination.totalPaginas} aria-label="Próxima página">
          <span className="material-symbols-rounded" aria-hidden="true">chevron_right</span>
        </button>
      </div>
    </footer>
  )
}

function ProviderPanel({ loading, items, search, setSearch, onEdit }: { loading: boolean; items: FornecedorAdminDto[]; search: string; setSearch: (value: string) => void; onEdit: (item: FornecedorAdminDto) => void }) {
  return <Panel className="catalog-provider-list"><PanelHeader eyebrow="FORNECEDORES" title="Fornecedores e contato" description="Inative registros em vez de excluir. Um fornecedor inativo pode ser reativado pelo mesmo botão Editar." /><CatalogSearch value={search} onChange={setSearch} placeholder="Buscar fornecedor ou destino…" label="Buscar fornecedores" />{loading ? <Skeleton lines={7} /> : items.length ? <div className="table-wrap embedded"><table className="responsive-data-table catalog-table"><thead><tr><th>Fornecedor</th><th>Atendimento</th><th>WhatsApp</th><th>Status</th><th>Ação</th></tr></thead><tbody>{items.map((item) => <tr key={item.nome}><td data-label="Fornecedor" data-primary="true"><strong>{item.nome}</strong></td><td data-label="Atendimento"><div className="catalog-badge-stack">{item.maoDeObra && <Badge>Mão de obra</Badge>}{item.alimentacao && <Badge>Alimentação</Badge>}</div></td><td data-label="WhatsApp">{destinationLabel(item)}</td><td data-label="Status"><Badge tone={item.ativo ? 'success' : 'neutral'}>{item.ativo ? 'Ativo' : 'Inativo'}</Badge></td><td data-label="Ação"><button className="button catalog-edit-button" type="button" onClick={() => onEdit(item)}>{item.ativo ? 'Editar' : 'Reativar'}</button></td></tr>)}</tbody></table></div> : <EmptyState title="Nenhum fornecedor encontrado" description="Ajuste a busca ou cadastre um novo fornecedor." icon="local_shipping" />}</Panel>
}

function ProductPanel({ loading, items, search, setSearch, onEdit }: { loading: boolean; items: ProdutoAdminDto[]; search: string; setSearch: (value: string) => void; onEdit: (item: ProdutoAdminDto) => void }) {
  return <Panel className="catalog-provider-list"><PanelHeader eyebrow="CATÁLOGO" title="Produtos" description="Produtos inativos só ficam visíveis para manutenção quando existe vínculo com fornecedor de alimentação ativo." /><CatalogSearch value={search} onChange={setSearch} placeholder="Buscar produto ou categoria…" label="Buscar produtos" />{loading ? <Skeleton lines={7} /> : items.length ? <div className="table-wrap embedded"><table className="responsive-data-table catalog-table"><thead><tr><th>Produto</th><th>Categoria</th><th>Status</th><th>Ação</th></tr></thead><tbody>{items.map((item) => <tr key={item.nome}><td data-label="Produto" data-primary="true"><strong>{item.nome}</strong></td><td data-label="Categoria">{categoryLabel(item.categoria)}</td><td data-label="Status"><Badge tone={item.ativo ? 'success' : 'neutral'}>{item.ativo ? 'Ativo' : 'Inativo'}</Badge></td><td data-label="Ação"><button className="button catalog-edit-button" type="button" onClick={() => onEdit(item)}>{item.ativo ? 'Editar' : 'Reativar'}</button></td></tr>)}</tbody></table></div> : <EmptyState title="Nenhum produto encontrado" description="Ajuste a busca ou cadastre um novo produto." icon="inventory_2" />}</Panel>
}

function LaborPricePanel({ loading, items, search, setSearch, onVersion, pagination, onPage }: { loading: boolean; items: PrecoMaoObraAdminDto[]; search: string; setSearch: (value: string) => void; onVersion: (item: PrecoMaoObraAdminDto, reactivate?: boolean) => void; pagination: CatalogAdminPaginationDto | null; onPage: (page: number) => void }) {
  return <Panel className="catalog-provider-list"><PanelHeader eyebrow="TABELA VERSIONADA" title="Preços de mão de obra" description="Acima de 50 registros, o histórico é exibido em páginas de 25. A busca considera o histórico completo." /><CatalogSearch value={search} onChange={setSearch} placeholder="Buscar fornecedor, função, turno…" label="Buscar preços de mão de obra" />{loading ? <Skeleton lines={7} /> : items.length ? <><div className="table-wrap embedded"><table className="responsive-data-table catalog-table catalog-price-table"><thead><tr><th>Fornecedor</th><th>Função</th><th>Turno</th><th>Tipo de dia</th><th>Vigência</th><th>Preço</th><th>Status</th><th>Ação</th></tr></thead><tbody>{items.map((item, index) => { const status = priceStatus(item); return <tr key={`${item.fornecedor}-${item.funcao}-${item.turno}-${item.tipoDia}-${item.vigenciaInicio}-${index}`}><td data-label="Fornecedor" data-primary="true"><strong>{item.fornecedor}</strong></td><td data-label="Função">{item.funcao}</td><td data-label="Turno">{item.turno}</td><td data-label="Tipo de dia">{dayTypeLabel(item.tipoDia)}</td><td data-label="Vigência">{dateLabel(item.vigenciaInicio)} → {dateLabel(item.vigenciaFim)}</td><td data-label="Preço"><strong>{money(item.precoUnitario)}</strong></td><td data-label="Status"><Badge tone={status.tone}>{status.label}</Badge></td><td data-label="Ação">{item.ativo && !item.vigenciaFim && <button className="button catalog-edit-button" type="button" onClick={() => onVersion(item)}>Nova vigência</button>}{!item.ativo && <button className="button catalog-edit-button" type="button" onClick={() => onVersion(item, true)}>Reativar</button>}</td></tr> })}</tbody></table></div><PricePagination pagination={pagination} onPage={onPage} /></> : <EmptyState title="Nenhum preço de mão de obra encontrado" description="Ajuste a busca ou cadastre a primeira vigência." icon="payments" />}</Panel>
}

function ProductPricePanel({ loading, items, search, setSearch, onVersion, pagination, onPage }: { loading: boolean; items: PrecoProdutoAdminDto[]; search: string; setSearch: (value: string) => void; onVersion: (item: PrecoProdutoAdminDto, reactivate?: boolean) => void; pagination: CatalogAdminPaginationDto | null; onPage: (page: number) => void }) {
  return <Panel className="catalog-provider-list"><PanelHeader eyebrow="TABELA VERSIONADA" title="Preços de produtos" description="Acima de 50 registros, o histórico é exibido em páginas de 25. A busca considera o histórico completo." /><CatalogSearch value={search} onChange={setSearch} placeholder="Buscar fornecedor, produto, categoria…" label="Buscar preços de produtos" />{loading ? <Skeleton lines={7} /> : items.length ? <><div className="table-wrap embedded"><table className="responsive-data-table catalog-table catalog-price-table"><thead><tr><th>Fornecedor</th><th>Produto</th><th>Categoria</th><th>Vigência</th><th>Preço</th><th>Status</th><th>Ação</th></tr></thead><tbody>{items.map((item, index) => { const status = priceStatus(item); return <tr key={`${item.fornecedor}-${item.produto}-${item.vigenciaInicio}-${index}`}><td data-label="Fornecedor" data-primary="true"><strong>{item.fornecedor}</strong></td><td data-label="Produto">{item.produto}</td><td data-label="Categoria">{categoryLabel(item.categoria)}</td><td data-label="Vigência">{dateLabel(item.vigenciaInicio)} → {dateLabel(item.vigenciaFim)}</td><td data-label="Preço"><strong>{money(item.precoUnitario)}</strong></td><td data-label="Status"><Badge tone={status.tone}>{status.label}</Badge></td><td data-label="Ação">{item.ativo && !item.vigenciaFim && <button className="button catalog-edit-button" type="button" onClick={() => onVersion(item)}>Nova vigência</button>}{!item.ativo && <button className="button catalog-edit-button" type="button" onClick={() => onVersion(item, true)}>Reativar</button>}</td></tr> })}</tbody></table></div><PricePagination pagination={pagination} onPage={onPage} /></> : <EmptyState title="Nenhum preço de produto encontrado" description="Ajuste a busca ou cadastre a primeira vigência." icon="sell" />}</Panel>
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
  if (reactivating) return 'Será criada uma nova linha de vigência; o registro anterior permanece preservado.'
  return 'A nova vigência encerra automaticamente a anterior do mesmo vínculo.'
}

function saveButtonLabel(section: CatalogSection, editing: boolean, reactivating: boolean) {
  if (section === 'FORNECEDORES' || section === 'PRODUTOS') return editing ? 'Salvar alterações' : 'Cadastrar'
  return reactivating ? 'Criar reativação' : 'Criar vigência'
}

function ProviderForm({ draft, setDraft, editingExisting }: { draft: ProviderDraft; setDraft: Dispatch<SetStateAction<ProviderDraft>>; editingExisting: boolean }) {
  return <><div className="catalog-form-grid"><label>Fornecedor<input value={draft.nome} disabled={editingExisting} onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value }))} /></label><label>Status<select value={draft.ativo ? 'ATIVO' : 'INATIVO'} onChange={(event) => setDraft((current) => ({ ...current, ativo: event.target.value === 'ATIVO' }))}><option value="ATIVO">Ativo</option><option value="INATIVO">Inativo</option></select></label></div><div className="catalog-form-grid"><label className="catalog-checkbox-label"><input type="checkbox" checked={draft.maoDeObra} onChange={(event) => setDraft((current) => ({ ...current, maoDeObra: event.target.checked }))} />Atende mão de obra</label><label className="catalog-checkbox-label"><input type="checkbox" checked={draft.alimentacao} onChange={(event) => setDraft((current) => ({ ...current, alimentacao: event.target.checked }))} />Atende alimentação</label></div><div className="catalog-form-grid"><label>Destino WhatsApp<select value={draft.whatsappDestino} onChange={(event) => setDraft((current) => ({ ...current, whatsappDestino: event.target.value as WhatsappDestino }))}><option value="NENHUM">Não configurado</option><option value="NUMERO">Número</option><option value="GRUPO">Grupo</option></select></label>{draft.whatsappDestino === 'NUMERO' && <label>Número<input value={draft.whatsappNumero} onChange={(event) => setDraft((current) => ({ ...current, whatsappNumero: event.target.value }))} placeholder="5527999999999" /></label>}{draft.whatsappDestino === 'GRUPO' && <label>Link do grupo<input value={draft.whatsappGrupoLink} onChange={(event) => setDraft((current) => ({ ...current, whatsappGrupoLink: event.target.value }))} placeholder="https://chat.whatsapp.com/..." /></label>}</div></>
}

function ProductForm({ draft, setDraft, editingExisting }: { draft: ProductDraft; setDraft: Dispatch<SetStateAction<ProductDraft>>; editingExisting: boolean }) {
  return <div className="catalog-form-grid"><label>Produto<input value={draft.nome} disabled={editingExisting} onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value }))} /></label><label>Categoria<select value={draft.categoria} onChange={(event) => setDraft((current) => ({ ...current, categoria: event.target.value as CategoriaProduto }))}><option value="ALIMENTACAO">Alimentação</option><option value="BEBIDA">Bebida</option></select></label><label>Status<select value={draft.ativo ? 'ATIVO' : 'INATIVO'} onChange={(event) => setDraft((current) => ({ ...current, ativo: event.target.value === 'ATIVO' }))}><option value="ATIVO">Ativo</option><option value="INATIVO">Inativo</option></select></label></div>
}

function LaborPriceForm({ draft, setDraft, functions, providers }: { draft: LaborPriceDraft; setDraft: Dispatch<SetStateAction<LaborPriceDraft>>; functions: { nome: string }[]; providers: FornecedorAdminDto[] }) {
  return <><div className="catalog-form-grid"><label>Fornecedor<select value={draft.fornecedor} onChange={(event) => setDraft((current) => ({ ...current, fornecedor: event.target.value }))}><option value="">Selecione</option>{providers.map((item) => <option key={item.nome} value={item.nome} disabled={!item.ativo}>{item.nome}{!item.ativo ? ' · INATIVO' : ''}</option>)}</select></label><label>Função<select value={draft.funcao} onChange={(event) => setDraft((current) => ({ ...current, funcao: event.target.value, turno: event.target.value === 'AUXILIAR OPERACIONAL' ? 'DIURNO' : current.turno }))}><option value="">Selecione</option>{functions.map((item) => <option key={item.nome} value={item.nome}>{item.nome}</option>)}</select></label></div><div className="catalog-form-grid"><label>Turno<select value={draft.turno} disabled={draft.funcao === 'AUXILIAR OPERACIONAL'} onChange={(event) => setDraft((current) => ({ ...current, turno: event.target.value as 'DIURNO' | 'NOTURNO' }))}><option value="DIURNO">Diurno</option><option value="NOTURNO">Noturno</option></select></label><label>Tipo de dia<select value={draft.tipoDia} onChange={(event) => setDraft((current) => ({ ...current, tipoDia: event.target.value as TipoDia }))}><option value="UTIL">Dia útil</option><option value="SABADO">Sábado</option><option value="DOMINGO_FERIADO">Domingo / feriado</option></select></label></div><div className="catalog-form-grid"><label>Início da vigência<input type="date" value={draft.vigenciaInicio} onChange={(event) => setDraft((current) => ({ ...current, vigenciaInicio: event.target.value }))} /></label><label>Preço unitário<input type="number" min="0.01" step="0.01" inputMode="decimal" value={draft.precoUnitario} onChange={(event) => setDraft((current) => ({ ...current, precoUnitario: event.target.value }))} placeholder="0,00" /></label></div></>
}

function ProductPriceForm({ draft, setDraft, products, providers }: { draft: ProductPriceDraft; setDraft: Dispatch<SetStateAction<ProductPriceDraft>>; products: ProdutoAdminDto[]; providers: FornecedorAdminDto[] }) {
  return <><div className="catalog-form-grid"><label>Fornecedor<select value={draft.fornecedor} onChange={(event) => setDraft((current) => ({ ...current, fornecedor: event.target.value }))}><option value="">Selecione</option>{providers.map((item) => <option key={item.nome} value={item.nome} disabled={!item.ativo}>{item.nome}{!item.ativo ? ' · INATIVO' : ''}</option>)}</select></label><label>Produto<select value={draft.produto} onChange={(event) => setDraft((current) => ({ ...current, produto: event.target.value }))}><option value="">Selecione</option>{products.map((item) => <option key={item.nome} value={item.nome} disabled={!item.ativo}>{item.nome} · {categoryLabel(item.categoria)}{!item.ativo ? ' · INATIVO' : ''}</option>)}</select></label></div><div className="catalog-form-grid"><label>Início da vigência<input type="date" value={draft.vigenciaInicio} onChange={(event) => setDraft((current) => ({ ...current, vigenciaInicio: event.target.value }))} /></label><label>Preço unitário<input type="number" min="0.01" step="0.01" inputMode="decimal" value={draft.precoUnitario} onChange={(event) => setDraft((current) => ({ ...current, precoUnitario: event.target.value }))} placeholder="0,00" /></label></div></>
}
