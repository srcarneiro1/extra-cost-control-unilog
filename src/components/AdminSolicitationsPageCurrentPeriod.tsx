import { useEffect, useMemo, useRef, useState } from 'react'
import { PageHeader } from './PageHeader'
import { SolicitationCorrectionModal } from './SolicitationCorrectionModal'
import { SolicitationDetailModal } from './SolicitationDetailModal'
import {
  Badge,
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
} from '../types/solicitation'

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

const quantity = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 2,
})

const monthLabels = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
]

const statusOptions = [
  'Aguardando triagem',
  'Aguardando realizado',
  'Triagem concluída',
  'Com divergência',
  'Concluído',
]

const statusQueryMap: Record<string, string> = {
  'Aguardando triagem': 'AGUARDANDO_TRIAGEM',
  'Aguardando realizado': 'AGUARDANDO_REALIZADO',
  'Triagem concluída': 'TRIAGEM_CONCLUIDA',
  'Com divergência': 'COM_DIVERGENCIA',
  Concluído: 'CONCLUIDO',
}

const allPageSizeOptions = Array.from({ length: 19 }, (_, index) => 10 + index * 5)
const BACKGROUND_REVALIDATION_MS = 30 * 1000

function currentPeriod() {
  const now = new Date()
  return {
    year: String(now.getFullYear()),
    month: String(now.getMonth() + 1).padStart(2, '0'),
  }
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
  if (!item.triagemConcluida) return { label: 'Aguardando triagem', tone: 'neutral' as const }
  if (item.tipoSolicitacao === 'ALIMENTACAO_BEBIDA') return { label: 'Triagem concluída', tone: 'success' as const }
  if (!item.realizadoRegistrado) return { label: 'Aguardando realizado', tone: 'warning' as const }
  if (item.divergencia) return { label: 'Com divergência', tone: 'danger' as const }
  return { label: 'Concluído', tone: 'success' as const }
}

type Notice = {
  tone: 'success' | 'error'
  message: string
}

export function AdminSolicitationsPageCurrentPeriod() {
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
      status: statusFilter === 'TODOS' ? 'TODOS' : statusQueryMap[statusFilter],
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
    const response = await fetchAdministrativeSolicitations(
      listQuery(),
      undefined,
      force ? { force: true } : undefined,
    )
    applyListResponse(response)
  }

  function requestCatalogs(signal?: AbortSignal) {
    if (catalogs) return Promise.resolve(catalogs)
    if (catalogRequestRef.current) return catalogRequestRef.current

    const request = fetchCatalogos(signal)
      .then((loaded) => {
        setCatalogs(loaded)
        return loaded
      })
      .finally(() => {
        catalogRequestRef.current = null
      })

    catalogRequestRef.current = request
    return request
  }

  function ensureCatalogsForAction() {
    if (catalogs) return
    void requestCatalogs().catch((error) => {
      notify(
        'error',
        error instanceof Error ? error.message : 'Não foi possível carregar os cadastros auxiliares.',
      )
    })
  }

  function requestDetail(idSolicitacao: string, force = false) {
    if (!force) {
      const cached = detailCacheRef.current.get(idSolicitacao)
      if (cached) return Promise.resolve(cached)
      const running = detailRequestsRef.current.get(idSolicitacao)
      if (running) return running
    }

    const request = fetchAdministrativeSolicitationDetail(idSolicitacao)
      .then((loaded) => {
        detailCacheRef.current.set(idSolicitacao, loaded)
        return loaded
      })
      .finally(() => {
        detailRequestsRef.current.delete(idSolicitacao)
      })

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

  async function refreshMetadata() {
    const loaded = await fetchAdministrativeSolicitationMetadata()
    setMetadata(loaded)
    if (registrationYear === 'TODOS' && registrationMonth === 'TODOS' && registrationDate === 'TODOS') {
      setPeriodSummary(loaded.resumo)
    }
  }

  async function handleWorkflowChanged(idSolicitacao: string, message: string) {
    await Promise.all([refreshItems(), refreshDetail(idSolicitacao), refreshMetadata()])
    notify('success', message)
  }

  async function handleCorrectionSaved(idSolicitacao: string) {
    await Promise.all([refreshItems(), refreshDetail(idSolicitacao), refreshMetadata()])
    notify('success', 'Correção registrada com sucesso e histórico preservado na auditoria.')
  }

  async function handleDelete(item: AdministrativeSolicitationListItem) {
    const reason = window.prompt(
      `Informe o motivo para excluir ${item.idSolicitacao}. A exclusão será registrada na auditoria.`,
      '',
    )
    if (reason == null) return
    if (reason.trim().length < 5) {
      notify('error', 'Informe um motivo de exclusão com pelo menos 5 caracteres.')
      return
    }

    const confirmed = window.confirm(
      `Excluir definitivamente a solicitação ${item.idSolicitacao}? O registro e eventuais jornadas parciais serão removidos da base operacional, preservando um snapshot na auditoria.`,
    )
    if (!confirmed) return

    setDeleteLoading(item.idSolicitacao)
    try {
      await deleteAdministrativeSolicitation({
        idSolicitacao: item.idSolicitacao,
        motivoExclusao: reason.trim(),
      })
      detailCacheRef.current.delete(item.idSolicitacao)
      detailRequestsRef.current.delete(item.idSolicitacao)

      if (items.length === 1 && currentPage > 1) {
        setCurrentPage((page) => Math.max(1, page - 1))
        await refreshMetadata()
      } else {
        await Promise.all([refreshItems(), refreshMetadata()])
      }
      notify('success', `Solicitação ${item.idSolicitacao} excluída e registrada na auditoria.`)
    } catch (error) {
      notify('error', error instanceof Error ? error.message : 'Não foi possível excluir a solicitação.')
    } finally {
      setDeleteLoading(null)
    }
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 350)
    return () => window.clearTimeout(timeout)
  }, [search])

  useEffect(() => {
    setCurrentPage(1)
  }, [debouncedSearch, typeFilter, statusFilter, registrationYear, registrationMonth, registrationDate, pageSize])

  useEffect(() => {
    const controller = new AbortController()
    const requestId = ++listRequestRef.current
    setLoading(true)

    void fetchAdministrativeSolicitations(listQuery(), controller.signal)
      .then((response) => {
        if (requestId !== listRequestRef.current) return
        applyListResponse(response)
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        notify('error', error instanceof Error ? error.message : 'Erro ao carregar solicitações.')
      })
      .finally(() => {
        if (requestId === listRequestRef.current) setLoading(false)
      })

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
        .then((response) => {
          if (disposed || requestId !== listRequestRef.current) return
          applyListResponse(response)
        })
        .catch(() => undefined)
    }

    const interval = window.setInterval(revalidate, BACKGROUND_REVALIDATION_MS)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') revalidate()
    }
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
        if (!periodSummary && registrationYear === 'TODOS' && registrationMonth === 'TODOS') {
          setPeriodSummary(loaded.resumo)
        }
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        notify(
          'error',
          error instanceof Error
            ? `Fila carregada. Metadados indisponíveis: ${error.message}`
            : 'Fila carregada, mas os metadados não puderam ser carregados.',
        )
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
    const months = new Set(
      (metadata?.datasRegistro || [])
        .filter((date) => date.slice(0, 4) === registrationYear)
        .map((date) => date.slice(5, 7)),
    )
    if (registrationMonth !== 'TODOS') months.add(registrationMonth)
    return Array.from(months).sort((left, right) => Number(left) - Number(right))
  }, [metadata, registrationMonth, registrationYear])

  const registrationDates = useMemo(() => {
    if (registrationYear === 'TODOS' || registrationMonth === 'TODOS') return []
    return (metadata?.datasRegistro || [])
      .filter((date) => date.slice(0, 4) === registrationYear && date.slice(5, 7) === registrationMonth)
      .sort((left, right) => right.localeCompare(left))
  }, [metadata, registrationYear, registrationMonth])

  const metrics = periodSummary
  const periodDetail = registrationYear !== 'TODOS' && registrationMonth !== 'TODOS'
    ? `${monthLabels[Number(registrationMonth) - 1]}/${registrationYear}`
    : registrationYear !== 'TODOS'
      ? registrationYear
      : 'base completa'

  const summary: SummaryMetricItem[] = [
    {
      key: 'all',
      label: 'Total',
      value: metrics?.total ?? '—',
      detail: `no período · ${periodDetail}`,
      icon: 'dataset',
      tone: 'neutral',
      active: statusFilter === 'TODOS',
      onClick: () => setStatusFilter('TODOS'),
    },
    {
      key: 'triage',
      label: 'Aguardando triagem',
      value: metrics?.aguardandoTriagem ?? '—',
      detail: `no período · ${periodDetail}`,
      icon: 'pending_actions',
      tone: 'info',
      active: statusFilter === 'Aguardando triagem',
      onClick: () => setStatusFilter('Aguardando triagem'),
    },
    {
      key: 'actual',
      label: 'Aguardando realizado',
      value: metrics?.aguardandoRealizado ?? '—',
      detail: `no período · ${periodDetail}`,
      icon: 'groups',
      tone: 'warning',
      active: statusFilter === 'Aguardando realizado',
      onClick: () => setStatusFilter('Aguardando realizado'),
    },
    {
      key: 'div',
      label: 'Com divergência',
      value: metrics?.divergencias ?? '—',
      detail: `no período · ${periodDetail}`,
      icon: 'error',
      tone: 'danger',
      active: statusFilter === 'Com divergência',
      onClick: () => setStatusFilter('Com divergência'),
    },
  ]

  const hasActiveFilters =
    Boolean(search.trim()) ||
    typeFilter !== 'TODOS' ||
    statusFilter !== 'TODOS' ||
    registrationYear !== 'TODOS' ||
    registrationMonth !== 'TODOS' ||
    registrationDate !== 'TODOS'

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

  useEffect(() => {
    if (pageSize <= pageSizeLimit) return
    setPageSize(pageSizeLimit)
  }, [pageSize, pageSizeLimit])

  const pageStart = total === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd = Math.min(currentPage * pageSize, total)

  return (
    <section className="admin-page">
      <PageHeader
        eyebrow="CONTROLE DE CUSTOS EXTRAS"
        title="Solicitações"
        description="Conferência, triagem, precificação e acompanhamento do realizado em um único workspace administrativo."
      />

      {notice && (
        <div
          className={`admin-alert ${notice.tone === 'success' ? 'admin-alert-success' : ''}`.trim()}
          role={notice.tone === 'error' ? 'alert' : 'status'}
        >
          <span className="material-symbols-rounded" aria-hidden="true">
            {notice.tone === 'success' ? 'check_circle' : 'error'}
          </span>
          <span>{notice.message}</span>
          <button type="button" className="admin-alert-close" onClick={() => setNotice(null)} aria-label="Fechar notificação">
            <span className="material-symbols-rounded" aria-hidden="true">close</span>
          </button>
        </div>
      )}

      <SummaryMetrics items={summary} ariaLabel="Filtrar solicitações por situação" />

      <Panel className="admin-list-workspace admin-list-workspace-full">
        <PanelHeader
          eyebrow="REGISTROS"
          title="Fila administrativa"
          description={`${total} registro(s) após filtros · busca e filtros aplicados sobre toda a base.`}
          trailing={<Chip>{total} encontrados</Chip>}
        />

        <PageToolbar
          embedded
          ariaLabel="Filtros das solicitações"
          search={
            <SearchField
              ariaLabel="Pesquisar solicitações"
              placeholder="Protocolo, operação, supervisor…"
              value={search}
              onChange={setSearch}
            />
          }
          filters={
            <>
              <select value={registrationYear} onChange={(event) => handleYearChange(event.target.value)} aria-label="Ano da data de registro">
                <option value="TODOS">Ano: todos</option>
                {registrationYears.map((year) => <option key={year} value={year}>{year}</option>)}
              </select>

              <select
                value={registrationMonth}
                onChange={(event) => handleMonthChange(event.target.value)}
                aria-label="Mês da data de registro"
                disabled={registrationYear === 'TODOS'}
              >
                <option value="TODOS">{registrationYear === 'TODOS' ? 'Mês: selecione o ano' : 'Mês: todos'}</option>
                {registrationMonths.map((month) => <option key={month} value={month}>{monthLabels[Number(month) - 1]}</option>)}
              </select>

              <select
                value={registrationDate}
                onChange={(event) => setRegistrationDate(event.target.value)}
                aria-label="Data completa do registro"
                disabled={registrationYear === 'TODOS' || registrationMonth === 'TODOS'}
              >
                <option value="TODOS">{registrationMonth === 'TODOS' ? 'Data: selecione o mês' : 'Data: todas'}</option>
                {registrationDates.map((date) => <option key={date} value={date}>{formatDate(date)}</option>)}
              </select>

              <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Tipo da solicitação">
                <option value="TODOS">Todos os tipos</option>
                <option value="MAO_DE_OBRA">Mão de obra</option>
                <option value="ALIMENTACAO_BEBIDA">Alimentação / Bebida</option>
              </select>

              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Situação da solicitação">
                <option value="TODOS">Todas as situações</option>
                {statusOptions.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>

              <button type="button" className="button" onClick={clearAllFilters} disabled={!hasActiveFilters}>Limpar filtros</button>
            </>
          }
        />

        <div className="admin-results">
          {loading ? (
            <Skeleton lines={7} />
          ) : items.length === 0 ? (
            <EmptyState title="Nenhuma solicitação encontrada" description="A busca atual não possui registros. Ajuste a busca ou limpe os filtros." />
          ) : (
            <div className="table-wrap embedded admin-record-table-wrap">
              <table className="responsive-data-table admin-record-table">
                <thead>
                  <tr>
                    <th>Solicitação</th>
                    <th>Registro</th>
                    <th>Data operacional</th>
                    <th>Operação</th>
                    <th>Tipo</th>
                    <th>Status</th>
                    <th className="admin-quantity-column">Qtd. prevista</th>
                    <th className="admin-quantity-column">Qtd. real</th>
                    <th className="admin-money-column">Previsto</th>
                    <th className="admin-money-column">Valor real</th>
                    <th className="admin-actions-header">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => {
                    const status = statusInfo(item)
                    const isLabor = item.tipoSolicitacao === 'MAO_DE_OBRA'
                    const rowBusy = detailLoading || Boolean(deleteLoading)
                    return (
                      <tr key={item.idSolicitacao}>
                        <td data-label="Solicitação" data-primary="true">
                          <div className="table-primary"><strong>{item.idSolicitacao}</strong><small>{item.supervisor || 'Sem supervisor'}</small></div>
                        </td>
                        <td data-label="Registro"><strong>{formatDateTime(item.dataCriacao)}</strong></td>
                        <td data-label="Data operacional"><strong>{formatDate(item.dataOperacional)}</strong></td>
                        <td data-label="Operação"><strong>{item.operacao || '—'}</strong></td>
                        <td data-label="Tipo"><span className="module-badge">{typeLabel(item.tipoSolicitacao)}</span></td>
                        <td data-label="Status"><Badge tone={status.tone}>{status.label}</Badge></td>
                        <td data-label="Qtd. prevista" className="admin-quantity-column"><strong>{isLabor ? formatQuantity(item.qtdSolicitada) : '—'}</strong></td>
                        <td data-label="Qtd. real" className="admin-quantity-column"><strong>{isLabor ? formatQuantity(item.qtdComparecida) : '—'}</strong></td>
                        <td data-label="Previsto" className="admin-money-column"><strong>{formatMoney(item.valorPrevisto)}</strong></td>
                        <td data-label="Valor real" className="admin-money-column"><strong>{formatMoney(item.valorReal)}</strong></td>
                        <td data-label="Ações" className="admin-row-actions-cell">
                          <div className="admin-row-actions">
                            <button type="button" className="button button-compact" onClick={() => void openCorrection(item.idSolicitacao)} disabled={rowBusy}>
                              <span className="material-symbols-rounded" aria-hidden="true">edit</span>Editar
                            </button>
                            <button type="button" className="button button-primary button-compact" onClick={() => void openDetail(item.idSolicitacao)} disabled={rowBusy}>
                              <span className="material-symbols-rounded" aria-hidden="true">open_in_new</span>Abrir
                            </button>
                            <button type="button" className="button button-danger button-compact" onClick={() => void handleDelete(item)} disabled={rowBusy}>
                              <span className="material-symbols-rounded" aria-hidden="true">delete</span>
                              {deleteLoading === item.idSolicitacao ? 'Excluindo…' : 'Excluir'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {!loading && total > 0 && (
          <footer className="admin-pagination">
            <div className="admin-pagination-size">
              <span>Registros por página</span>
              <select value={String(pageSize)} onChange={(event) => setPageSize(Number(event.target.value))} aria-label="Registros por página">
                {pageSizeOptions.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </div>
            <span className="admin-pagination-range">{pageStart}–{pageEnd} de {total}</span>
            <div className="admin-pagination-nav" aria-label="Navegação de páginas">
              <button type="button" className="icon-button" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage <= 1 || loading} aria-label="Página anterior">
                <span className="material-symbols-rounded" aria-hidden="true">chevron_left</span>
              </button>
              <span>Página {currentPage} de {totalPages}</span>
              <button type="button" className="icon-button" onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage >= totalPages || loading} aria-label="Próxima página">
                <span className="material-symbols-rounded" aria-hidden="true">chevron_right</span>
              </button>
            </div>
          </footer>
        )}
      </Panel>

      <SolicitationDetailModal
        open={workflowOpen}
        loading={detailLoading}
        detail={detail}
        catalogs={catalogs}
        onClose={closeWorkflow}
        onChanged={handleWorkflowChanged}
        onNotify={notify}
      />

      <SolicitationCorrectionModal
        open={correctionOpen}
        loading={detailLoading}
        detail={detail}
        catalogs={catalogs}
        onClose={closeCorrection}
        onSaved={handleCorrectionSaved}
      />
    </section>
  )
}
