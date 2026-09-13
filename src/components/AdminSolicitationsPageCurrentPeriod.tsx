import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Dropdown } from 'primereact/dropdown'
import { InputTextarea } from 'primereact/inputtextarea'
import { Message } from 'primereact/message'
import { Paginator } from 'primereact/paginator'
import { Tag } from 'primereact/tag'
import { PageHeader } from './PageHeader'
import { SolicitationCorrectionModal } from './SolicitationCorrectionModal'
import { SolicitationDetailModal } from './SolicitationDetailModal'
import { Modal } from './ui/Modal'
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
} from './ui/Primitives'
import { fetchCatalogos } from '../services/catalogService'
import {
  deleteAdministrativeSolicitation,
  fetchAdministrativeSolicitationDetail,
  fetchAdministrativeSolicitationMetadata,
  fetchAdministrativeSolicitations,
} from '../services/solicitationService'
import type { CatalogosDto } from '../types/catalog'
import type {
  AdministrativeSolicitationDetail,
  AdministrativeSolicitationListItem,
  AdministrativeSolicitationMetadata,
  AdministrativeSolicitationSummary,
  SolicitationStatus,
} from '../types/solicitation'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const quantity = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 })

const monthLabels = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const statusFilterOptions = [
  { label: 'Todas as situações', value: 'TODOS' },
  { label: 'Rascunho', value: 'RASCUNHO' },
  { label: 'Enviada', value: 'ENVIADA' },
  { label: 'Em triagem', value: 'EM_TRIAGEM' },
  { label: 'Aguardando ajuste', value: 'AGUARDANDO_AJUSTE' },
  { label: 'Enviada ao fornecedor', value: 'ENVIADA_AO_FORNECEDOR' },
  { label: 'Em atendimento', value: 'EM_ATENDIMENTO' },
  { label: 'Atendida', value: 'ATENDIDA' },
  { label: 'Fila: aguardando triagem', value: 'AGUARDANDO_TRIAGEM' },
  { label: 'Fila: aguardando realizado', value: 'AGUARDANDO_REALIZADO' },
  { label: 'Com divergência', value: 'COM_DIVERGENCIA' },
]

const STATUS_LABELS: Record<SolicitationStatus, string> = {
  RASCUNHO: 'Rascunho',
  ENVIADA: 'Enviada',
  EM_TRIAGEM: 'Em triagem',
  AGUARDANDO_AJUSTE: 'Aguardando ajuste',
  ENVIADA_AO_FORNECEDOR: 'Enviada ao fornecedor',
  EM_ATENDIMENTO: 'Em atendimento',
  ATENDIDA: 'Atendida',
  AGUARDANDO_NF: 'Aguardando NF',
  CONFERIDA: 'Conferida',
  ENCERRADA: 'Encerrada',
}

const allPageSizeOptions = Array.from({ length: 19 }, (_, index) => 10 + index * 5)
const BACKGROUND_REVALIDATION_MS = 30 * 1000

function currentPeriod() {
  const now = new Date()
  return { year: String(now.getFullYear()), month: String(now.getMonth() + 1).padStart(2, '0') }
}

function formatMoney(value: number | null) {
  return value == null ? '—' : money.format(value)
}

function formatQuantity(value: number | null) {
  return value == null ? '—' : quantity.format(value)
}

function formatDate(value: string) {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function formatDateTime(value: string) {
  if (!value) return '—'
  const date = formatDate(value)
  const time = value.length >= 16 ? value.slice(11, 16) : ''
  return time ? `${date} ${time}` : date
}

function typeLabel(value: string) {
  return value === 'MAO_DE_OBRA' ? 'Mão de obra' : 'Alimentação / Bebida'
}

function statusInfo(item: AdministrativeSolicitationListItem) {
  if (item.status === 'AGUARDANDO_AJUSTE') return { label: STATUS_LABELS[item.status], severity: 'danger' as const }
  if (item.status === 'ENVIADA_AO_FORNECEDOR' || item.status === 'EM_ATENDIMENTO') return { label: STATUS_LABELS[item.status], severity: 'warning' as const }
  if (item.status === 'ATENDIDA' || item.status === 'CONFERIDA' || item.status === 'ENCERRADA') return { label: STATUS_LABELS[item.status], severity: 'success' as const }
  if (item.status === 'EM_TRIAGEM') return { label: STATUS_LABELS[item.status], severity: 'info' as const }
  return { label: STATUS_LABELS[item.status], severity: 'secondary' as const }
}

type Notice = { tone: 'success' | 'error'; message: string }
type Props = { canAdminister: boolean }

function snackTotalQuantity(item: AdministrativeSolicitationListItem) {
  if (item.qtdAlimentacao == null && item.qtdBebida == null) return null
  return (item.qtdAlimentacao ?? 0) + (item.qtdBebida ?? 0)
}

function requestedQuantityBody(item: AdministrativeSolicitationListItem) {
  return item.tipoSolicitacao === 'MAO_DE_OBRA'
    ? formatQuantity(item.qtdSolicitada)
    : formatQuantity(snackTotalQuantity(item))
}

function consideredQuantityBody(item: AdministrativeSolicitationListItem) {
  return item.tipoSolicitacao === 'MAO_DE_OBRA'
    ? formatQuantity(item.qtdComparecida)
    : formatQuantity(snackTotalQuantity(item))
}

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
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<AdministrativeSolicitationListItem | null>(null)
  const [deleteReason, setDeleteReason] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const [workflowOpen, setWorkflowOpen] = useState(false)
  const [correctionOpen, setCorrectionOpen] = useState(false)

  const detailCacheRef = useRef(new Map<string, AdministrativeSolicitationDetail>())
  const detailRequestsRef = useRef(new Map<string, Promise<AdministrativeSolicitationDetail>>())
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
    setTotalPages(response.totalPaginas)
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
    void requestCatalogs().catch((error) => notify('error', error instanceof Error ? error.message : 'Não foi possível carregar os cadastros auxiliares.'))
  }

  function requestDetail(idSolicitacao: string, force = false) {
    if (!force) {
      const cached = detailCacheRef.current.get(idSolicitacao)
      if (cached) return Promise.resolve(cached)
      const running = detailRequestsRef.current.get(idSolicitacao)
      if (running) return running
    }
    const request = fetchAdministrativeSolicitationDetail(idSolicitacao)
      .then((loaded) => { detailCacheRef.current.set(idSolicitacao, loaded); return loaded })
      .finally(() => { detailRequestsRef.current.delete(idSolicitacao) })
    detailRequestsRef.current.set(idSolicitacao, request)
    return request
  }

  async function refreshDetail(idSolicitacao: string) {
    const loaded = await requestDetail(idSolicitacao, true)
    setDetail(loaded)
    return loaded
  }

  async function openDetail(idSolicitacao: string) {
    const requestId = ++activeDetailRequestRef.current
    const cached = detailCacheRef.current.get(idSolicitacao) || null
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
    const cached = detailCacheRef.current.get(idSolicitacao) || null
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

  async function handleWorkflowChanged(idSolicitacao: string, message: string) {
    await Promise.all([refreshItems(), refreshDetail(idSolicitacao), refreshMetadata()])
    notify('success', message)
  }

  async function handleCorrectionSaved(idSolicitacao: string) {
    await Promise.all([refreshItems(), refreshDetail(idSolicitacao), refreshMetadata()])
    notify('success', 'Correção registrada com sucesso e histórico preservado na auditoria.')
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
      detailCacheRef.current.delete(item.idSolicitacao)
      detailRequestsRef.current.delete(item.idSolicitacao)
      if (items.length === 1 && currentPage > 1) {
        setCurrentPage((page) => Math.max(1, page - 1))
        await refreshMetadata()
      } else {
        await Promise.all([refreshItems(), refreshMetadata()])
      }
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
    if (loading || workflowOpen || correctionOpen || deleteLoading) return
    let disposed = false
    const revalidate = () => {
      if (disposed || document.visibilityState !== 'visible') return
      const requestId = ++listRequestRef.current
      void fetchAdministrativeSolicitations(listQuery(), undefined, { force: true })
        .then((response) => { if (!disposed && requestId === listRequestRef.current) applyListResponse(response) })
        .catch(() => undefined)
    }
    const interval = window.setInterval(revalidate, BACKGROUND_REVALIDATION_MS)
    const handleVisibility = () => { if (document.visibilityState === 'visible') revalidate() }
    const handleFocus = () => revalidate()
    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)
    return () => {
      disposed = true
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, workflowOpen, correctionOpen, deleteLoading, currentPage, pageSize, debouncedSearch, typeFilter, statusFilter, registrationYear, registrationMonth, registrationDate])

  useEffect(() => {
    if (loading || metadata) return
    const controller = new AbortController()
    void fetchAdministrativeSolicitationMetadata(controller.signal)
      .then((loaded) => {
        setMetadata(loaded)
        if (!periodSummary && registrationYear === 'TODOS' && registrationMonth === 'TODOS') setPeriodSummary(loaded.resumo)
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        notify('error', error instanceof Error ? `Fila carregada. Metadados indisponíveis: ${error.message}` : 'Fila carregada, mas os metadados não puderam ser carregados.')
      })
    return () => controller.abort()
  }, [loading, metadata, periodSummary, registrationMonth, registrationYear])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), notice.tone === 'success' ? 4500 : 8000)
    return () => window.clearTimeout(timeout)
  }, [notice])

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
    return <Tag value={status.label} severity={status.severity} rounded />
  }
  const actionsBody = (item: AdministrativeSolicitationListItem) => {
    const rowBusy = detailLoading || Boolean(deleteLoading)
    return (
      <div className="nx-modern-actions">
        {canAdminister && <Button icon="pi pi-pencil" label="Editar" size="small" outlined onClick={() => void openCorrection(item.idSolicitacao)} disabled={rowBusy} />}
        <Button icon="pi pi-external-link" label="Abrir" size="small" onClick={() => void openDetail(item.idSolicitacao)} disabled={rowBusy} className="nx-primary-button" />
        {canAdminister && <Button icon={deleteLoading === item.idSolicitacao ? 'pi pi-spin pi-spinner' : 'pi pi-trash'} label={deleteLoading === item.idSolicitacao ? 'Excluindo…' : 'Excluir'} size="small" severity="danger" text onClick={() => openDelete(item)} disabled={rowBusy} />}
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
          <DataTable value={items} dataKey="idSolicitacao" stripedRows rowHover scrollable responsiveLayout="scroll" className="nx-prime-table" emptyMessage="Nenhuma solicitação encontrada">
            <Column header="Solicitação" body={solicitationBody} frozen />
            <Column header="Registro" body={(item: AdministrativeSolicitationListItem) => formatDateTime(item.dataCriacao)} />
            <Column header="Data operacional" body={(item: AdministrativeSolicitationListItem) => formatDate(item.dataOperacional)} />
            <Column field="operacao" header="Operação" />
            <Column header="Tipo" body={typeBody} />
            <Column header="Status" body={statusBody} />
            <Column header="Qtd. solicitada" body={requestedQuantityBody} />
            <Column header="Qtd. considerada" body={consideredQuantityBody} />
            <Column header="Previsto" body={(item: AdministrativeSolicitationListItem) => formatMoney(item.valorPrevisto)} />
            <Column header="Valor real" body={(item: AdministrativeSolicitationListItem) => formatMoney(item.valorReal)} />
            <Column header="Ações" body={actionsBody} style={{ minWidth: canAdminister ? '19rem' : '7rem' }} />
          </DataTable>
        )}

        {!loading && total > 0 && (
          <Paginator
            first={(currentPage - 1) * pageSize}
            rows={pageSize}
            totalRecords={total}
            rowsPerPageOptions={pageSizeOptions}
            onPageChange={(event) => {
              setCurrentPage(event.page + 1)
              setPageSize(event.rows)
            }}
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
        footer={
          <>
            <Button label="Cancelar" text onClick={closeDelete} disabled={Boolean(deleteLoading)} />
            <Button
              label={deleteLoading ? 'Excluindo…' : 'Excluir solicitação'}
              icon={deleteLoading ? 'pi pi-spin pi-spinner' : 'pi pi-trash'}
              severity="danger"
              onClick={() => void confirmDelete()}
              disabled={Boolean(deleteLoading) || deleteReason.trim().length < 5}
            />
          </>
        }
      >
        <div className="nx-delete-dialog-body">
          <Message severity="warn" text="Esta ação é definitiva na base operacional e ficará registrada na auditoria." />
          {deleteError && <Message severity="error" text={deleteError} />}
          <label className="nx-workflow-field">
            <span>Motivo da exclusão</span>
            <InputTextarea
              value={deleteReason}
              onChange={(event) => setDeleteReason(event.target.value)}
              rows={4}
              autoResize
              placeholder="Descreva o motivo com pelo menos 5 caracteres."
            />
            <small>{deleteReason.trim().length}/5 caracteres mínimos</small>
          </label>
        </div>
      </Modal>}
    </section>
  )
}
