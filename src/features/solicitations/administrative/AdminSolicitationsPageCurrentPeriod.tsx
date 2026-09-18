import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Dropdown } from 'primereact/dropdown'
import { InputTextarea } from 'primereact/inputtextarea'
import { Message } from 'primereact/message'
import { Paginator } from 'primereact/paginator'
import { Tag } from 'primereact/tag'
import { PageHeader } from '@/components/PageHeader'
import { SolicitationCorrectionModal } from '@/features/solicitations/administrative/SolicitationCorrectionModal'
import { SolicitationDetailModal } from '@/features/solicitations/administrative/SolicitationDetailModal'
import { Modal } from '@/components/ui/Modal'
import {
  Chip,
  EmptyState,
  PageToolbar,
  Panel,
  PanelHeader,
  SearchField,
  Skeleton,
  SummaryMetrics,
  type SummaryMetricItem,
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
  consideredQuantityBody,
  currentPeriod,
  formatDate,
  formatDateTime,
  formatMoney,
  monthLabels,
  requestedQuantityBody,
  statusFilterOptions,
  statusInfo,
  typeLabel,
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
const DETAIL_CACHE_FRESH_MS = 30 * 1000
const DETAIL_PREFETCH_DELAY_MS = 120

type Notice = { tone: 'success' | 'error'; message: string }
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
  const [notice, setNotice] = useState<Notice | null>(null)
  const [workflowOpen, setWorkflowOpen] = useState(false)
  const [correctionOpen, setCorrectionOpen] = useState(false)

  const detailCacheRef = useRef(new Map<string, AdministrativeSolicitationDetail>())
  const detailCacheTimeRef = useRef(new Map<string, number>())
  const detailRequestsRef = useRef(new Map<string, Promise<AdministrativeSolicitationDetail>>())
  const detailIntentTimerRef = useRef<number | null>(null)
  const activeDetailRequestRef = useRef(0)
  const catalogRequestRef = useRef<Promise<CatalogosDto> | null>(null)
  const listRequestRef = useRef(0)

  function notify(tone: Notice['tone'], message: string) {
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
    try {
      await updateAdministrativeSolicitationStatus({ idSolicitacao: item.idSolicitacao, status })
      setItems((current) => current.map((row) => row.idSolicitacao === item.idSolicitacao ? { ...row, status } : row))
      invalidateDetailCache(item.idSolicitacao)
      notify('success', message)
      void refreshItems().catch(() => undefined)
    } catch (error) {
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
      await navigator.clipboard.writeText(buildSupplierSummary(loaded))
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
    setQuickLoading(item.idSolicitacao)
    setQuickActionKey('supplier')
    try {
      const [loaded, loadedCatalogs] = await Promise.all([requestDetail(item.idSolicitacao), requestCatalogs()])
      const message = buildSupplierSummary(loaded)
      const provider = loadedCatalogs.fornecedores.find((candidate) => candidate.nome === loaded.fornecedor)
      if (provider?.whatsappDestino === 'NUMERO' && provider.whatsappNumero) {
        window.open(`https://wa.me/${provider.whatsappNumero.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
      } else if (provider?.whatsappDestino === 'GRUPO' && provider.whatsappGrupoLink) {
        await navigator.clipboard.writeText(message).catch(() => undefined)
        window.open(provider.whatsappGrupoLink, '_blank', 'noopener,noreferrer')
        notify('success', 'Grupo aberto. O resumo foi copiado para colar no WhatsApp.')
      } else {
        window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
      }
    } catch (error) {
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
    void refreshDetail(idSolicitacao).catch(() => undefined)
    void refreshItems().catch(() => undefined)
  }

  function handleCorrectionSaved(idSolicitacao: string) {
    notify('success', 'Correção registrada com sucesso e histórico preservado na auditoria.')
    void refreshDetail(idSolicitacao).catch(() => undefined)
    void refreshItems().catch(() => undefined)
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
      await Promise.all([refreshItems(), refreshMetadata()])
      setDeleteTarget(null)
      setDeleteReason('')
      notify('success', `Solicitação ${item.idSolicitacao} excluída e registrada na auditoria.`)
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Não foi possível excluir a solicitação.')
    } finally {
      setDeleteLoading(null)
    }
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

  const metrics = periodSummary
  const periodDetail = registrationYear !== 'TODOS' && registrationMonth !== 'TODOS'
    ? `${monthLabels[Number(registrationMonth) - 1]}/${registrationYear}`
    : registrationYear !== 'TODOS' ? registrationYear : 'base completa'

  const summary: SummaryMetricItem[] = [
    { key: 'all', label: 'Total', value: metrics?.total ?? '—', detail: `no período · ${periodDetail}`, icon: 'dataset', active: statusFilter === 'TODOS', onClick: () => setStatusFilter('TODOS') },
    { key: 'triage', label: 'Aguardando triagem', value: metrics?.aguardandoTriagem ?? '—', detail: `no período · ${periodDetail}`, icon: 'pending_actions', tone: 'info', active: statusFilter === 'AGUARDANDO_TRIAGEM', onClick: () => setStatusFilter('AGUARDANDO_TRIAGEM') },
    { key: 'actual', label: 'Aguardando realizado', value: metrics?.aguardandoRealizado ?? '—', detail: `no período · ${periodDetail}`, icon: 'groups', tone: 'warning', active: statusFilter === 'AGUARDANDO_REALIZADO', onClick: () => setStatusFilter('AGUARDANDO_REALIZADO') },
    { key: 'div', label: 'Com divergência', value: metrics?.divergencias ?? '—', detail: `no período · ${periodDetail}`, icon: 'error', tone: 'danger', active: statusFilter === 'COM_DIVERGENCIA', onClick: () => setStatusFilter('COM_DIVERGENCIA') },
  ]

  const hasActiveFilters = Boolean(search.trim()) || typeFilter !== 'TODOS' || statusFilter !== 'TODOS' || registrationYear !== 'TODOS' || registrationMonth !== 'TODOS' || registrationDate !== 'TODOS'

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
    setRegistrationYear('TODOS')
    setRegistrationMonth('TODOS')
    setRegistrationDate('TODOS')
    setPeriodSummary(metadata?.resumo || null)
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

  const solicitationBody = (item: AdministrativeSolicitationListItem) => (
    <div className="nx-user-cell"><strong>{item.idSolicitacao}</strong><small>{item.supervisor || 'Sem supervisor'}</small></div>
  )
  const typeBody = (item: AdministrativeSolicitationListItem) => <Tag value={typeLabel(item.tipoSolicitacao)} severity="secondary" rounded />
  const statusBody = (item: AdministrativeSolicitationListItem) => {
    const status = statusInfo(item)
    return <Tag value={status.label} severity={status.severity} rounded className="nx-solicitation-status-tag" />
  }

  const actionsBody = (item: AdministrativeSolicitationListItem) => {
    const busy = Boolean(deleteLoading) || quickLoading === item.idSolicitacao
    const activeAction = quickLoading === item.idSolicitacao ? quickActionKey : null
    const actionIcon = (key: string, icon: string) => activeAction === key ? 'pi pi-spin pi-spinner' : icon
    const canShare = canAdminister && item.triagemConcluida && ['EM_TRIAGEM', 'ENVIADA_AO_FORNECEDOR', 'EM_ATENDIMENTO'].includes(item.status)
    return (
      <div
        className={`nx-modern-actions nx-solicitation-row-actions ${canAdminister ? 'is-admin' : 'is-readonly'}`}
        onMouseEnter={() => scheduleDetailPrefetch(item.idSolicitacao)}
        onMouseLeave={cancelDetailPrefetch}
        onFocusCapture={() => scheduleDetailPrefetch(item.idSolicitacao, 0)}
      >
        {canAdminister && item.status === 'EM_TRIAGEM' && <Button icon={actionIcon('status:AGUARDANDO_AJUSTE', 'pi pi-undo')} aria-label="Aguardando ajuste" title="Aguardando ajuste" size="small" outlined disabled={busy} onClick={() => void handleQuickStatus(item, 'AGUARDANDO_AJUSTE', 'Solicitação direcionada para ajuste.')} />}
        {canAdminister && item.status === 'EM_TRIAGEM' && item.triagemConcluida && <Button icon={actionIcon('status:ENVIADA_AO_FORNECEDOR', 'pi pi-send')} aria-label="Confirmar envio ao fornecedor" title="Confirmar envio ao fornecedor" size="small" disabled={busy} onClick={() => void handleQuickStatus(item, 'ENVIADA_AO_FORNECEDOR', 'Solicitação marcada como enviada ao fornecedor.')} />}
        {canShare && <Button icon={actionIcon('copy', 'pi pi-copy')} aria-label="Copiar resumo" title="Copiar resumo" size="small" text disabled={busy} onClick={() => void handleCopySummary(item)} />}
        {canShare && <Button icon={actionIcon('supplier', 'pi pi-whatsapp')} aria-label="Abrir fornecedor" title="Abrir fornecedor" size="small" text disabled={busy} onMouseEnter={ensureCatalogsForAction} onFocus={ensureCatalogsForAction} onClick={() => void handleOpenSupplier(item)} />}
        {canAdminister && item.status === 'ENVIADA_AO_FORNECEDOR' && <Button icon={actionIcon('status:EM_ATENDIMENTO', 'pi pi-play')} aria-label="Marcar em atendimento" title="Marcar em atendimento" size="small" outlined disabled={busy} onClick={() => void handleQuickStatus(item, 'EM_ATENDIMENTO', 'Solicitação marcada como em atendimento.')} />}
        {canAdminister && item.tipoSolicitacao === 'ALIMENTACAO_BEBIDA' && ['ENVIADA_AO_FORNECEDOR', 'EM_ATENDIMENTO'].includes(item.status) && <Button icon={actionIcon('status:ATENDIDA', 'pi pi-check')} aria-label="Marcar atendida" title="Marcar atendida" size="small" severity="success" disabled={busy} onClick={() => void handleQuickStatus(item, 'ATENDIDA', 'Solicitação marcada como atendida.')} />}
        <Button icon="pi pi-external-link" aria-label="Abrir detalhes" title="Abrir detalhes" size="small" onClick={() => void openDetail(item.idSolicitacao)} disabled={busy || detailLoading} className="nx-primary-button" />
        {canAdminister && <Button icon="pi pi-pencil" aria-label="Editar solicitação" title="Editar solicitação" size="small" outlined onClick={() => void openCorrection(item.idSolicitacao)} disabled={busy || detailLoading} />}
        {canAdminister && <Button icon="pi pi-trash" aria-label="Excluir solicitação" title="Excluir solicitação" size="small" severity="danger" text onClick={() => openDelete(item)} disabled={busy || detailLoading} />}
      </div>
    )
  }

  return (
    <section className="admin-page nx-modern-page">
      <PageHeader eyebrow="CONTROLE DE CUSTOS EXTRAS" title="Solicitações" description="Conferência, triagem, precificação e acompanhamento do realizado em um único workspace administrativo." />

      {notice && (
        <div className={`nx-prime-notice ${notice.tone === 'success' ? 'is-success' : 'is-error'}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
          <i className={notice.tone === 'success' ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'} />
          <span>{notice.message}</span>
          <Button text rounded icon="pi pi-times" aria-label="Fechar notificação" onClick={() => setNotice(null)} />
        </div>
      )}

      <SummaryMetrics items={summary} ariaLabel="Filtrar solicitações por situação" />

      <Panel className="admin-list-workspace admin-list-workspace-full nx-prime-data-panel">
        <PanelHeader eyebrow="REGISTROS" title="Fila administrativa" description={`${total} registro(s) após filtros · busca e filtros aplicados sobre toda a base.`} trailing={<Chip>{total} encontrados</Chip>} />

        <PageToolbar
          embedded
          ariaLabel="Filtros das solicitações"
          search={<SearchField ariaLabel="Pesquisar solicitações" placeholder="Protocolo, operação, supervisor…" value={search} onChange={setSearch} />}
          filters={
            <div className="nx-prime-filter-row">
              <Dropdown value={registrationYear} options={yearOptions} onChange={(event) => handleYearChange(event.value)} />
              <Dropdown value={registrationMonth} options={monthOptions} disabled={registrationYear === 'TODOS'} onChange={(event) => handleMonthChange(event.value)} />
              <Dropdown value={registrationDate} options={dateOptions} disabled={registrationYear === 'TODOS' || registrationMonth === 'TODOS'} onChange={(event) => setRegistrationDate(event.value)} />
              <Dropdown value={typeFilter} options={typeOptions} onChange={(event) => setTypeFilter(event.value)} />
              <Dropdown value={statusFilter} options={statusFilterOptions} onChange={(event) => setStatusFilter(event.value)} />
              <Button label="Limpar filtros" icon="pi pi-filter-slash" outlined onClick={clearAllFilters} disabled={!hasActiveFilters} />
            </div>
          }
        />

        {loading ? (
          <Skeleton lines={7} />
        ) : items.length === 0 ? (
          <EmptyState title="Nenhuma solicitação encontrada" description="A busca atual não possui registros. Ajuste a busca ou limpe os filtros." />
        ) : (
          <DataTable value={items} dataKey="idSolicitacao" stripedRows rowHover scrollable responsiveLayout="scroll" tableStyle={{ tableLayout: 'fixed' }} className="nx-prime-table" emptyMessage="Nenhuma solicitação encontrada">
            <Column header="Solicitação" body={solicitationBody} frozen />
            <Column header="Registro" body={(item: AdministrativeSolicitationListItem) => formatDateTime(item.dataCriacao)} />
            <Column header="Data operacional" body={(item: AdministrativeSolicitationListItem) => formatDate(item.dataOperacional)} />
            <Column field="operacao" header="Operação" />
            <Column header="Tipo" body={typeBody} />
            <Column header="Status" body={statusBody} style={{ width: '12rem' }} />
            <Column header="Qtd. solicitada" body={requestedQuantityBody} />
            <Column header="Qtd. considerada" body={consideredQuantityBody} />
            <Column header="Previsto" body={(item: AdministrativeSolicitationListItem) => formatMoney(item.valorPrevisto)} />
            <Column header="Valor real" body={(item: AdministrativeSolicitationListItem) => formatMoney(item.valorReal)} />
            <Column header="Ações" body={actionsBody} style={{ width: canAdminister ? '22rem' : '4rem' }} />
          </DataTable>
        )}

        {!loading && total > 0 && (
          <Paginator
            first={(currentPage - 1) * pageSize}
            rows={pageSize}
            totalRecords={total}
            rowsPerPageOptions={pageSizeOptions}
            onPageChange={(event) => { setCurrentPage(event.page + 1); setPageSize(event.rows) }}
            template="FirstPageLink PrevPageLink PageLinks NextPageLink LastPageLink RowsPerPageDropdown CurrentPageReport"
            currentPageReportTemplate="{first}–{last} de {totalRecords}"
            className="nx-prime-paginator"
          />
        )}
      </Panel>

      <SolicitationDetailModal open={workflowOpen} loading={detailLoading} detail={detail} catalogs={catalogs} canAdminister={canAdminister} onClose={closeWorkflow} onChanged={handleWorkflowChanged} onNotify={notify} />
      {canAdminister && <SolicitationCorrectionModal open={correctionOpen} loading={detailLoading} detail={detail} catalogs={catalogs} onClose={closeCorrection} onSaved={handleCorrectionSaved} />}

      {canAdminister && <Modal
        open={Boolean(deleteTarget)}
        titleId="delete-solicitation-title"
        eyebrow="EXCLUSÃO ADMINISTRATIVA"
        title={deleteTarget ? `Excluir ${deleteTarget.idSolicitacao}` : 'Excluir solicitação'}
        description="A solicitação e eventuais jornadas parciais serão removidas da base operacional. Um snapshot será preservado na auditoria."
        onClose={closeDelete}
        busy={Boolean(deleteLoading)}
        width="medium"
        bodyClassName="nx-delete-dialog"
        footer={<><Button label="Cancelar" text onClick={closeDelete} disabled={Boolean(deleteLoading)} /><Button label={deleteLoading ? 'Excluindo…' : 'Excluir solicitação'} icon={deleteLoading ? 'pi pi-spin pi-spinner' : 'pi pi-trash'} severity="danger" onClick={() => void confirmDelete()} disabled={Boolean(deleteLoading) || deleteReason.trim().length < 5} /></>}
      >
        <div className="nx-delete-dialog-body">
          <Message severity="warn" text="Esta ação é definitiva na base operacional e ficará registrada na auditoria." />
          {deleteError && <Message severity="error" text={deleteError} />}
          <label className="nx-workflow-field">
            <span>Motivo da exclusão</span>
            <InputTextarea value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} rows={4} autoResize placeholder="Descreva o motivo com pelo menos 5 caracteres." />
            <small>{deleteReason.trim().length}/5 caracteres mínimos</small>
          </label>
        </div>
      </Modal>}
    </section>
  )
}
