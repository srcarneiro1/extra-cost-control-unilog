import { useEffect, useMemo, useState } from 'react'
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
  fetchAdministrativeSolicitationDetail,
  fetchAdministrativeSolicitations,
} from '../services/solicitationService'
import type { CatalogosDto } from '../types/catalog'
import type {
  AdministrativeSolicitationDetail,
  AdministrativeSolicitationListItem,
} from '../types/solicitation'

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
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

const statusOrder = [
  'Aguardando triagem',
  'Aguardando realizado',
  'Triagem concluída',
  'Com divergência',
  'Concluído',
]

function formatMoney(value: number | null) {
  return value == null ? '—' : money.format(value)
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

function registrationParts(value: string) {
  const date = value.slice(0, 10)
  const [year, month] = date.split('-')
  return {
    date,
    year: year || '',
    month: month || '',
  }
}

function typeLabel(value: string) {
  return value === 'MAO_DE_OBRA' ? 'Mão de obra' : 'Alimentação / Bebida'
}

function statusInfo(item: AdministrativeSolicitationListItem) {
  if (!item.triagemConcluida) {
    return { label: 'Aguardando triagem', tone: 'neutral' as const }
  }
  if (item.tipoSolicitacao === 'ALIMENTACAO_BEBIDA') {
    return { label: 'Triagem concluída', tone: 'success' as const }
  }
  if (!item.realizadoRegistrado) {
    return { label: 'Aguardando realizado', tone: 'warning' as const }
  }
  if (item.divergencia) {
    return { label: 'Com divergência', tone: 'danger' as const }
  }
  return { label: 'Concluído', tone: 'success' as const }
}

type Notice = {
  tone: 'success' | 'error'
  message: string
}

export function AdminSolicitationsPage() {
  const [items, setItems] = useState<AdministrativeSolicitationListItem[]>([])
  const [detail, setDetail] = useState<AdministrativeSolicitationDetail | null>(null)
  const [catalogs, setCatalogs] = useState<CatalogosDto | null>(null)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('TODOS')
  const [statusFilter, setStatusFilter] = useState('TODOS')
  const [registrationYear, setRegistrationYear] = useState('TODOS')
  const [registrationMonth, setRegistrationMonth] = useState('TODOS')
  const [registrationDate, setRegistrationDate] = useState('TODOS')

  const [pageSize, setPageSize] = useState(10)
  const [currentPage, setCurrentPage] = useState(1)

  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [workflowOpen, setWorkflowOpen] = useState(false)
  const [correctionOpen, setCorrectionOpen] = useState(false)

  function notify(tone: Notice['tone'], message: string) {
    setNotice({ tone, message })
  }

  async function refreshItems() {
    const response = await fetchAdministrativeSolicitations(500)
    setItems(response.itens)
  }

  async function refreshDetail(idSolicitacao: string) {
    const loaded = await fetchAdministrativeSolicitationDetail(idSolicitacao)
    setDetail(loaded)
    return loaded
  }

  async function openDetail(idSolicitacao: string) {
    setDetail(null)
    setDetailLoading(true)
    setWorkflowOpen(false)
    setCorrectionOpen(false)

    try {
      await refreshDetail(idSolicitacao)
      setWorkflowOpen(true)
    } catch (error) {
      notify(
        'error',
        error instanceof Error ? error.message : 'Não foi possível carregar a solicitação.',
      )
    } finally {
      setDetailLoading(false)
    }
  }

  async function openCorrection(idSolicitacao: string) {
    setDetail(null)
    setDetailLoading(true)
    setCorrectionOpen(false)
    setWorkflowOpen(false)

    try {
      await refreshDetail(idSolicitacao)
      setCorrectionOpen(true)
    } catch (error) {
      notify(
        'error',
        error instanceof Error ? error.message : 'Não foi possível carregar a solicitação para edição.',
      )
    } finally {
      setDetailLoading(false)
    }
  }

  async function handleWorkflowChanged(idSolicitacao: string, message: string) {
    await Promise.all([refreshItems(), refreshDetail(idSolicitacao)])
    notify('success', message)
  }

  async function handleCorrectionSaved(idSolicitacao: string) {
    await Promise.all([refreshItems(), refreshDetail(idSolicitacao)])
    notify('success', 'Correção registrada com sucesso e histórico preservado na auditoria.')
  }

  useEffect(() => {
    const controller = new AbortController()

    Promise.all([
      fetchAdministrativeSolicitations(500, controller.signal),
      fetchCatalogos(controller.signal),
    ])
      .then(([response, loadedCatalogs]) => {
        setItems(response.itens)
        setCatalogs(loadedCatalogs)
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        notify(
          'error',
          error instanceof Error ? error.message : 'Erro ao carregar painel administrativo.',
        )
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(
      () => setNotice(null),
      notice.tone === 'success' ? 4500 : 8000,
    )
    return () => window.clearTimeout(timeout)
  }, [notice])

  const registrationYears = useMemo(
    () =>
      Array.from(
        new Set(items.map((item) => registrationParts(item.dataCriacao).year).filter(Boolean)),
      ).sort((left, right) => right.localeCompare(left)),
    [items],
  )

  const registrationMonths = useMemo(() => {
    if (registrationYear === 'TODOS') return []

    return Array.from(
      new Set(
        items
          .filter((item) => registrationParts(item.dataCriacao).year === registrationYear)
          .map((item) => registrationParts(item.dataCriacao).month)
          .filter(Boolean),
      ),
    ).sort((left, right) => Number(left) - Number(right))
  }, [items, registrationYear])

  const registrationDates = useMemo(() => {
    if (registrationYear === 'TODOS' || registrationMonth === 'TODOS') return []

    return Array.from(
      new Set(
        items
          .filter((item) => {
            const parts = registrationParts(item.dataCriacao)
            return parts.year === registrationYear && parts.month === registrationMonth
          })
          .map((item) => registrationParts(item.dataCriacao).date)
          .filter(Boolean),
      ),
    ).sort((left, right) => right.localeCompare(left))
  }, [items, registrationYear, registrationMonth])

  const periodItems = useMemo(
    () =>
      items.filter((item) => {
        const parts = registrationParts(item.dataCriacao)
        return (
          (registrationYear === 'TODOS' || parts.year === registrationYear) &&
          (registrationMonth === 'TODOS' || parts.month === registrationMonth) &&
          (registrationDate === 'TODOS' || parts.date === registrationDate)
        )
      }),
    [items, registrationYear, registrationMonth, registrationDate],
  )

  const preStatusItems = useMemo(() => {
    const query = search.trim().toUpperCase()

    return periodItems.filter((item) => {
      const textMatches =
        !query ||
        [
          item.idSolicitacao,
          item.operacao,
          item.supervisor,
          item.fornecedor,
          item.usuarioCriacao,
        ].some((value) => value.toUpperCase().includes(query))
      const typeMatches = typeFilter === 'TODOS' || item.tipoSolicitacao === typeFilter
      return textMatches && typeMatches
    })
  }, [periodItems, search, typeFilter])

  const availableStatuses = useMemo(() => {
    const present = new Set(preStatusItems.map((item) => statusInfo(item).label))
    return statusOrder.filter((status) => present.has(status))
  }, [preStatusItems])

  useEffect(() => {
    if (statusFilter !== 'TODOS' && !availableStatuses.includes(statusFilter)) {
      setStatusFilter('TODOS')
    }
  }, [availableStatuses, statusFilter])

  const filteredItems = useMemo(
    () =>
      preStatusItems.filter(
        (item) => statusFilter === 'TODOS' || statusInfo(item).label === statusFilter,
      ),
    [preStatusItems, statusFilter],
  )

  const metrics = useMemo(
    () => ({
      total: periodItems.length,
      pending: periodItems.filter((item) => !item.triagemConcluida).length,
      awaiting: periodItems.filter(
        (item) =>
          item.tipoSolicitacao === 'MAO_DE_OBRA' &&
          item.triagemConcluida &&
          !item.realizadoRegistrado,
      ).length,
      divergences: periodItems.filter((item) => item.divergencia).length,
    }),
    [periodItems],
  )

  const summary: SummaryMetricItem[] = [
    {
      key: 'all',
      label: 'Total',
      value: metrics.total,
      detail: 'no período de registro',
      icon: 'dataset',
      tone: 'neutral',
      active: statusFilter === 'TODOS',
      onClick: () => setStatusFilter('TODOS'),
    },
    {
      key: 'triage',
      label: 'Aguardando triagem',
      value: metrics.pending,
      detail: 'exigem definição administrativa',
      icon: 'pending_actions',
      tone: 'info',
      active: statusFilter === 'Aguardando triagem',
      onClick: metrics.pending > 0 ? () => setStatusFilter('Aguardando triagem') : undefined,
    },
    {
      key: 'actual',
      label: 'Aguardando realizado',
      value: metrics.awaiting,
      detail: 'mão de obra já precificada',
      icon: 'groups',
      tone: 'warning',
      active: statusFilter === 'Aguardando realizado',
      onClick: metrics.awaiting > 0 ? () => setStatusFilter('Aguardando realizado') : undefined,
    },
    {
      key: 'div',
      label: 'Com divergência',
      value: metrics.divergences,
      detail: 'solicitado x comparecido',
      icon: 'error',
      tone: 'danger',
      active: statusFilter === 'Com divergência',
      onClick: metrics.divergences > 0 ? () => setStatusFilter('Com divergência') : undefined,
    },
  ]

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize))

  useEffect(() => {
    setCurrentPage(1)
  }, [
    search,
    typeFilter,
    statusFilter,
    registrationYear,
    registrationMonth,
    registrationDate,
    pageSize,
  ])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, currentPage, pageSize])

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
  }

  const pageStart = filteredItems.length === 0 ? 0 : (currentPage - 1) * pageSize + 1
  const pageEnd = Math.min(currentPage * pageSize, filteredItems.length)

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
          <button
            type="button"
            className="admin-alert-close"
            onClick={() => setNotice(null)}
            aria-label="Fechar notificação"
          >
            <span className="material-symbols-rounded" aria-hidden="true">close</span>
          </button>
        </div>
      )}

      <SummaryMetrics items={summary} ariaLabel="Filtrar solicitações por situação" />

      <Panel className="admin-list-workspace admin-list-workspace-full">
        <PanelHeader
          eyebrow="REGISTROS"
          title="Fila administrativa"
          description={`${filteredItems.length} registro(s) após filtros · período baseado na data de registro, não na data operacional.`}
          trailing={<Chip>{periodItems.length} no período</Chip>}
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
              <select
                value={registrationYear}
                onChange={(event) => handleYearChange(event.target.value)}
                aria-label="Ano da data de registro"
              >
                <option value="TODOS">Ano: todos</option>
                {registrationYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>

              <select
                value={registrationMonth}
                onChange={(event) => handleMonthChange(event.target.value)}
                aria-label="Mês da data de registro"
                disabled={registrationYear === 'TODOS'}
              >
                <option value="TODOS">
                  {registrationYear === 'TODOS' ? 'Mês: selecione o ano' : 'Mês: todos'}
                </option>
                {registrationMonths.map((month) => (
                  <option key={month} value={month}>{monthLabels[Number(month) - 1]}</option>
                ))}
              </select>

              <select
                value={registrationDate}
                onChange={(event) => setRegistrationDate(event.target.value)}
                aria-label="Data completa do registro"
                disabled={registrationYear === 'TODOS' || registrationMonth === 'TODOS'}
              >
                <option value="TODOS">
                  {registrationMonth === 'TODOS' ? 'Data: selecione o mês' : 'Data: todas'}
                </option>
                {registrationDates.map((date) => (
                  <option key={date} value={date}>{formatDate(date)}</option>
                ))}
              </select>

              <select
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
                aria-label="Tipo da solicitação"
              >
                <option value="TODOS">Todos os tipos</option>
                <option value="MAO_DE_OBRA">Mão de obra</option>
                <option value="ALIMENTACAO_BEBIDA">Alimentação / Bebida</option>
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Situação da solicitação"
              >
                <option value="TODOS">Todas as situações</option>
                {availableStatuses.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>

              <button
                type="button"
                className="button"
                onClick={clearAllFilters}
                disabled={!hasActiveFilters}
              >
                Limpar filtros
              </button>
            </>
          }
        />

        <div className="admin-results">
          {loading ? (
            <Skeleton lines={7} />
          ) : filteredItems.length === 0 ? (
            <EmptyState
              title="Nenhuma solicitação encontrada"
              description="A busca atual não possui registros. Ajuste a busca ou limpe os filtros."
            />
          ) : (
            <div className="table-wrap embedded">
              <table className="responsive-data-table admin-record-table">
                <thead>
                  <tr>
                    <th>Solicitação</th>
                    <th>Registro</th>
                    <th>Data operacional</th>
                    <th>Operação</th>
                    <th>Tipo</th>
                    <th>Status</th>
                    <th className="admin-money-column">Previsto</th>
                    <th className="admin-money-column">Valor real</th>
                    <th className="admin-actions-header">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.map((item) => {
                    const status = statusInfo(item)
                    return (
                      <tr key={item.idSolicitacao}>
                        <td data-label="Solicitação" data-primary="true">
                          <div className="table-primary">
                            <strong>{item.idSolicitacao}</strong>
                            <small>{item.supervisor || 'Sem supervisor'}</small>
                          </div>
                        </td>
                        <td data-label="Registro"><strong>{formatDateTime(item.dataCriacao)}</strong></td>
                        <td data-label="Data operacional"><strong>{formatDate(item.dataOperacional)}</strong></td>
                        <td data-label="Operação"><strong>{item.operacao || '—'}</strong></td>
                        <td data-label="Tipo"><span className="module-badge">{typeLabel(item.tipoSolicitacao)}</span></td>
                        <td data-label="Status"><Badge tone={status.tone}>{status.label}</Badge></td>
                        <td data-label="Previsto" className="admin-money-column"><strong>{formatMoney(item.valorPrevisto)}</strong></td>
                        <td data-label="Valor real" className="admin-money-column"><strong>{formatMoney(item.valorReal)}</strong></td>
                        <td data-label="Ações" className="admin-row-actions-cell">
                          <div className="admin-row-actions">
                            <button
                              type="button"
                              className="button button-compact"
                              onClick={() => void openCorrection(item.idSolicitacao)}
                              disabled={detailLoading}
                            >
                              <span className="material-symbols-rounded" aria-hidden="true">edit</span>
                              Editar
                            </button>
                            <button
                              type="button"
                              className="button button-primary button-compact"
                              onClick={() => void openDetail(item.idSolicitacao)}
                              disabled={detailLoading}
                            >
                              <span className="material-symbols-rounded" aria-hidden="true">open_in_new</span>
                              Abrir
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

        {!loading && filteredItems.length > 0 && (
          <footer className="admin-pagination">
            <div className="admin-pagination-size">
              <span>Registros por página</span>
              <select
                value={String(pageSize)}
                onChange={(event) => setPageSize(Number(event.target.value))}
                aria-label="Registros por página"
              >
                <option value="10">10</option>
                <option value="15">15</option>
                <option value="20">20</option>
              </select>
            </div>

            <span className="admin-pagination-range">
              {pageStart}–{pageEnd} de {filteredItems.length}
            </span>

            <div className="admin-pagination-nav" aria-label="Navegação de páginas">
              <button
                type="button"
                className="icon-button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage <= 1}
                aria-label="Página anterior"
              >
                <span className="material-symbols-rounded" aria-hidden="true">chevron_left</span>
              </button>
              <span>Página {currentPage} de {totalPages}</span>
              <button
                type="button"
                className="icon-button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage >= totalPages}
                aria-label="Próxima página"
              >
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
        onClose={() => setWorkflowOpen(false)}
        onChanged={handleWorkflowChanged}
        onNotify={notify}
      />

      <SolicitationCorrectionModal
        open={correctionOpen}
        detail={detail}
        catalogs={catalogs}
        onClose={() => setCorrectionOpen(false)}
        onSaved={handleCorrectionSaved}
      />
    </section>
  )
}
