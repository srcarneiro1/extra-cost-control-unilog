import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from 'primereact/button'
import { Message } from 'primereact/message'
import { PageHeader } from '@/components/PageHeader'
import { Modal } from '@/components/ui/Modal'
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
import { CatalogAdminNavigation } from '@/features/catalogs/administrative/CatalogAdminNavigation'
import { GoalPanel, HolidayPanel, LaborPricePanel, NamedPanel, ProductPanel, ProductPricePanel, ProviderPanel } from '@/features/catalogs/administrative/CatalogAdminPanels'
import { GoalForm, HolidayForm, LaborPriceForm, NamedForm, ProductForm, ProductPriceForm, ProviderForm } from '@/features/catalogs/administrative/CatalogAdminForms'
import { modalDescription, modalEyebrow, modalTitle, pageActionLabel, saveButtonLabel } from '@/features/catalogs/administrative/catalogAdminEditorPresentation'

import {
  destinationLabel,
  isNamedSection,
  isPriceSection,
  namedSectionLabel,
} from '@/features/catalogs/administrative/catalogAdminPresentation'

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

  const currentPageActionLabel = pageActionLabel(section)

  return (
    <div className="catalog-page nx-modern-page nx-catalog-page">
      <PageHeader
        eyebrow="ADMINISTRAÇÃO"
        title="Cadastros"
        description="Mantenha catálogos operacionais, feriados, metas, fornecedores, produtos e tabelas de preço em uma única área administrativa."
        actions={<Button label={currentPageActionLabel} icon="pi pi-plus" onClick={openNew} className="nx-primary-button" />}
      />

      {notice && <Message severity="success" text={notice} className="nx-catalog-message" />}
      {loadError && <Message severity="error" text={loadError} className="nx-catalog-message" />}

      <CatalogAdminSummary summary={summary} />

      <CatalogAdminNavigation section={section} onChange={changeSection} />

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
