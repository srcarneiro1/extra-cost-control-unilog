import { useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { SolicitationCorrectionModal } from '@/features/solicitations/administrative/SolicitationCorrectionModal'
import { SolicitationDetailModal } from '@/features/solicitations/administrative/SolicitationDetailModal'
import { AdminSolicitationsTable } from '@/features/solicitations/administrative/AdminSolicitationsTable'
import { AdminSolicitationsFilters } from '@/features/solicitations/administrative/AdminSolicitationsFilters'
import { AdminSolicitationDeleteModal } from '@/features/solicitations/administrative/AdminSolicitationDeleteModal'
import { AdminSolicitationsSummary } from '@/features/solicitations/administrative/AdminSolicitationsSummary'
import { AdminSolicitationsNotice, type AdminSolicitationsNoticeValue } from '@/features/solicitations/administrative/AdminSolicitationsNotice'
import { AdminSolicitationsPagination } from '@/features/solicitations/administrative/AdminSolicitationsPagination'
import { copyTextToClipboard, navigateExternalWindow, reserveExternalWindow } from '@/features/solicitations/administrative/whatsappSharing'
import {
  Chip,
  EmptyState,
  Panel,
  PanelHeader,
  Skeleton,
} from '@/components/ui/Primitives'
import { fetchCatalogos } from '@/services/catalogService'
import {
  deleteAdministrativeSolicitation,
  fetchAdministrativeSolicitationDetail,
  fetchAdministrativeSolicitationMetadata,
  fetchAdministrativeSolicitations,
  updateAdministrativeSolicitationStatus,
} from '@/services/solicitationService'
import type { CatalogosDto } from '@/types/catalog'
import {
  allPageSizeOptions,
  buildSupplierSummary,
  currentPeriod,
  formatDate,
  monthLabels,
  statusFilterOptions,
} from '@/features/solicitations/administrative/solicitationPresentation'
import type {
  AdministrativeSolicitationDetail,
  AdministrativeSolicitationListItem,
  AdministrativeSolicitationMetadata,
  AdministrativeSolicitationSummary,
  AdministrativeTransitionStatus,
  SolicitationStatus,
} from '@/types/solicitation'

const BACKGROUND_REVALIDATION_MS = 90 * 1000
// Agrupa várias ações seguidas numa única recarga em segundo plano, liberando o
// Apps Script para atender o próximo clique do usuário primeiro.
const POST_MUTATION_REFRESH_DELAY_MS = 2500
const DETAIL_CACHE_FRESH_MS = 30 * 1000
const DETAIL_PREFETCH_DELAY_MS = 120

type Props = { canAdminister: boolean }

export function AdminSolicitationsPageCurrentPeriod({ canAdminister }: Props) {
  const initialPeriod = useMemo(currentPeriod, [])
  const [items, setItems] = useState<AdministrativeSolicitationListItem[]>([])
  const [detail, setDetail] = useState<AdministrativeSolicitationDetail | null>(null)
  const [catalogs, setCatalogs] = useState<CatalogosDto | null>(null)
  const [metadata, setMetadata] = useState<AdministrativeSolicitationMetadata | null>(null)
  const [periodSummary, setPeriodSummary] = useState<AdministrativeSolicitationSummary | null>(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('TODOS')
  const [statusFilter, setStatusFilter] = useState('TODOS')
  const [registrationYear, setRegistrationYear] = useState(initialPeriod.year)
  const [registrationMonth, setRegistrationMonth] = useState(initialPeriod.month)
  const [registrationDate, setRegistrationDate] = useState('TODOS')
  const [pageSize, setPageSize] = useState(20)
  const [currentPage, setCurrentPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [quickLoading, setQuickLoading] = useState<string | null>(null)
  const [quickActionKey, setQuickActionKey] = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdministrativeSolicitationListItem | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [notice, setNotice] = useState<AdminSolicitationsNoticeValue | null>(null)
  const [workflowOpen, setWorkflowOpen] = useState(false)
  const [correctionOpen, setCorrectionOpen] = useState(false)

  const detailCacheRef = useRef(new Map<string, AdministrativeSolicitationDetail>())
  const detailCacheTimeRef = useRef(new Map<string, number>())
  const detailRequestsRef = useRef(new Map<string, Promise<AdministrativeSolicitationDetail>>())
  const detailIntentTimerRef = useRef<number | null>(null)
  const activeDetailRequestRef = useRef(0)
  const catalogRequestRef = useRef<Promise<CatalogosDto> | null>(null)
  const listRequestRef = useRef(0)
  const pendingRefreshTimerRef = useRef<number | null>(null)
  const pendingDetailRefreshRef = useRef(new Set<string>())
  const workflowOpenRef = useRef(false)
  const correctionOpenRef = useRef(false)
  workflowOpenRef.current = workflowOpen
  correctionOpenRef.current = correctionOpen
  // Sempre aponta para as funções/estado da renderização mais recente, para que
  // a recarga adiada use os filtros atuais (e não os do momento do clique).
  const latestRef = useRef<{
    listQuery: () => ReturnType<typeof listQuery>
    applyListResponse: (response: Awaited<ReturnType<typeof fetchAdministrativeSolicitations>>) => void
    refreshDetail: (idSolicitacao: string) => Promise<AdministrativeSolicitationDetail>
    invalidateDetailCache: (idSolicitacao: string) => void
    openDetailId: string | null
  } | null>(null)

  function notify(tone: AdminSolicitationsNoticeValue['tone'], message: string) {
    setNotice({ tone, message })
  }

  function listQuery(page = currentPage) {
    return {
      pagina: page,
      tamanhoPagina: pageSize,
      busca: debouncedSearch,
      tipo: typeFilter,
      status: statusFilter,
      anoRegistro: registrationYear,
      mesRegistro: registrationMonth,
      dataRegistro: registrationDate,
    }
  }

  function applyListResponse(response: Awaited<ReturnType<typeof fetchAdministrativeSolicitations>>) {
    setItems(response.itens)
    setTotal(response.total)
    if (response.resumo) setPeriodSummary(response.resumo)
  }

  async function refreshItems(force = false) {
    const response = await fetchAdministrativeSolicitations(listQuery(), undefined, force ? { force: true } : undefined)
    applyListResponse(response)
  }

  /**
   * Agenda uma única recarga (lista + detalhes abertos) depois de mutações.
   * Ações seguidas dentro da janela reiniciam o timer e geram uma só recarga.
   * O detalhe só é recarregado se o modal ainda estiver aberto naquela solicitação;
   * caso contrário apenas o cache local é invalidado (recarrega ao abrir).
   */
  function scheduleBackgroundRefresh(idSolicitacao?: string) {
    if (idSolicitacao) pendingDetailRefreshRef.current.add(idSolicitacao)
    if (pendingRefreshTimerRef.current != null) window.clearTimeout(pendingRefreshTimerRef.current)
    pendingRefreshTimerRef.current = window.setTimeout(() => {
      pendingRefreshTimerRef.current = null
      const latest = latestRef.current
      if (!latest) return
      const ids = Array.from(pendingDetailRefreshRef.current)
      pendingDetailRefreshRef.current.clear()
      const modalOpen = workflowOpenRef.current || correctionOpenRef.current
      ids.forEach((id) => {
        if (modalOpen && latest.openDetailId === id) {
          void latest.refreshDetail(id).catch(() => undefined)
        } else {
          latest.invalidateDetailCache(id)
        }
      })
      const requestId = ++listRequestRef.current
      void fetchAdministrativeSolicitations(latest.listQuery())
        .then((response) => {
          if (requestId === listRequestRef.current) latestRef.current?.applyListResponse(response)
        })
        .catch(() => undefined)
    }, POST_MUTATION_REFRESH_DELAY_MS)
  }

  function requestCatalogs(signal?: AbortSignal) {
    if (catalogs) return Promise.resolve(catalogs)
    if (catalogRequestRef.current) return catalogRequestRef.current
    const request = fetchCatalogos(signal)
      .then((loaded) => { setCatalogs(loaded); return loaded })
      .finally(() => { catalogRequestRef.current = null })
    catalogRequestRef.current = request
    return request
  }

  function ensureCatalogsForAction() {
    if (!canAdminister || catalogs) return
    void requestCatalogs().catch(() => undefined)
  }

  function freshCachedDetail(idSolicitacao: string) {
    const cached = detailCacheRef.current.get(idSolicitacao) || null
    const cachedAt = detailCacheTimeRef.current.get(idSolicitacao) || 0
    if (!cached || Date.now() - cachedAt > DETAIL_CACHE_FRESH_MS) return null
    return cached
  }

  function invalidateDetailCache(idSolicitacao: string) {
    detailCacheRef.current.delete(idSolicitacao)
    detailCacheTimeRef.current.delete(idSolicitacao)
  }

  function applyDetailPatch(idSolicitacao: string, patch: Partial<AdministrativeSolicitationDetail>) {
    const cached = detailCacheRef.current.get(idSolicitacao)
    const visible = detail?.idSolicitacao === idSolicitacao ? detail : null
    const current = visible || cached
    if (!current) return

    const next = { ...current, ...patch }
    detailCacheRef.current.set(idSolicitacao, next)
    detailCacheTimeRef.current.set(idSolicitacao, Date.now())
    setDetail((currentDetail) => currentDetail?.idSolicitacao === idSolicitacao ? { ...currentDetail, ...patch } : currentDetail)
    setItems((currentItems) => currentItems.map((item) => {
      if (item.idSolicitacao !== idSolicitacao) return item
      return {
        ...item,
        ...(patch.status !== undefined ? { status: patch.status } : {}),
        ...(patch.fornecedor !== undefined ? { fornecedor: patch.fornecedor } : {}),
        ...(patch.qtdComparecida !== undefined ? { qtdComparecida: patch.qtdComparecida } : {}),
        ...(patch.valorPrevisto !== undefined ? { valorPrevisto: patch.valorPrevisto } : {}),
        ...(patch.valorReal !== undefined ? { valorReal: patch.valorReal } : {}),
        ...(patch.triagemConcluida !== undefined ? { triagemConcluida: patch.triagemConcluida } : {}),
        ...(patch.realizadoRegistrado !== undefined ? { realizadoRegistrado: patch.realizadoRegistrado } : {}),
        ...(patch.divergencia !== undefined ? { divergencia: patch.divergencia } : {}),
      }
    }))
  }

  function requestDetail(idSolicitacao: string, force = false) {
    if (!force) {
      const cached = freshCachedDetail(idSolicitacao)
      if (cached) return Promise.resolve(cached)
      const running = detailRequestsRef.current.get(idSolicitacao)
      if (running) return running
    }
    const request = fetchAdministrativeSolicitationDetail(idSolicitacao)
      .then((loaded) => {
        detailCacheRef.current.set(idSolicitacao, loaded)
        detailCacheTimeRef.current.set(idSolicitacao, Date.now())
        return loaded
      })
      .finally(() => { detailRequestsRef.current.delete(idSolicitacao) })
    detailRequestsRef.current.set(idSolicitacao, request)
    return request
  }

  function cancelDetailPrefetch() {
    if (detailIntentTimerRef.current == null) return
    window.clearTimeout(detailIntentTimerRef.current)
    detailIntentTimerRef.current = null
  }

  function scheduleDetailPrefetch(idSolicitacao: string, delay = DETAIL_PREFETCH_DELAY_MS) {
    if (freshCachedDetail(idSolicitacao) || detailRequestsRef.current.has(idSolicitacao)) return
    cancelDetailPrefetch()
    detailIntentTimerRef.current = window.setTimeout(() => {
      detailIntentTimerRef.current = null
      void requestDetail(idSolicitacao).catch(() => undefined)
    }, delay)
  }

  async function refreshDetail(idSolicitacao: string) {
    const loaded = await requestDetail(idSolicitacao, true)
    setDetail((currentDetail) => currentDetail?.idSolicitacao === idSolicitacao ? loaded : currentDetail)
    return loaded
  }

  async function openDetail(idSolicitacao: string) {
    const requestId = ++activeDetailRequestRef.current
    const cached = freshCachedDetail(idSolicitacao)
    cancelDetailPrefetch()
    ensureCatalogsForAction()
    setDetail(cached)
    setDetailLoading(!cached)
    setWorkflowOpen(true)
    setCorrectionOpen(false)
    try {
      const loaded = await requestDetail(idSolicitacao)
      if (requestId !== activeDetailRequestRef.current) return
      setDetail(loaded)
    } catch (error) {
      if (requestId !== activeDetailRequestRef.current) return
      setWorkflowOpen(false)
      notify('error', error instanceof Error ? error.message : 'Não foi possível carregar a solicitação.')
    } finally {
      if (requestId === activeDetailRequestRef.current) setDetailLoading(false)
    }
  }

  async function openCorrection(idSolicitacao: string) {
    if (!canAdminister) return
    const requestId = ++activeDetailRequestRef.current
    const cached = freshCachedDetail(idSolicitacao)
    cancelDetailPrefetch()
    ensureCatalogsForAction()
    setDetail(cached)
    setDetailLoading(!cached)
    setCorrectionOpen(true)
    setWorkflowOpen(false)
    try {
      const loaded = await requestDetail(idSolicitacao)
      if (requestId !== activeDetailRequestRef.current) return
      setDetail(loaded)
    } catch (error) {
      if (requestId !== activeDetailRequestRef.current) return
      setCorrectionOpen(false)
      notify('error', error instanceof Error ? error.message : 'Não foi possível carregar a solicitação para edição.')
    } finally {
      if (requestId === activeDetailRequestRef.current) setDetailLoading(false)
    }
  }

  function closeWorkflow() {
    activeDetailRequestRef.current += 1
    setWorkflowOpen(false)
    setDetailLoading(false)
  }

  function closeCorrection() {
    activeDetailRequestRef.current += 1
    setCorrectionOpen(false)
    setDetailLoading(false)
  }

  async function handleQuickStatus(item: AdministrativeSolicitationListItem, status: AdministrativeTransitionStatus, message: string) {
    if (!canAdminister || quickLoading) return
    setQuickLoading(item.idSolicitacao)
    setQuickActionKey(`status:${status}`)
    // Atualização otimista: a linha muda na hora e volta ao estado anterior se o servidor recusar.
    const previousStatus = item.status
    setItems((current) => current.map((row) => row.idSolicitacao === item.idSolicitacao ? { ...row, status } : row))
    try {
      await updateAdministrativeSolicitationStatus({ idSolicitacao: item.idSolicitacao, status })
      invalidateDetailCache(item.idSolicitacao)
      notify('success', message)
      scheduleBackgroundRefresh()
    } catch (error) {
      setItems((current) => current.map((row) => row.idSolicitacao === item.idSolicitacao ? { ...row, status: previousStatus } : row))
      notify('error', error instanceof Error ? error.message : 'Não foi possível atualizar o status.')
    } finally {
      setQuickLoading(null)
      setQuickActionKey(null)
    }
  }

  async function handleCopySummary(item: AdministrativeSolicitationListItem) {
    if (quickLoading) return
    setQuickLoading(item.idSolicitacao)
    setQuickActionKey('copy')
    try {
      const loaded = await requestDetail(item.idSolicitacao)
      const copied = await copyTextToClipboard(buildSupplierSummary(loaded))
      if (!copied) throw new Error('Não foi possível copiar o resumo automaticamente.')
      notify('success', `Resumo da solicitação ${item.idSolicitacao} copiado.`)
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Não foi possível copiar o resumo.')
    } finally {
      setQuickLoading(null)
      setQuickActionKey(null)
    }
  }

  async function handleOpenSupplier(item: AdministrativeSolicitationListItem) {
    if (quickLoading) return
    const externalWindow = reserveExternalWindow()
    setQuickLoading(item.idSolicitacao)
    setQuickActionKey('supplier')
    try {
      const [loaded, loadedCatalogs] = await Promise.all([requestDetail(item.idSolicitacao), requestCatalogs()])
      const message = buildSupplierSummary(loaded)
      const provider = loadedCatalogs.fornecedores.find((candidate) => candidate.nome === loaded.fornecedor)

      if (provider?.whatsappDestino === 'NUMERO' && provider.whatsappNumero) {
        navigateExternalWindow(
          externalWindow,
          `https://wa.me/${provider.whatsappNumero.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`,
        )
        return
      }

      if (provider?.whatsappDestino === 'GRUPO' && provider.whatsappGrupoLink) {
        const copied = await copyTextToClipboard(message)
        navigateExternalWindow(externalWindow, provider.whatsappGrupoLink)
        notify(
          copied ? 'success' : 'error',
          copied
            ? 'Grupo aberto e resumo copiado. No WhatsApp, basta colar a mensagem no campo do grupo.'
            : 'Grupo aberto, mas o navegador não permitiu copiar o resumo automaticamente.',
        )
        return
      }

      navigateExternalWindow(externalWindow, `https://wa.me/?text=${encodeURIComponent(message)}`)
    } catch (error) {
      externalWindow?.close()
      notify('error', error instanceof Error ? error.message : 'Não foi possível abrir o contato do fornecedor.')
    } finally {
      setQuickLoading(null)
      setQuickActionKey(null)
    }
  }

  function handleWorkflowChanged(
    idSolicitacao: string,
    message: string,
    patch: Partial<AdministrativeSolicitationDetail>,
  ) {
    applyDetailPatch(idSolicitacao, patch)
    notify('success', message)
    scheduleBackgroundRefresh(idSolicitacao)
  }

  function handleCorrectionSaved(idSolicitacao: string) {
    notify('success', 'Correção registrada com sucesso e histórico preservado na auditoria.')
    // Correção altera vários campos: o detalhe aberto é recarregado já, a lista fica agrupada.
    void refreshDetail(idSolicitacao).catch(() => undefined)
    scheduleBackgroundRefresh()
  }

  function openDelete(item: AdministrativeSolicitationListItem) {
    if (!canAdminister) return
    setDeleteTarget(item)
    setDeleteReason('')
    setDeleteError('')
  }

  function closeDelete() {
    if (deleteLoading) return
    setDeleteTarget(null)
    setDeleteReason('')
    setDeleteError('')
  }

  async function refreshMetadata() {
    const loaded = await fetchAdministrativeSolicitationMetadata()
    setMetadata(loaded)
    if (registrationYear === 'TODOS' && registrationMonth === 'TODOS' && registrationDate === 'TODOS') setPeriodSummary(loaded.resumo)
  }

  async function confirmDelete() {
    const item = deleteTarget
    if (!item || !canAdminister) return
    if (deleteReason.trim().length < 5) {
      setDeleteError('Informe um motivo de exclusão com pelo menos 5 caracteres.')
      return
    }

    setDeleteLoading(item.idSolicitacao)
    setDeleteError('')
    try {
      await deleteAdministrativeSolicitation({ idSolicitacao: item.idSolicitacao, motivoExclusao: deleteReason.trim() })
      invalidateDetailCache(item.idSolicitacao)
      detailRequestsRef.current.delete(item.idSolicitacao)
      // Remove a linha localmente e fecha o diálogo sem esperar as recargas.
      setItems((current) => current.filter((row) => row.idSolicitacao !== item.idSolicitacao))
      setTotal((current) => Math.max(0, current - 1))
      setDeleteTarget(null)
      setDeleteReason('')
      notify('success', `Solicitação ${item.idSolicitacao} excluída e registrada na auditoria.`)
      scheduleBackgroundRefresh()
      void refreshMetadata().catch(() => undefined)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Não foi possível excluir a solicitação.')
    } finally {
      setDeleteLoading(null)
    }
  }

  latestRef.current = {
    listQuery: () => listQuery(),
    applyListResponse,
    refreshDetail,
    invalidateDetailCache,
    openDetailId: detail?.idSolicitacao ?? null,
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => { setCurrentPage(1) }, [debouncedSearch, typeFilter, statusFilter, registrationYear, registrationMonth, registrationDate, pageSize])

  useEffect(() => {
    const controller = new AbortController()
    const requestId = ++listRequestRef.current
    setLoading(true)
    void fetchAdministrativeSolicitations(listQuery(), controller.signal)
      .then((response) => { if (requestId === listRequestRef.current) applyListResponse(response) })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        notify('error', error instanceof Error ? error.message : 'Erro ao carregar solicitações.')
      })
      .finally(() => { if (requestId === listRequestRef.current) setLoading(false) })
    return () => controller.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, debouncedSearch, typeFilter, statusFilter, registrationYear, registrationMonth, registrationDate])

  useEffect(() => {
    if (loading || workflowOpen || correctionOpen || deleteLoading || quickLoading) return
    let disposed = false
    const revalidate = () => {
      if (disposed || document.visibilityState !== 'visible') return
      const requestId = ++listRequestRef.current
      void fetchAdministrativeSolicitations(listQuery(), undefined, { force: true })
        .then((response) => { if (!disposed && requestId === listRequestRef.current) applyListResponse(response) })
        .catch(() => undefined)
    }
    const interval = window.setInterval(revalidate, BACKGROUND_REVALIDATION_MS)
    return () => { disposed = true; window.clearInterval(interval) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, workflowOpen, correctionOpen, deleteLoading, quickLoading, currentPage, pageSize, debouncedSearch, typeFilter, statusFilter, registrationYear, registrationMonth, registrationDate])

  useEffect(() => {
    if (loading || metadata) return
    const controller = new AbortController()
    void fetchAdministrativeSolicitationMetadata(controller.signal)
      .then((loaded) => {
        setMetadata(loaded)
        if (!periodSummary && registrationYear === 'TODOS' && registrationMonth === 'TODOS') setPeriodSummary(loaded.resumo)
      })
      .catch(() => undefined)
    return () => controller.abort()
  }, [loading, metadata, periodSummary, registrationMonth, registrationYear])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), notice.tone === 'success' ? 4500 : 8000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  useEffect(() => () => {
    if (detailIntentTimerRef.current != null) window.clearTimeout(detailIntentTimerRef.current)
    if (pendingRefreshTimerRef.current != null) window.clearTimeout(pendingRefreshTimerRef.current)
  }, [])

  const registrationYears = useMemo(() => {
    const years = new Set((metadata?.datasRegistro || []).map((date) => date.slice(0, 4)).filter(Boolean))
    if (registrationYear !== 'TODOS') years.add(registrationYear)
    return Array.from(years).sort((left, right) => right.localeCompare(left))
  }, [metadata, registrationYear])

  const registrationMonths = useMemo(() => {
    if (registrationYear === 'TODOS') return []
    const months = new Set((metadata?.datasRegistro || []).filter((date) => date.slice(0, 4) === registrationYear).map((date) => date.slice(5, 7)))
    if (registrationMonth !== 'TODOS') months.add(registrationMonth)
    return Array.from(months).sort((left, right) => Number(left) - Number(right))
  }, [metadata, registrationMonth, registrationYear])

  const registrationDates = useMemo(() => {
    if (registrationYear === 'TODOS' || registrationMonth === 'TODOS') return []
    return (metadata?.datasRegistro || []).filter((date) => date.slice(0, 4) === registrationYear && date.slice(5, 7) === registrationMonth).sort((left, right) => right.localeCompare(left))
  }, [metadata, registrationYear, registrationMonth])

  const hasActiveFilters = Boolean(search.trim()) || typeFilter !== 'TODOS' || statusFilter !== 'TODOS' || registrationDate !== 'TODOS'

  function handleYearChange(value: string) {
    setRegistrationYear(value)
    setRegistrationMonth('TODOS')
    setRegistrationDate('TODOS')
  }

  function handleMonthChange(value: string) {
    setRegistrationMonth(value)
    setRegistrationDate('TODOS')
  }

  function clearAllFilters() {
    setSearch('')
    setTypeFilter('TODOS')
    setStatusFilter('TODOS')
    setRegistrationDate('TODOS')
  }

  const pageSizeLimit = total <= 10 ? 10 : Math.min(100, Math.ceil(total / 5) * 5)
  const pageSizeOptions = allPageSizeOptions.filter((size) => size <= pageSizeLimit)
  useEffect(() => { if (pageSize > pageSizeLimit) setPageSize(pageSizeLimit) }, [pageSize, pageSizeLimit])

  const yearOptions = [{ label: 'Ano: todos', value: 'TODOS' }, ...registrationYears.map((value) => ({ label: value, value }))]
  const monthOptions = [{ label: registrationYear === 'TODOS' ? 'Mês: selecione o ano' : 'Mês: todos', value: 'TODOS' }, ...registrationMonths.map((value) => ({ label: monthLabels[Number(value) - 1], value }))]
  const dateOptions = [{ label: registrationMonth === 'TODOS' ? 'Data: selecione o mês' : 'Data: todas', value: 'TODOS' }, ...registrationDates.map((value) => ({ label: formatDate(value), value }))]
  const typeOptions = [
    { label: 'Todos os tipos', value: 'TODOS' },
    { label: 'Mão de obra', value: 'MAO_DE_OBRA' },
    { label: 'Alimentação / Bebida', value: 'ALIMENTACAO_BEBIDA' },
  ]


  return (
    <section className="admin-page nx-modern-page">
      <PageHeader eyebrow="CONTROLE DE CUSTOS EXTRAS" title="Solicitações" description="Conferência, triagem, precificação e acompanhamento do realizado em um único workspace administrativo." />

      <AdminSolicitationsNotice notice={notice} onClose={() => setNotice(null)} />

      <AdminSolicitationsSummary
        metrics={periodSummary}
        registrationYear={registrationYear}
        registrationMonth={registrationMonth}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
      />

      <Panel className="admin-list-workspace admin-list-workspace-full nx-prime-data-panel">
        <PanelHeader eyebrow="REGISTROS" title="Fila administrativa" description={`${total} registro(s) após filtros · busca e filtros aplicados sobre toda a base.`} trailing={<Chip>{total} encontrados</Chip>} />

        <AdminSolicitationsFilters
          search={search}
          registrationYear={registrationYear}
          registrationMonth={registrationMonth}
          registrationDate={registrationDate}
          typeFilter={typeFilter}
          statusFilter={statusFilter}
          yearOptions={yearOptions}
          monthOptions={monthOptions}
          dateOptions={dateOptions}
          typeOptions={typeOptions}
          statusOptions={statusFilterOptions}
          hasActiveFilters={hasActiveFilters}
          onSearchChange={setSearch}
          onYearChange={handleYearChange}
          onMonthChange={handleMonthChange}
          onDateChange={setRegistrationDate}
          onTypeChange={setTypeFilter}
          onStatusChange={setStatusFilter}
          onClear={clearAllFilters}
        />

        {loading ? (
          <Skeleton lines={7} />
        ) : items.length === 0 ? (
          <EmptyState title="Nenhuma solicitação encontrada" description="A busca atual não possui registros. Ajuste a busca ou limpe os filtros." />
        ) : (
          <AdminSolicitationsTable
            items={items}
            canAdminister={canAdminister}
            detailLoading={detailLoading}
            deleteLoading={deleteLoading}
            quickLoading={quickLoading}
            quickActionKey={quickActionKey}
            onScheduleDetailPrefetch={scheduleDetailPrefetch}
            onCancelDetailPrefetch={cancelDetailPrefetch}
            onEnsureCatalogsForAction={ensureCatalogsForAction}
            onQuickStatus={(item, status, message) => void handleQuickStatus(item, status, message)}
            onCopySummary={(item) => void handleCopySummary(item)}
            onOpenSupplier={(item) => void handleOpenSupplier(item)}
            onOpenDetail={(idSolicitacao) => void openDetail(idSolicitacao)}
            onOpenCorrection={(idSolicitacao) => void openCorrection(idSolicitacao)}
            onOpenDelete={openDelete}
          />
        )}

        <AdminSolicitationsPagination
          loading={loading}
          total={total}
          currentPage={currentPage}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          onPageChange={(page, nextPageSize) => { setCurrentPage(page); setPageSize(nextPageSize) }}
        />
      </Panel>

      <SolicitationDetailModal open={workflowOpen} loading={detailLoading} detail={detail} catalogs={catalogs} canAdminister={canAdminister} onClose={closeWorkflow} onChanged={handleWorkflowChanged} onNotify={notify} />
      {canAdminister && <SolicitationCorrectionModal open={correctionOpen} loading={detailLoading} detail={detail} catalogs={catalogs} onClose={closeCorrection} onSaved={handleCorrectionSaved} />}

      <AdminSolicitationDeleteModal
        canAdminister={canAdminister}
        target={deleteTarget}
        reason={deleteReason}
        error={deleteError}
        loading={deleteLoading}
        onReasonChange={setDeleteReason}
        onClose={closeDelete}
        onConfirm={() => void confirmDelete()}
      />
    </section>
  )
}
