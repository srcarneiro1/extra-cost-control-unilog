import { useEffect, useMemo, useState } from 'react'
import { PageHeader } from './PageHeader'
import { SolicitationCorrectionModal } from './SolicitationCorrectionModal'
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
  applyAdministrativeTriage,
  fetchAdministrativeSolicitationDetail,
  fetchAdministrativeSolicitations,
  registerAdministrativeAttendance,
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

function formatMoney(value: number | null) {
  return value == null ? '—' : money.format(value)
}

function formatDate(value: string) {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function formatDateShort(value: string) {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year.slice(-2)}` : value
}

function formatDateTime(value: string) {
  if (!value) return '—'
  const date = formatDate(value)
  const time = value.length >= 16 ? value.slice(11, 16) : ''
  return time ? `${date} ${time}` : date
}

function registrationParts(value: string) {
  const date = value.slice(0, 10)
  const [year, month, day] = date.split('-')
  return {
    date,
    year: year || '',
    month: month || '',
    day: day || '',
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

function DetailField({
  label,
  value,
}: {
  label: string
  value: string | number | null
}) {
  return (
    <div className="admin-detail-field">
      <span>{label}</span>
      <strong>{value === '' || value == null ? '—' : value}</strong>
    </div>
  )
}

function buildWhatsAppMessage(detail: AdministrativeSolicitationDetail) {
  const lines: string[] = []
  lines.push(`Pedido para ${formatDateShort(detail.dataOperacional)}`)

  if (detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA') {
    const products: string[] = []
    if (detail.produtoAlimentacao && detail.qtdAlimentacao != null) {
      products.push(`${detail.qtdAlimentacao} ${detail.produtoAlimentacao}`)
    }
    if (detail.produtoBebida && detail.qtdBebida != null) {
      products.push(`${detail.qtdBebida} ${detail.produtoBebida}`)
    }
    if (products.length) lines.push(products.join(' + '))
  } else {
    if (detail.qtdSolicitada != null && detail.funcao) {
      lines.push(`${detail.qtdSolicitada} ${detail.funcao}`)
    }
    if (detail.atividade) lines.push(`Atividade: ${detail.atividade}`)
    if (detail.turno) lines.push(`Turno: ${detail.turno}`)
  }

  if (detail.supervisor) lines.push(`Supervisor(a) ${detail.supervisor}`)
  if (detail.justificativa) lines.push(`Observação: ${detail.justificativa}`)
  lines.push(`Protocolo: ${detail.idSolicitacao}`)
  return lines.join('\n')
}

export function AdminSolicitationsPage() {
  const [items, setItems] = useState<AdministrativeSolicitationListItem[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [detail, setDetail] = useState<AdministrativeSolicitationDetail | null>(null)
  const [catalogs, setCatalogs] = useState<CatalogosDto | null>(null)

  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('TODOS')
  const [statusFilter, setStatusFilter] = useState('TODOS')
  const [registrationYear, setRegistrationYear] = useState('TODOS')
  const [registrationMonth, setRegistrationMonth] = useState('TODOS')
  const [registrationDate, setRegistrationDate] = useState('TODOS')

  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [provider, setProvider] = useState('')
  const [appliedFood, setAppliedFood] = useState('')
  const [appliedDrink, setAppliedDrink] = useState('')
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [attendance, setAttendance] = useState('')
  const [correctionOpen, setCorrectionOpen] = useState(false)

  async function reload(selected = selectedId) {
    const response = await fetchAdministrativeSolicitations(500)
    setItems(response.itens)
    const next = selected || response.itens[0]?.idSolicitacao || ''
    setSelectedId(next)
    if (next) setDetail(await fetchAdministrativeSolicitationDetail(next))
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
        setSelectedId((current) => current || response.itens[0]?.idSolicitacao || '')
        setError('')
      })
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setError(
          requestError instanceof Error
            ? requestError.message
            : 'Erro ao carregar painel administrativo.',
        )
      })
      .finally(() => setLoading(false))

    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }

    const controller = new AbortController()
    setDetailLoading(true)
    setSuccess('')

    fetchAdministrativeSolicitationDetail(selectedId, controller.signal)
      .then((loaded) => {
        setDetail(loaded)
        setProvider(loaded.fornecedor || '')
        setAppliedFood(loaded.produtoAlimentacaoAplicado || loaded.produtoAlimentacao || '')
        setAppliedDrink(loaded.produtoBebidaAplicado || loaded.produtoBebida || '')
        setAdjustmentReason(loaded.motivoAjusteProduto || '')
        setAttendance(loaded.qtdComparecida == null ? '' : String(loaded.qtdComparecida))
      })
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setError(requestError instanceof Error ? requestError.message : 'Erro ao carregar detalhe.')
      })
      .finally(() => setDetailLoading(false))

    return () => controller.abort()
  }, [selectedId])

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
        const yearMatches =
          registrationYear === 'TODOS' || parts.year === registrationYear
        const monthMatches =
          registrationMonth === 'TODOS' || parts.month === registrationMonth
        const dateMatches =
          registrationDate === 'TODOS' || parts.date === registrationDate
        return yearMatches && monthMatches && dateMatches
      }),
    [items, registrationYear, registrationMonth, registrationDate],
  )

  const filteredItems = useMemo(() => {
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
      const statusMatches = statusFilter === 'TODOS' || statusInfo(item).label === statusFilter

      return textMatches && typeMatches && statusMatches
    })
  }, [periodItems, search, typeFilter, statusFilter])

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
      onClick: () => setStatusFilter('Aguardando triagem'),
    },
    {
      key: 'actual',
      label: 'Aguardando realizado',
      value: metrics.awaiting,
      detail: 'mão de obra já precificada',
      icon: 'groups',
      tone: 'warning',
      active: statusFilter === 'Aguardando realizado',
      onClick: () => setStatusFilter('Aguardando realizado'),
    },
    {
      key: 'div',
      label: 'Com divergência',
      value: metrics.divergences,
      detail: 'solicitado x comparecido',
      icon: 'error',
      tone: 'danger',
      active: statusFilter === 'Com divergência',
      onClick: () => setStatusFilter('Com divergência'),
    },
  ]

  const eligibleProviders = useMemo(
    () =>
      !catalogs || !detail
        ? []
        : catalogs.fornecedores.filter((item) =>
            item.tiposSolicitacao.includes(detail.tipoSolicitacao),
          ),
    [catalogs, detail],
  )

  const foods = catalogs?.produtos.filter((item) => item.categoria === 'ALIMENTACAO') || []
  const drinks = catalogs?.produtos.filter((item) => item.categoria === 'BEBIDA') || []

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

  async function handleTriage() {
    if (!detail || detail.triagemConcluida || !provider) return

    setActionLoading(true)
    setError('')
    setSuccess('')

    try {
      await applyAdministrativeTriage({
        idSolicitacao: detail.idSolicitacao,
        fornecedor: provider,
        ...(detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA'
          ? {
              produtoAlimentacaoAplicado: detail.produtoAlimentacao
                ? appliedFood
                : undefined,
              produtoBebidaAplicado: detail.produtoBebida ? appliedDrink : undefined,
              motivoAjusteProduto: adjustmentReason || undefined,
            }
          : {}),
      })
      await reload(detail.idSolicitacao)
      setSuccess('Triagem registrada com sucesso.')
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível registrar a triagem.',
      )
    } finally {
      setActionLoading(false)
    }
  }

  async function handleAttendance() {
    if (!detail || detail.tipoSolicitacao !== 'MAO_DE_OBRA' || detail.realizadoRegistrado) return

    const quantity = Number(attendance)
    if (!Number.isInteger(quantity) || quantity < 0) {
      setError('Quantidade comparecida deve ser um número inteiro maior ou igual a zero.')
      return
    }

    setActionLoading(true)
    setError('')
    setSuccess('')

    try {
      await registerAdministrativeAttendance({
        idSolicitacao: detail.idSolicitacao,
        qtdComparecida: quantity,
      })
      await reload(detail.idSolicitacao)
      setSuccess('Comparecimento registrado com sucesso.')
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Não foi possível registrar o comparecimento.',
      )
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCopySummary() {
    if (!detail) return

    try {
      await navigator.clipboard.writeText(buildWhatsAppMessage(detail))
      setSuccess('Resumo copiado para a área de transferência.')
      setError('')
    } catch {
      setError('Não foi possível copiar o resumo automaticamente.')
    }
  }

  function handleOpenWhatsApp() {
    if (!detail) return
    const text = encodeURIComponent(buildWhatsAppMessage(detail))
    window.open(`https://wa.me/?text=${text}`, '_blank', 'noopener,noreferrer')
  }

  async function handleCorrectionSaved(idSolicitacao: string) {
    await reload(idSolicitacao)
    setSuccess('Correção registrada com sucesso e histórico preservado na auditoria.')
    setError('')
  }

  return (
    <section className="admin-page">
      <PageHeader
        eyebrow="CONTROLE DE CUSTOS EXTRAS"
        title="Solicitações"
        description="Conferência, triagem, precificação e acompanhamento do realizado em um único workspace administrativo."
      />

      {error && (
        <div className="admin-alert" role="alert">
          <span className="material-symbols-rounded" aria-hidden="true">error</span>
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="admin-alert admin-alert-success" role="status">
          <span className="material-symbols-rounded" aria-hidden="true">check_circle</span>
          <span>{success}</span>
        </div>
      )}

      <SummaryMetrics items={summary} ariaLabel="Filtrar solicitações por situação" />

      <div className="admin-workspace-grid">
        <Panel className="admin-list-workspace">
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
                    <option key={month} value={month}>
                      {monthLabels[Number(month) - 1]}
                    </option>
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
                  <option>Aguardando triagem</option>
                  <option>Aguardando realizado</option>
                  <option>Triagem concluída</option>
                  <option>Com divergência</option>
                  <option>Concluído</option>
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
                description="Ajuste os filtros ou a busca para consultar outros registros."
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
                      <th>Previsto</th>
                      <th><span className="sr-only">Abrir</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredItems.map((item) => {
                      const status = statusInfo(item)
                      return (
                        <tr
                          key={item.idSolicitacao}
                          className={selectedId === item.idSolicitacao ? 'is-selected' : ''}
                        >
                          <td data-label="Solicitação" data-primary="true">
                            <button
                              type="button"
                              className="table-link table-primary"
                              onClick={() => setSelectedId(item.idSolicitacao)}
                            >
                              <strong>{item.idSolicitacao}</strong>
                              <small>{item.supervisor || 'Sem supervisor'}</small>
                            </button>
                          </td>
                          <td data-label="Registro"><strong>{formatDateTime(item.dataCriacao)}</strong></td>
                          <td data-label="Data operacional"><strong>{formatDate(item.dataOperacional)}</strong></td>
                          <td data-label="Operação"><strong>{item.operacao || '—'}</strong></td>
                          <td data-label="Tipo"><span className="module-badge">{typeLabel(item.tipoSolicitacao)}</span></td>
                          <td data-label="Status"><Badge tone={status.tone}>{status.label}</Badge></td>
                          <td data-label="Previsto"><strong>{formatMoney(item.valorPrevisto)}</strong></td>
                          <td className="admin-open-cell">
                            <button
                              type="button"
                              className="admin-open-link"
                              onClick={() => setSelectedId(item.idSolicitacao)}
                            >
                              Abrir
                              <span className="material-symbols-rounded" aria-hidden="true">chevron_right</span>
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Panel>

        <aside className="admin-detail-column" aria-label="Detalhe da solicitação">
          {detailLoading ? (
            <Panel><Skeleton lines={10} /></Panel>
          ) : !detail ? (
            <Panel>
              <EmptyState
                title="Selecione uma solicitação"
                description="O detalhe e as ações administrativas serão exibidos aqui."
                icon="touch_app"
              />
            </Panel>
          ) : (
            <Panel className="admin-detail-card">
              <div className="admin-detail-hero">
                <div className="admin-detail-hero-copy">
                  <span className="ui-eyebrow">SOLICITAÇÃO</span>
                  <div className="admin-detail-title">
                    <h2>{detail.idSolicitacao}</h2>
                    <Badge tone={statusInfo(detail as AdministrativeSolicitationListItem).tone}>
                      {statusInfo(detail as AdministrativeSolicitationListItem).label}
                    </Badge>
                    <button type="button" className="button" onClick={() => setCorrectionOpen(true)}>
                      <span className="material-symbols-rounded" aria-hidden="true">edit</span>
                      Editar
                    </button>
                  </div>
                  <p>{detail.operacao || 'Operação não informada'} · operacional em {formatDate(detail.dataOperacional)}</p>
                </div>
              </div>

              <div className="admin-detail-grid">
                <DetailField label="Registrado em" value={formatDateTime(detail.dataCriacao)} />
                <DetailField label="Data operacional" value={formatDate(detail.dataOperacional)} />
                <DetailField label="Operação" value={detail.operacao} />
                <DetailField label="Supervisor" value={detail.supervisor} />
                <DetailField label="Responsável custo" value={detail.responsavelCusto} />
                <DetailField label="Fornecedor" value={detail.fornecedor} />
                <DetailField label="Justificativa" value={detail.justificativa} />
                <DetailField label="Competência" value={detail.competencia} />
              </div>

              <div className="admin-action-box">
                <div className="admin-section-heading">
                  <span className="material-symbols-rounded" aria-hidden="true">share</span>
                  <div>
                    <strong>Resumo da solicitação</strong>
                    <small>Texto padronizado para aviso por WhatsApp</small>
                  </div>
                </div>
                <button className="button" type="button" onClick={() => void handleCopySummary()}>
                  Copiar resumo
                </button>
                <button className="button button-primary" type="button" onClick={handleOpenWhatsApp}>
                  Abrir WhatsApp
                </button>
              </div>

              {detail.tipoSolicitacao === 'MAO_DE_OBRA' ? (
                <div className="admin-detail-section">
                  <div className="admin-section-heading">
                    <span className="material-symbols-rounded" aria-hidden="true">groups</span>
                    <div>
                      <strong>Mão de obra</strong>
                      <small>Solicitado e realizado</small>
                    </div>
                  </div>
                  <div className="admin-detail-grid">
                    <DetailField label="Atividade" value={detail.atividade} />
                    <DetailField label="Função" value={detail.funcao} />
                    <DetailField label="Turno" value={detail.turno} />
                    <DetailField label="Qtd. solicitada" value={detail.qtdSolicitada} />
                    <DetailField label="Qtd. comparecida" value={detail.qtdComparecida} />
                    <DetailField label="Preço unitário" value={formatMoney(detail.precoUnitarioAplicado)} />
                  </div>
                </div>
              ) : (
                <div className="admin-detail-section">
                  <div className="admin-section-heading">
                    <span className="material-symbols-rounded" aria-hidden="true">lunch_dining</span>
                    <div>
                      <strong>Alimentação / Bebida</strong>
                      <small>Produto solicitado x aplicado</small>
                    </div>
                  </div>
                  <div className="admin-detail-grid">
                    <DetailField label="Alimentação solicitada" value={detail.produtoAlimentacao} />
                    <DetailField label="Alimentação aplicada" value={detail.produtoAlimentacaoAplicado} />
                    <DetailField label="Qtd. alimentação" value={detail.qtdAlimentacao} />
                    <DetailField label="Bebida solicitada" value={detail.produtoBebida} />
                    <DetailField label="Bebida aplicada" value={detail.produtoBebidaAplicado} />
                    <DetailField label="Qtd. bebida" value={detail.qtdBebida} />
                  </div>
                  {detail.motivoAjusteProduto && (
                    <div className="admin-adjustment-note">
                      <span>Motivo do ajuste</span>
                      <strong>{detail.motivoAjusteProduto}</strong>
                    </div>
                  )}
                </div>
              )}

              {!detail.triagemConcluida && (
                <div className="admin-action-box">
                  <div className="admin-section-heading">
                    <span className="material-symbols-rounded" aria-hidden="true">assignment_turned_in</span>
                    <div>
                      <strong>Triagem administrativa</strong>
                      <small>Fornecedor e preço serão congelados no registro</small>
                    </div>
                  </div>
                  <label>
                    Fornecedor
                    <select value={provider} onChange={(event) => setProvider(event.target.value)}>
                      <option value="">Selecione</option>
                      {eligibleProviders.map((item) => (
                        <option key={item.nome} value={item.nome}>{item.nome}</option>
                      ))}
                    </select>
                  </label>

                  {detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA' && (
                    <>
                      {detail.produtoAlimentacao && (
                        <label>
                          Alimentação aplicada
                          <select value={appliedFood} onChange={(event) => setAppliedFood(event.target.value)}>
                            {foods.map((item) => (
                              <option key={item.nome} value={item.nome}>{item.nome}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      {detail.produtoBebida && (
                        <label>
                          Bebida aplicada
                          <select value={appliedDrink} onChange={(event) => setAppliedDrink(event.target.value)}>
                            {drinks.map((item) => (
                              <option key={item.nome} value={item.nome}>{item.nome}</option>
                            ))}
                          </select>
                        </label>
                      )}
                      <label>
                        Motivo do ajuste
                        <textarea
                          value={adjustmentReason}
                          onChange={(event) => setAdjustmentReason(event.target.value)}
                          placeholder="Obrigatório somente quando o produto aplicado for diferente."
                        />
                      </label>
                    </>
                  )}

                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => void handleTriage()}
                    disabled={actionLoading || !provider}
                  >
                    {actionLoading ? 'Salvando…' : 'Registrar triagem'}
                  </button>
                </div>
              )}

              {detail.tipoSolicitacao === 'MAO_DE_OBRA' &&
                detail.triagemConcluida &&
                !detail.realizadoRegistrado && (
                  <div className="admin-action-box">
                    <div className="admin-section-heading">
                      <span className="material-symbols-rounded" aria-hidden="true">how_to_reg</span>
                      <div>
                        <strong>Comparecimento real</strong>
                        <small>O primeiro registro fica protegido contra sobrescrita</small>
                      </div>
                    </div>
                    <label>
                      Quantidade comparecida
                      <input
                        type="number"
                        min="0"
                        step="1"
                        value={attendance}
                        onChange={(event) => setAttendance(event.target.value)}
                      />
                    </label>
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => void handleAttendance()}
                      disabled={actionLoading || attendance === ''}
                    >
                      {actionLoading ? 'Salvando…' : 'Registrar comparecimento'}
                    </button>
                  </div>
                )}

              <div className="admin-value-strip">
                <div>
                  <span>Valor previsto</span>
                  <strong>{formatMoney(detail.valorPrevisto)}</strong>
                  <small>snapshot da triagem</small>
                </div>
                <div>
                  <span>Valor real</span>
                  <strong>{formatMoney(detail.valorReal)}</strong>
                  <small>
                    {detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA' && detail.valorReal == null
                      ? 'Ainda não apurado neste fluxo'
                      : 'calculado pelo realizado'}
                  </small>
                </div>
              </div>
            </Panel>
          )}
        </aside>
      </div>

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
