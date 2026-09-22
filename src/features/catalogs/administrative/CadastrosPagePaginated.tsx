import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react'
import { Button } from 'primereact/button'
import { Checkbox } from 'primereact/checkbox'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Dropdown } from 'primereact/dropdown'
import { InputSwitch } from 'primereact/inputswitch'
import { InputText } from 'primereact/inputtext'
import { Message } from 'primereact/message'
import { Paginator } from 'primereact/paginator'
import { TabMenu } from 'primereact/tabmenu'
import { PageHeader } from '@/components/PageHeader'
import { Modal } from '@/components/ui/Modal'
import { Badge, EmptyState, Panel, PanelHeader, SearchField, Skeleton } from '@/components/ui/Primitives'
import {
  fetchCatalogoAdminScope,
  saveAtividadeAdmin,
  saveFeriadoAdmin,
  saveFornecedorAdmin,
  saveFuncaoAdmin,
  saveMetaMaoObraAdmin,
  saveOperacaoAdmin,
  savePrecoMaoObraAdmin,
  savePrecoProdutoAdmin,
  saveProdutoAdmin,
  saveSupervisorAdmin,
} from '@/services/catalogService'
import type {
  CatalogAdminPaginationDto,
  CatalogAdminScope,
  CatalogoAdminNomeDto,
  CatalogosAdminResumoDto,
  CatalogosAdminScopeDto,
  CategoriaProduto,
  FeriadoAdminDto,
  FornecedorAdminDto,
  MetaMaoObraAdminDto,
  PrecoMaoObraAdminDto,
  PrecoProdutoAdminDto,
  ProdutoAdminDto,
  TipoDia,
  WhatsappDestino,
} from '@/types/catalog'

import {
  CATEGORY_OPTIONS,
  DAY_TYPE_OPTIONS,
  PRICE_PAGE_SIZE,
  SECTION_ITEMS,
  TURN_OPTIONS,
  WHATSAPP_OPTIONS,
  emptyGoalDraft,
  emptyHolidayDraft,
  emptyLaborPriceDraft,
  emptyNamedDraft,
  emptyProductDraft,
  emptyProductPriceDraft,
  emptyProviderDraft,
  type CatalogSection,
  type GoalDraft,
  type HolidayDraft,
  type LaborPriceDraft,
  type NamedDraft,
  type ProductDraft,
  type ProductPriceDraft,
  type ProviderDraft,
} from '@/features/catalogs/administrative/catalogAdminModel'

import { CatalogAdminSummary } from '@/features/catalogs/administrative/CatalogAdminSummary'

import {
  categoryLabel,
  competenceLabel,
  dateLabel,
  dayTypeLabel,
  destinationLabel,
  isNamedSection,
  isPriceSection,
  money,
  namedOptions,
  namedSectionLabel,
  priceStatus,
} from '@/features/catalogs/administrative/catalogAdminPresentation'

function StatusBadge({ active }: { active: boolean }) {
  return <Badge tone={active ? 'success' : 'neutral'}>{active ? 'Ativo' : 'Inativo'}</Badge>
}

function CatalogAction({ label, icon = 'pi pi-pencil', onClick }: { label: string; icon?: string; onClick: () => void }) {
  return <Button label={label} icon={icon} size="small" outlined onClick={onClick} className="nx-catalog-action" />
}

export function CadastrosPagePaginated() {
  const [summary, setSummary] = useState<CatalogosAdminResumoDto | null>(null)
  const [operationRows, setOperationRows] = useState<CatalogoAdminNomeDto[]>([])
  const [supervisorRows, setSupervisorRows] = useState<CatalogoAdminNomeDto[]>([])
  const [functionRows, setFunctionRows] = useState<CatalogoAdminNomeDto[]>([])
  const [activityRows, setActivityRows] = useState<CatalogoAdminNomeDto[]>([])
  const [holidayRows, setHolidayRows] = useState<FeriadoAdminDto[]>([])
  const [goalRows, setGoalRows] = useState<MetaMaoObraAdminDto[]>([])
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
  const [section, setSection] = useState<CatalogSection>('OPERACOES')
  const [pricePage, setPricePage] = useState(1)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingExisting, setEditingExisting] = useState(false)
  const [reactivatingPrice, setReactivatingPrice] = useState(false)
  const [namedDraft, setNamedDraft] = useState<NamedDraft>(emptyNamedDraft)
  const [holidayDraft, setHolidayDraft] = useState<HolidayDraft>(emptyHolidayDraft)
  const [goalDraft, setGoalDraft] = useState<GoalDraft>(emptyGoalDraft)
  const [providerDraft, setProviderDraft] = useState<ProviderDraft>(emptyProviderDraft)
  const [catalogProductDraft, setCatalogProductDraft] = useState<ProductDraft>(emptyProductDraft)
  const [laborDraft, setLaborDraft] = useState<LaborPriceDraft>(emptyLaborPriceDraft)
  const [productPriceDraft, setProductPriceDraft] = useState<ProductPriceDraft>(emptyProductPriceDraft)

  const loadedStaticScopesRef = useRef(new Set<CatalogAdminScope>())
  const requestRef = useRef(0)

  function applyScope(data: CatalogosAdminScopeDto) {
    if (data.resumoAtivos) setSummary(data.resumoAtivos)
    if (data.operacoes) setOperationRows(data.operacoes)
    if (data.supervisores) setSupervisorRows(data.supervisores)
    if (data.funcoes) setFunctionRows(data.funcoes)
    if (data.atividades) setActivityRows(data.atividades)
    if (data.feriados) setHolidayRows(data.feriados)
    if (data.metas) setGoalRows(data.metas)
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
    void loadStaticScope('OPERACOES', { signal: controller.signal })
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
    if (isPriceSection(section)) void loadPriceScope(section, pricePage, debouncedSearch)
    else void loadStaticScope(section)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section, pricePage, debouncedSearch])

  const normalizedSearch = search.trim().toUpperCase()
  const filterNamed = (items: CatalogoAdminNomeDto[]) => !normalizedSearch ? items : items.filter((item) => item.nome.toUpperCase().includes(normalizedSearch))
  const operations = useMemo(() => filterNamed(operationRows), [operationRows, normalizedSearch])
  const supervisors = useMemo(() => filterNamed(supervisorRows), [supervisorRows, normalizedSearch])
  const functions = useMemo(() => filterNamed(functionRows), [functionRows, normalizedSearch])
  const activities = useMemo(() => filterNamed(activityRows), [activityRows, normalizedSearch])
  const holidays = useMemo(() => !normalizedSearch ? holidayRows : holidayRows.filter((item) => `${item.data} ${item.denominacao} ${item.tipo} ${item.municipio} ${item.uf} ${item.fonte}`.toUpperCase().includes(normalizedSearch)), [holidayRows, normalizedSearch])
  const goals = useMemo(() => !normalizedSearch ? goalRows : goalRows.filter((item) => `${item.competencia} ${item.valor}`.toUpperCase().includes(normalizedSearch)), [goalRows, normalizedSearch])
  const providers = useMemo(() => !normalizedSearch ? providerRows : providerRows.filter((item) => `${item.nome} ${destinationLabel(item)}`.toUpperCase().includes(normalizedSearch)), [providerRows, normalizedSearch])
  const products = useMemo(() => !normalizedSearch ? productRows : productRows.filter((item) => `${item.nome} ${item.categoria}`.toUpperCase().includes(normalizedSearch)), [productRows, normalizedSearch])

  const laborProviders = providerRows.filter((item) => item.ativo && item.maoDeObra)
  const foodProviders = providerRows.filter((item) => item.ativo && item.alimentacao)
  const activeFunctions = functionRows.filter((item) => item.ativo)

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
    if (isNamedSection(section)) setNamedDraft(emptyNamedDraft())
    if (section === 'FERIADOS') setHolidayDraft(emptyHolidayDraft())
    if (section === 'METAS') setGoalDraft(emptyGoalDraft())
    if (section === 'FORNECEDORES') setProviderDraft(emptyProviderDraft())
    if (section === 'PRODUTOS') setCatalogProductDraft(emptyProductDraft())
    if (section === 'PRECOS_MO') setLaborDraft(emptyLaborPriceDraft())
    if (section === 'PRECOS_PRODUTOS') setProductPriceDraft(emptyProductPriceDraft())
    setEditorOpen(true)
  }

  function editNamed(item: CatalogoAdminNomeDto) {
    resetMessages()
    setEditingExisting(true)
    setNamedDraft({ nome: item.nome, ativo: item.ativo })
    setEditorOpen(true)
  }

  function editHoliday(item: FeriadoAdminDto) {
    resetMessages()
    setEditingExisting(true)
    setHolidayDraft({ ...item })
    setEditorOpen(true)
  }

  function editGoal(item: MetaMaoObraAdminDto) {
    resetMessages()
    setEditingExisting(true)
    setGoalDraft({ competencia: item.competencia, valor: String(item.valor) })
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
    setLaborDraft({ fornecedor: item.fornecedor, funcao: item.funcao, turno: item.turno, tipoDia: item.tipoDia, vigenciaInicio: '', precoUnitario: reactivate ? String(item.precoUnitario) : '' })
    setEditorOpen(true)
  }

  function openProductPriceVersion(item: PrecoProdutoAdminDto, reactivate = false) {
    resetMessages()
    setReactivatingPrice(reactivate)
    setProductPriceDraft({ fornecedor: item.fornecedor, produto: item.produto, vigenciaInicio: '', precoUnitario: reactivate ? String(item.precoUnitario) : '' })
    setEditorOpen(true)
  }

  function closeEditor() {
    if (saving) return
    setEditorOpen(false)
    setEditorError('')
    setReactivatingPrice(false)
  }

  async function reloadAfterSave() {
    if (!isPriceSection(section)) {
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
      if (isNamedSection(section)) {
        const label = namedSectionLabel(section)
        if (!namedDraft.nome.trim()) throw new Error(`Informe ${label === 'Atividade' ? 'a' : 'o'} ${label.toLowerCase()}.`)
        if (section === 'OPERACOES') await saveOperacaoAdmin({ nome: namedDraft.nome, ativo: namedDraft.ativo })
        if (section === 'SUPERVISORES') await saveSupervisorAdmin({ nome: namedDraft.nome, ativo: namedDraft.ativo })
        if (section === 'FUNCOES') await saveFuncaoAdmin({ nome: namedDraft.nome, ativo: namedDraft.ativo })
        if (section === 'ATIVIDADES') await saveAtividadeAdmin({ nome: namedDraft.nome, ativo: namedDraft.ativo })
        setNotice(editingExisting ? `${label} atualizada com sucesso.` : `${label} cadastrada com sucesso.`)
      }

      if (section === 'FERIADOS') {
        if (!holidayDraft.data || !holidayDraft.denominacao.trim()) throw new Error('Informe a data e a denominação do feriado.')
        await saveFeriadoAdmin(holidayDraft)
        setNotice(editingExisting ? 'Feriado atualizado com sucesso.' : 'Feriado cadastrado com sucesso.')
      }

      if (section === 'METAS') {
        const value = Number(goalDraft.valor.replace(',', '.'))
        if (!/^\d{4}-\d{2}$/.test(goalDraft.competencia) || !Number.isFinite(value) || value <= 0) throw new Error('Informe uma competência válida e uma meta maior que zero.')
        await saveMetaMaoObraAdmin({ competencia: goalDraft.competencia, valor: value })
        setNotice(editingExisting ? 'Meta atualizada com sucesso.' : 'Meta cadastrada com sucesso.')
      }

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

  const pageActionLabel = section === 'OPERACOES' ? 'Nova operação'
    : section === 'SUPERVISORES' ? 'Novo supervisor'
      : section === 'FUNCOES' ? 'Nova função'
        : section === 'ATIVIDADES' ? 'Nova atividade'
          : section === 'FERIADOS' ? 'Novo feriado'
            : section === 'METAS' ? 'Nova meta'
              : section === 'FORNECEDORES' ? 'Novo fornecedor'
                : section === 'PRODUTOS' ? 'Novo produto'
                  : section === 'PRECOS_MO' ? 'Novo preço de mão de obra'
                    : 'Novo preço de produto'

  const activeSectionIndex = Math.max(0, SECTION_ITEMS.findIndex((item) => item.key === section))

  return (
    <div className="catalog-page nx-modern-page nx-catalog-page">
      <PageHeader
        eyebrow="ADMINISTRAÇÃO"
        title="Cadastros"
        description="Mantenha catálogos operacionais, feriados, metas, fornecedores, produtos e tabelas de preço em uma única área administrativa."
        actions={<Button label={pageActionLabel} icon="pi pi-plus" onClick={openNew} className="nx-primary-button" />}
      />

      {notice && <Message severity="success" text={notice} className="nx-catalog-message" />}
      {loadError && <Message severity="error" text={loadError} className="nx-catalog-message" />}

      <CatalogAdminSummary summary={summary} />

      <div className="nx-catalog-navigation" aria-label="Tipos de cadastro">
        <TabMenu
          model={SECTION_ITEMS.map((item) => ({ label: item.label, icon: item.icon }))}
          activeIndex={activeSectionIndex}
          onTabChange={(event) => changeSection(SECTION_ITEMS[event.index].key)}
          className="nx-catalog-tabmenu"
        />
        <Dropdown
          value={section}
          options={SECTION_ITEMS.map((item) => ({ label: item.label, value: item.key }))}
          onChange={(event) => changeSection(event.value as CatalogSection)}
          className="nx-catalog-mobile-nav"
          aria-label="Tipo de cadastro"
        />
      </div>

      {section === 'OPERACOES' && <NamedPanel loading={loading} singular="Operação" plural="Operações" description="Cadastre, inative ou reative operações disponíveis nos novos lançamentos." items={operations} search={search} setSearch={setSearch} onEdit={editNamed} />}
      {section === 'SUPERVISORES' && <NamedPanel loading={loading} singular="Supervisor" plural="Supervisores" description="Cadastre, inative ou reative supervisores disponíveis nos novos lançamentos." items={supervisors} search={search} setSearch={setSearch} onEdit={editNamed} />}
      {section === 'FUNCOES' && <NamedPanel loading={loading} singular="Função" plural="Funções" description="Funções usadas em mão de obra e nas tabelas de preço. Inativar preserva o histórico existente." items={functions} search={search} setSearch={setSearch} onEdit={editNamed} />}
      {section === 'ATIVIDADES' && <NamedPanel loading={loading} singular="Atividade" plural="Atividades" description="Atividades operacionais disponíveis nos lançamentos. Inativar não apaga solicitações antigas." items={activities} search={search} setSearch={setSearch} onEdit={editNamed} />}
      {section === 'FERIADOS' && <HolidayPanel loading={loading} items={holidays} search={search} setSearch={setSearch} onEdit={editHoliday} />}
      {section === 'METAS' && <GoalPanel loading={loading} items={goals} search={search} setSearch={setSearch} onEdit={editGoal} />}
      {section === 'FORNECEDORES' && <ProviderPanel loading={loading} items={providers} search={search} setSearch={setSearch} onEdit={editProvider} />}
      {section === 'PRODUTOS' && <ProductPanel loading={loading} items={products} search={search} setSearch={setSearch} onEdit={editProduct} />}
      {section === 'PRECOS_MO' && <LaborPricePanel loading={loading} items={laborPriceRows} search={search} setSearch={setSearch} onVersion={openLaborVersion} pagination={pricePagination} onPage={setPricePage} />}
      {section === 'PRECOS_PRODUTOS' && <ProductPricePanel loading={loading} items={productPriceRows} search={search} setSearch={setSearch} onVersion={openProductPriceVersion} pagination={pricePagination} onPage={setPricePage} />}

      <Modal
        open={editorOpen}
        titleId="catalog-editor-title"
        eyebrow={modalEyebrow(section, editingExisting, reactivatingPrice)}
        title={modalTitle(section, editingExisting, namedDraft, holidayDraft, goalDraft, providerDraft, catalogProductDraft, reactivatingPrice)}
        description={modalDescription(section, reactivatingPrice)}
        onClose={closeEditor}
        busy={saving}
        width="medium"
        bodyClassName="catalog-editor-modal-body nx-catalog-editor"
        footer={
          <>
            <Button label="Cancelar" text onClick={closeEditor} disabled={saving} />
            <Button
              label={saving ? 'Salvando…' : saveButtonLabel(section, editingExisting, reactivatingPrice)}
              icon={saving ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
              onClick={() => void handleSave()}
              disabled={saving}
              className="nx-primary-button"
            />
          </>
        }
      >
        <div className="catalog-editor-form nx-catalog-form-stack">
          {editorError && <Message severity="error" text={editorError} className="nx-catalog-message" />}
          {isNamedSection(section) && <NamedForm label={namedSectionLabel(section)} draft={namedDraft} setDraft={setNamedDraft} editingExisting={editingExisting} />}
          {section === 'FERIADOS' && <HolidayForm draft={holidayDraft} setDraft={setHolidayDraft} editingExisting={editingExisting} />}
          {section === 'METAS' && <GoalForm draft={goalDraft} setDraft={setGoalDraft} editingExisting={editingExisting} />}
          {section === 'FORNECEDORES' && <ProviderForm draft={providerDraft} setDraft={setProviderDraft} editingExisting={editingExisting} />}
          {section === 'PRODUTOS' && <ProductForm draft={catalogProductDraft} setDraft={setCatalogProductDraft} editingExisting={editingExisting} />}
          {section === 'PRECOS_MO' && <LaborPriceForm draft={laborDraft} setDraft={setLaborDraft} functions={activeFunctions} providers={laborProviders} />}
          {section === 'PRECOS_PRODUTOS' && <ProductPriceForm draft={productPriceDraft} setDraft={setProductPriceDraft} products={productRows} providers={foodProviders} />}
        </div>
      </Modal>
    </div>
  )
}

function CatalogSearch({ value, onChange, placeholder, label }: { value: string; onChange: (value: string) => void; placeholder: string; label: string }) {
  return <div className="nx-catalog-toolbar"><SearchField value={value} onChange={onChange} placeholder={placeholder} ariaLabel={label} /></div>
}

function CatalogTableShell({ loading, empty, children }: { loading: boolean; empty: React.ReactNode; children: React.ReactNode }) {
  if (loading) return <Skeleton lines={7} />
  return <>{children || empty}</>
}

function PricePagination({ pagination, onPage }: { pagination: CatalogAdminPaginationDto | null; onPage: (page: number) => void }) {
  if (!pagination?.paginado) return null
  return (
    <Paginator
      first={(pagination.pagina - 1) * pagination.tamanhoPagina}
      rows={pagination.tamanhoPagina}
      totalRecords={pagination.total}
      onPageChange={(event) => onPage(event.page + 1)}
      template="CurrentPageReport PrevPageLink PageLinks NextPageLink"
      currentPageReportTemplate="{first}–{last} de {totalRecords}"
      className="nx-catalog-paginator"
    />
  )
}

function NamedPanel({ loading, singular, plural, description, items, search, setSearch, onEdit }: { loading: boolean; singular: string; plural: string; description: string; items: CatalogoAdminNomeDto[]; search: string; setSearch: (value: string) => void; onEdit: (item: CatalogoAdminNomeDto) => void }) {
  return (
    <Panel className="catalog-provider-list nx-catalog-panel">
      <PanelHeader eyebrow={plural.toUpperCase()} title={`Cadastro de ${plural.toLowerCase()}`} description={description} />
      <CatalogSearch value={search} onChange={setSearch} placeholder={`Buscar ${plural.toLowerCase()}…`} label={`Buscar ${plural.toLowerCase()}`} />
      {loading ? <Skeleton lines={7} /> : items.length ? (
        <DataTable value={items} dataKey="nome" responsiveLayout="scroll" rowHover stripedRows className="nx-prime-table nx-catalog-table">
          <Column field="nome" header={singular} sortable body={(item: CatalogoAdminNomeDto) => <strong>{item.nome}</strong>} />
          <Column header="Status" body={(item: CatalogoAdminNomeDto) => <StatusBadge active={item.ativo} />} style={{ width: '9rem' }} />
          <Column header="Ação" body={(item: CatalogoAdminNomeDto) => <CatalogAction label={item.ativo ? 'Editar' : 'Reativar'} icon={item.ativo ? 'pi pi-pencil' : 'pi pi-refresh'} onClick={() => onEdit(item)} />} style={{ width: '10rem' }} />
        </DataTable>
      ) : <EmptyState title="Nenhum cadastro encontrado" description="Ajuste a busca ou cadastre um novo item." />}
    </Panel>
  )
}

function HolidayPanel({ loading, items, search, setSearch, onEdit }: { loading: boolean; items: FeriadoAdminDto[]; search: string; setSearch: (value: string) => void; onEdit: (item: FeriadoAdminDto) => void }) {
  return (
    <Panel className="catalog-provider-list nx-catalog-panel">
      <PanelHeader eyebrow="CALENDÁRIO" title="Feriados" description="Calendário usado na classificação de dias para precificação. Registros inativos permanecem preservados." />
      <CatalogSearch value={search} onChange={setSearch} placeholder="Buscar data, feriado ou fonte…" label="Buscar feriados" />
      {loading ? <Skeleton lines={7} /> : items.length ? (
        <DataTable value={items} dataKey="data" responsiveLayout="scroll" rowHover stripedRows className="nx-prime-table nx-catalog-table">
          <Column field="data" header="Data" sortable body={(item: FeriadoAdminDto) => <strong>{dateLabel(item.data)}</strong>} />
          <Column field="denominacao" header="Denominação" sortable />
          <Column header="Município/UF" body={(item: FeriadoAdminDto) => `${item.municipio}/${item.uf}`} />
          <Column field="fonte" header="Fonte" body={(item: FeriadoAdminDto) => item.fonte || '—'} />
          <Column header="Status" body={(item: FeriadoAdminDto) => <StatusBadge active={item.ativo} />} />
          <Column header="Ação" body={(item: FeriadoAdminDto) => <CatalogAction label={item.ativo ? 'Editar' : 'Reativar'} icon={item.ativo ? 'pi pi-pencil' : 'pi pi-refresh'} onClick={() => onEdit(item)} />} />
        </DataTable>
      ) : <EmptyState title="Nenhum feriado cadastrado" description="Cadastre as datas que devem ser tratadas como feriado." />}
    </Panel>
  )
}

function GoalPanel({ loading, items, search, setSearch, onEdit }: { loading: boolean; items: MetaMaoObraAdminDto[]; search: string; setSearch: (value: string) => void; onEdit: (item: MetaMaoObraAdminDto) => void }) {
  return (
    <Panel className="catalog-provider-list nx-catalog-panel">
      <PanelHeader eyebrow="PLANEJAMENTO" title="Metas de mão de obra" description="Meta global por competência usada pela Visão Geral. Editar uma competência atualiza o valor consumido pelo Dashboard." />
      <CatalogSearch value={search} onChange={setSearch} placeholder="Buscar competência ou valor…" label="Buscar metas" />
      {loading ? <Skeleton lines={7} /> : items.length ? (
        <DataTable value={items} dataKey="competencia" responsiveLayout="scroll" rowHover stripedRows className="nx-prime-table nx-catalog-table">
          <Column field="competencia" header="Competência" sortable body={(item: MetaMaoObraAdminDto) => <strong>{competenceLabel(item.competencia)}</strong>} />
          <Column field="valor" header="Meta MO" sortable body={(item: MetaMaoObraAdminDto) => <strong>{money(item.valor)}</strong>} />
          <Column header="Ação" body={(item: MetaMaoObraAdminDto) => <CatalogAction label="Editar" onClick={() => onEdit(item)} />} style={{ width: '10rem' }} />
        </DataTable>
      ) : <EmptyState title="Nenhuma meta cadastrada" description="Cadastre a meta de mão de obra por competência." />}
    </Panel>
  )
}

function ProviderPanel({ loading, items, search, setSearch, onEdit }: { loading: boolean; items: FornecedorAdminDto[]; search: string; setSearch: (value: string) => void; onEdit: (item: FornecedorAdminDto) => void }) {
  return (
    <Panel className="catalog-provider-list nx-catalog-panel">
      <PanelHeader eyebrow="FORNECEDORES" title="Fornecedores e contato" description="Inative registros em vez de excluir. Fornecedores inativos deixam de aparecer também nas tabelas de preço até serem reativados." />
      <CatalogSearch value={search} onChange={setSearch} placeholder="Buscar fornecedor ou destino…" label="Buscar fornecedores" />
      {loading ? <Skeleton lines={7} /> : items.length ? (
        <DataTable value={items} dataKey="nome" responsiveLayout="scroll" rowHover stripedRows className="nx-prime-table nx-catalog-table">
          <Column field="nome" header="Fornecedor" sortable body={(item: FornecedorAdminDto) => <strong>{item.nome}</strong>} />
          <Column header="Atendimento" body={(item: FornecedorAdminDto) => <div className="nx-catalog-badges">{item.maoDeObra && <Badge>Mão de obra</Badge>}{item.alimentacao && <Badge>Alimentação</Badge>}</div>} />
          <Column header="WhatsApp" body={(item: FornecedorAdminDto) => destinationLabel(item)} />
          <Column header="Status" body={(item: FornecedorAdminDto) => <StatusBadge active={item.ativo} />} />
          <Column header="Ação" body={(item: FornecedorAdminDto) => <CatalogAction label={item.ativo ? 'Editar' : 'Reativar'} icon={item.ativo ? 'pi pi-pencil' : 'pi pi-refresh'} onClick={() => onEdit(item)} />} />
        </DataTable>
      ) : <EmptyState title="Nenhum fornecedor encontrado" description="Ajuste a busca ou cadastre um novo fornecedor." />}
    </Panel>
  )
}

function ProductPanel({ loading, items, search, setSearch, onEdit }: { loading: boolean; items: ProdutoAdminDto[]; search: string; setSearch: (value: string) => void; onEdit: (item: ProdutoAdminDto) => void }) {
  return (
    <Panel className="catalog-provider-list nx-catalog-panel">
      <PanelHeader eyebrow="CATÁLOGO" title="Produtos" description="Produtos vinculados a fornecedores de alimentação ativos. Reativar produto não altera histórico de preços." />
      <CatalogSearch value={search} onChange={setSearch} placeholder="Buscar produto ou categoria…" label="Buscar produtos" />
      {loading ? <Skeleton lines={7} /> : items.length ? (
        <DataTable value={items} dataKey="nome" responsiveLayout="scroll" rowHover stripedRows className="nx-prime-table nx-catalog-table">
          <Column field="nome" header="Produto" sortable body={(item: ProdutoAdminDto) => <strong>{item.nome}</strong>} />
          <Column field="categoria" header="Categoria" sortable body={(item: ProdutoAdminDto) => categoryLabel(item.categoria)} />
          <Column header="Status" body={(item: ProdutoAdminDto) => <StatusBadge active={item.ativo} />} />
          <Column header="Ação" body={(item: ProdutoAdminDto) => <CatalogAction label={item.ativo ? 'Editar' : 'Reativar'} icon={item.ativo ? 'pi pi-pencil' : 'pi pi-refresh'} onClick={() => onEdit(item)} />} />
        </DataTable>
      ) : <EmptyState title="Nenhum produto encontrado" description="Ajuste a busca ou cadastre um novo produto." />}
    </Panel>
  )
}

function LaborPricePanel({ loading, items, search, setSearch, onVersion, pagination, onPage }: { loading: boolean; items: PrecoMaoObraAdminDto[]; search: string; setSearch: (value: string) => void; onVersion: (item: PrecoMaoObraAdminDto, reactivate?: boolean) => void; pagination: CatalogAdminPaginationDto | null; onPage: (page: number) => void }) {
  return (
    <Panel className="catalog-provider-list nx-catalog-panel">
      <PanelHeader eyebrow="TABELA VERSIONADA" title="Preços de mão de obra" description="Somente preços de fornecedores ativos e habilitados para mão de obra são exibidos. O histórico reaparece automaticamente se o fornecedor for reativado." />
      <CatalogSearch value={search} onChange={setSearch} placeholder="Buscar fornecedor, função, turno…" label="Buscar preços de mão de obra" />
      {loading ? <Skeleton lines={7} /> : items.length ? (
        <>
          <DataTable value={items} responsiveLayout="scroll" rowHover stripedRows className="nx-prime-table nx-catalog-table nx-catalog-price-table">
            <Column field="fornecedor" header="Fornecedor" sortable body={(item: PrecoMaoObraAdminDto) => <strong>{item.fornecedor}</strong>} />
            <Column field="funcao" header="Função" sortable />
            <Column field="turno" header="Turno" sortable />
            <Column field="tipoDia" header="Tipo de dia" body={(item: PrecoMaoObraAdminDto) => dayTypeLabel(item.tipoDia)} />
            <Column header="Vigência" body={(item: PrecoMaoObraAdminDto) => `${dateLabel(item.vigenciaInicio)} → ${dateLabel(item.vigenciaFim)}`} />
            <Column field="precoUnitario" header="Preço" sortable body={(item: PrecoMaoObraAdminDto) => <strong>{money(item.precoUnitario)}</strong>} />
            <Column header="Status" body={(item: PrecoMaoObraAdminDto) => { const status = priceStatus(item); return <Badge tone={status.tone}>{status.label}</Badge> }} />
            <Column header="Ação" body={(item: PrecoMaoObraAdminDto) => item.ativo && !item.vigenciaFim ? <CatalogAction label="Nova vigência" icon="pi pi-plus" onClick={() => onVersion(item)} /> : !item.ativo ? <CatalogAction label="Reativar" icon="pi pi-refresh" onClick={() => onVersion(item, true)} /> : null} />
          </DataTable>
          <PricePagination pagination={pagination} onPage={onPage} />
        </>
      ) : <EmptyState title="Nenhum preço de mão de obra encontrado" description="Não há preços visíveis para fornecedores ativos no filtro atual." />}
    </Panel>
  )
}

function ProductPricePanel({ loading, items, search, setSearch, onVersion, pagination, onPage }: { loading: boolean; items: PrecoProdutoAdminDto[]; search: string; setSearch: (value: string) => void; onVersion: (item: PrecoProdutoAdminDto, reactivate?: boolean) => void; pagination: CatalogAdminPaginationDto | null; onPage: (page: number) => void }) {
  return (
    <Panel className="catalog-provider-list nx-catalog-panel">
      <PanelHeader eyebrow="TABELA VERSIONADA" title="Preços de produtos" description="Somente preços de fornecedores ativos e habilitados para alimentação são exibidos. O histórico reaparece automaticamente se o fornecedor for reativado." />
      <CatalogSearch value={search} onChange={setSearch} placeholder="Buscar fornecedor, produto, categoria…" label="Buscar preços de produtos" />
      {loading ? <Skeleton lines={7} /> : items.length ? (
        <>
          <DataTable value={items} responsiveLayout="scroll" rowHover stripedRows className="nx-prime-table nx-catalog-table nx-catalog-price-table">
            <Column field="fornecedor" header="Fornecedor" sortable body={(item: PrecoProdutoAdminDto) => <strong>{item.fornecedor}</strong>} />
            <Column field="produto" header="Produto" sortable />
            <Column field="categoria" header="Categoria" body={(item: PrecoProdutoAdminDto) => categoryLabel(item.categoria)} />
            <Column header="Vigência" body={(item: PrecoProdutoAdminDto) => `${dateLabel(item.vigenciaInicio)} → ${dateLabel(item.vigenciaFim)}`} />
            <Column field="precoUnitario" header="Preço" sortable body={(item: PrecoProdutoAdminDto) => <strong>{money(item.precoUnitario)}</strong>} />
            <Column header="Status" body={(item: PrecoProdutoAdminDto) => { const status = priceStatus(item); return <Badge tone={status.tone}>{status.label}</Badge> }} />
            <Column header="Ação" body={(item: PrecoProdutoAdminDto) => item.ativo && !item.vigenciaFim ? <CatalogAction label="Nova vigência" icon="pi pi-plus" onClick={() => onVersion(item)} /> : !item.ativo ? <CatalogAction label="Reativar" icon="pi pi-refresh" onClick={() => onVersion(item, true)} /> : null} />
          </DataTable>
          <PricePagination pagination={pagination} onPage={onPage} />
        </>
      ) : <EmptyState title="Nenhum preço de produto encontrado" description="Não há preços visíveis para fornecedores ativos no filtro atual." />}
    </Panel>
  )
}

function modalEyebrow(section: CatalogSection, editing: boolean, reactivating: boolean) {
  if (isNamedSection(section)) return editing ? `EDIÇÃO DE ${namedSectionLabel(section).toUpperCase()}` : `NOV${section === 'FUNCOES' || section === 'ATIVIDADES' || section === 'OPERACOES' ? 'A' : 'O'} ${namedSectionLabel(section).toUpperCase()}`
  if (section === 'FERIADOS') return editing ? 'EDIÇÃO DE FERIADO' : 'NOVO FERIADO'
  if (section === 'METAS') return editing ? 'EDIÇÃO DE META' : 'NOVA META'
  if (section === 'FORNECEDORES') return editing ? 'EDIÇÃO DE FORNECEDOR' : 'NOVO FORNECEDOR'
  if (section === 'PRODUTOS') return editing ? 'EDIÇÃO DE PRODUTO' : 'NOVO PRODUTO'
  return reactivating ? 'REATIVAÇÃO POR NOVA VIGÊNCIA' : 'NOVA VIGÊNCIA'
}

function modalTitle(section: CatalogSection, editing: boolean, named: NamedDraft, holiday: HolidayDraft, goal: GoalDraft, provider: ProviderDraft, product: ProductDraft, reactivating: boolean) {
  if (isNamedSection(section)) return editing ? named.nome || `Editar ${namedSectionLabel(section).toLowerCase()}` : `Cadastrar ${namedSectionLabel(section).toLowerCase()}`
  if (section === 'FERIADOS') return editing ? holiday.denominacao || 'Editar feriado' : 'Cadastrar feriado'
  if (section === 'METAS') return editing ? `Meta ${competenceLabel(goal.competencia)}` : 'Cadastrar meta de mão de obra'
  if (section === 'FORNECEDORES') return editing ? provider.nome || 'Editar fornecedor' : 'Cadastrar fornecedor'
  if (section === 'PRODUTOS') return editing ? product.nome || 'Editar produto' : 'Cadastrar produto'
  if (section === 'PRECOS_MO') return reactivating ? 'Reativar preço de mão de obra' : 'Preço de mão de obra'
  return reactivating ? 'Reativar preço de produto' : 'Preço de produto'
}

function modalDescription(section: CatalogSection, reactivating: boolean) {
  if (isNamedSection(section)) return 'O status controla a disponibilidade em novos lançamentos sem apagar referências históricas.'
  if (section === 'FERIADOS') return 'O calendário ativo é utilizado pela regra de classificação de feriados.'
  if (section === 'METAS') return 'A meta é global por competência e alimenta os indicadores de mão de obra do Dashboard.'
  if (section === 'FORNECEDORES') return 'Configure elegibilidade, status e destino de WhatsApp.'
  if (section === 'PRODUTOS') return 'Defina categoria e status. Reativar o produto não altera preços históricos.'
  if (reactivating) return 'Será criada uma nova linha de vigência; o registro anterior permanece preservado.'
  return 'A nova vigência encerra automaticamente a anterior do mesmo vínculo.'
}

function saveButtonLabel(section: CatalogSection, editing: boolean, reactivating: boolean) {
  if (!isPriceSection(section)) return editing ? 'Salvar alterações' : 'Cadastrar'
  return reactivating ? 'Criar reativação' : 'Criar vigência'
}

function CatalogField({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="nx-catalog-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

function ActiveField({ active, onChange }: { active: boolean; onChange: (active: boolean) => void }) {
  return (
    <label className="nx-catalog-field nx-catalog-switch-field">
      <span>Status</span>
      <div className="nx-catalog-switch-row">
        <InputSwitch checked={active} onChange={(event) => onChange(Boolean(event.value))} />
        <strong>{active ? 'Ativo' : 'Inativo'}</strong>
      </div>
    </label>
  )
}

function NamedForm({ label, draft, setDraft, editingExisting }: { label: string; draft: NamedDraft; setDraft: Dispatch<SetStateAction<NamedDraft>>; editingExisting: boolean }) {
  return (
    <div className="nx-catalog-form-grid">
      <CatalogField label={label}>
        <InputText value={draft.nome} disabled={editingExisting} onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value }))} />
      </CatalogField>
      <ActiveField active={draft.ativo} onChange={(ativo) => setDraft((current) => ({ ...current, ativo }))} />
    </div>
  )
}

function HolidayForm({ draft, setDraft, editingExisting }: { draft: HolidayDraft; setDraft: Dispatch<SetStateAction<HolidayDraft>>; editingExisting: boolean }) {
  return (
    <div className="nx-catalog-form-stack">
      <div className="nx-catalog-form-grid">
        <CatalogField label="Data"><InputText type="date" value={draft.data} disabled={editingExisting} onChange={(event) => setDraft((current) => ({ ...current, data: event.target.value }))} /></CatalogField>
        <ActiveField active={draft.ativo} onChange={(ativo) => setDraft((current) => ({ ...current, ativo }))} />
      </div>
      <CatalogField label="Denominação"><InputText value={draft.denominacao} onChange={(event) => setDraft((current) => ({ ...current, denominacao: event.target.value }))} placeholder="Ex.: Independência do Brasil" /></CatalogField>
      <div className="nx-catalog-form-grid">
        <CatalogField label="Município"><InputText value={draft.municipio} onChange={(event) => setDraft((current) => ({ ...current, municipio: event.target.value }))} /></CatalogField>
        <CatalogField label="UF"><InputText value={draft.uf} maxLength={2} onChange={(event) => setDraft((current) => ({ ...current, uf: event.target.value.toUpperCase() }))} /></CatalogField>
      </div>
      <CatalogField label="Fonte"><InputText value={draft.fonte} onChange={(event) => setDraft((current) => ({ ...current, fonte: event.target.value }))} placeholder="Decreto, lei ou fonte oficial" /></CatalogField>
    </div>
  )
}

function GoalForm({ draft, setDraft, editingExisting }: { draft: GoalDraft; setDraft: Dispatch<SetStateAction<GoalDraft>>; editingExisting: boolean }) {
  return (
    <div className="nx-catalog-form-grid">
      <CatalogField label="Competência"><InputText type="month" value={draft.competencia} disabled={editingExisting} onChange={(event) => setDraft((current) => ({ ...current, competencia: event.target.value }))} /></CatalogField>
      <CatalogField label="Meta de mão de obra"><InputText type="number" min="0.01" step="0.01" inputMode="decimal" value={draft.valor} onChange={(event) => setDraft((current) => ({ ...current, valor: event.target.value }))} placeholder="0,00" /></CatalogField>
    </div>
  )
}

function ProviderForm({ draft, setDraft, editingExisting }: { draft: ProviderDraft; setDraft: Dispatch<SetStateAction<ProviderDraft>>; editingExisting: boolean }) {
  return (
    <div className="nx-catalog-form-stack">
      <div className="nx-catalog-form-grid">
        <CatalogField label="Fornecedor"><InputText value={draft.nome} disabled={editingExisting} onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value }))} /></CatalogField>
        <ActiveField active={draft.ativo} onChange={(ativo) => setDraft((current) => ({ ...current, ativo }))} />
      </div>
      <div className="nx-catalog-checkbox-grid">
        <label className="nx-catalog-check">
          <Checkbox inputId="provider-labor" checked={draft.maoDeObra} onChange={(event) => setDraft((current) => ({ ...current, maoDeObra: Boolean(event.checked) }))} />
          <span>Atende mão de obra</span>
        </label>
        <label className="nx-catalog-check">
          <Checkbox inputId="provider-food" checked={draft.alimentacao} onChange={(event) => setDraft((current) => ({ ...current, alimentacao: Boolean(event.checked) }))} />
          <span>Atende alimentação</span>
        </label>
      </div>
      <div className="nx-catalog-form-grid">
        <CatalogField label="Destino WhatsApp">
          <Dropdown value={draft.whatsappDestino} options={WHATSAPP_OPTIONS} onChange={(event) => setDraft((current) => ({ ...current, whatsappDestino: event.value as WhatsappDestino }))} />
        </CatalogField>
        {draft.whatsappDestino === 'NUMERO' && <CatalogField label="Número"><InputText value={draft.whatsappNumero} onChange={(event) => setDraft((current) => ({ ...current, whatsappNumero: event.target.value }))} placeholder="5527999999999" /></CatalogField>}
        {draft.whatsappDestino === 'GRUPO' && <CatalogField label="Link do grupo"><InputText value={draft.whatsappGrupoLink} onChange={(event) => setDraft((current) => ({ ...current, whatsappGrupoLink: event.target.value }))} placeholder="https://chat.whatsapp.com/..." /></CatalogField>}
      </div>
    </div>
  )
}

function ProductForm({ draft, setDraft, editingExisting }: { draft: ProductDraft; setDraft: Dispatch<SetStateAction<ProductDraft>>; editingExisting: boolean }) {
  return (
    <div className="nx-catalog-form-grid">
      <CatalogField label="Produto"><InputText value={draft.nome} disabled={editingExisting} onChange={(event) => setDraft((current) => ({ ...current, nome: event.target.value }))} /></CatalogField>
      <CatalogField label="Categoria"><Dropdown value={draft.categoria} options={CATEGORY_OPTIONS} onChange={(event) => setDraft((current) => ({ ...current, categoria: event.value as CategoriaProduto }))} /></CatalogField>
      <ActiveField active={draft.ativo} onChange={(ativo) => setDraft((current) => ({ ...current, ativo }))} />
    </div>
  )
}

function LaborPriceForm({ draft, setDraft, functions, providers }: { draft: LaborPriceDraft; setDraft: Dispatch<SetStateAction<LaborPriceDraft>>; functions: CatalogoAdminNomeDto[]; providers: FornecedorAdminDto[] }) {
  return (
    <div className="nx-catalog-form-stack">
      <div className="nx-catalog-form-grid">
        <CatalogField label="Fornecedor"><Dropdown value={draft.fornecedor} options={namedOptions(providers)} onChange={(event) => setDraft((current) => ({ ...current, fornecedor: event.value || '' }))} filter /></CatalogField>
        <CatalogField label="Função"><Dropdown value={draft.funcao} options={namedOptions(functions)} onChange={(event) => setDraft((current) => ({ ...current, funcao: event.value || '' }))} filter /></CatalogField>
      </div>
      <div className="nx-catalog-form-grid">
        <CatalogField label="Turno"><Dropdown value={draft.turno} options={TURN_OPTIONS} onChange={(event) => setDraft((current) => ({ ...current, turno: event.value as 'DIURNO' | 'NOTURNO' }))} /></CatalogField>
        <CatalogField label="Tipo de dia"><Dropdown value={draft.tipoDia} options={DAY_TYPE_OPTIONS} onChange={(event) => setDraft((current) => ({ ...current, tipoDia: event.value as TipoDia }))} /></CatalogField>
      </div>
      <div className="nx-catalog-form-grid">
        <CatalogField label="Início da vigência"><InputText type="date" value={draft.vigenciaInicio} onChange={(event) => setDraft((current) => ({ ...current, vigenciaInicio: event.target.value }))} /></CatalogField>
        <CatalogField label="Preço unitário"><InputText type="number" min="0.01" step="0.01" inputMode="decimal" value={draft.precoUnitario} onChange={(event) => setDraft((current) => ({ ...current, precoUnitario: event.target.value }))} placeholder="0,00" /></CatalogField>
      </div>
    </div>
  )
}

function ProductPriceForm({ draft, setDraft, products, providers }: { draft: ProductPriceDraft; setDraft: Dispatch<SetStateAction<ProductPriceDraft>>; products: ProdutoAdminDto[]; providers: FornecedorAdminDto[] }) {
  const productOptions = [{ label: 'Selecione', value: '' }, ...products.filter((item) => item.ativo).map((item) => ({ label: `${item.nome} · ${categoryLabel(item.categoria)}`, value: item.nome }))]
  return (
    <div className="nx-catalog-form-stack">
      <div className="nx-catalog-form-grid">
        <CatalogField label="Fornecedor"><Dropdown value={draft.fornecedor} options={namedOptions(providers)} onChange={(event) => setDraft((current) => ({ ...current, fornecedor: event.value || '' }))} filter /></CatalogField>
        <CatalogField label="Produto"><Dropdown value={draft.produto} options={productOptions} onChange={(event) => setDraft((current) => ({ ...current, produto: event.value || '' }))} filter /></CatalogField>
      </div>
      <div className="nx-catalog-form-grid">
        <CatalogField label="Início da vigência"><InputText type="date" value={draft.vigenciaInicio} onChange={(event) => setDraft((current) => ({ ...current, vigenciaInicio: event.target.value }))} /></CatalogField>
        <CatalogField label="Preço unitário"><InputText type="number" min="0.01" step="0.01" inputMode="decimal" value={draft.precoUnitario} onChange={(event) => setDraft((current) => ({ ...current, precoUnitario: event.target.value }))} placeholder="0,00" /></CatalogField>
      </div>
    </div>
  )
}
