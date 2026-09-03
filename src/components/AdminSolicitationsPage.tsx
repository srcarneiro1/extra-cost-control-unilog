import { useEffect, useMemo, useState } from 'react'
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

function formatMoney(value: number | null) {
  return value == null ? '—' : money.format(value)
}

function formatDate(value: string) {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function typeLabel(value: string) {
  return value === 'MAO_DE_OBRA' ? 'Mão de obra' : 'Alimentação / Bebida'
}

function statusLabel(item: AdministrativeSolicitationListItem) {
  if (!item.triagemConcluida) return 'Aguardando triagem'
  if (item.tipoSolicitacao === 'MAO_DE_OBRA' && !item.realizadoRegistrado) {
    return 'Aguardando realizado'
  }
  if (item.divergencia) return 'Com divergência'
  return 'Concluído'
}

function statusClass(item: AdministrativeSolicitationListItem) {
  if (!item.triagemConcluida) return 'admin-status admin-status-pending'
  if (item.tipoSolicitacao === 'MAO_DE_OBRA' && !item.realizadoRegistrado) {
    return 'admin-status admin-status-warning'
  }
  if (item.divergencia) return 'admin-status admin-status-danger'
  return 'admin-status admin-status-success'
}

function DetailField({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="admin-detail-field">
      <span>{label}</span>
      <strong>{value === '' || value == null ? '—' : value}</strong>
    </div>
  )
}

export function AdminSolicitationsPage() {
  const [items, setItems] = useState<AdministrativeSolicitationListItem[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [detail, setDetail] = useState<AdministrativeSolicitationDetail | null>(null)
  const [catalogs, setCatalogs] = useState<CatalogosDto | null>(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('TODOS')
  const [statusFilter, setStatusFilter] = useState('TODOS')
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

  async function reload(selected = selectedId) {
    const response = await fetchAdministrativeSolicitations(100)
    setItems(response.itens)
    const nextSelected = selected || response.itens[0]?.idSolicitacao || ''
    setSelectedId(nextSelected)
    if (nextSelected) {
      setDetail(await fetchAdministrativeSolicitationDetail(nextSelected))
    }
  }

  useEffect(() => {
    const controller = new AbortController()

    Promise.all([
      fetchAdministrativeSolicitations(100, controller.signal),
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
        setError(requestError instanceof Error ? requestError.message : 'Erro ao carregar painel administrativo.')
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
      .then((loadedDetail) => {
        setDetail(loadedDetail)
        setProvider(loadedDetail.fornecedor || '')
        setAppliedFood(loadedDetail.produtoAlimentacaoAplicado || loadedDetail.produtoAlimentacao || '')
        setAppliedDrink(loadedDetail.produtoBebidaAplicado || loadedDetail.produtoBebida || '')
        setAdjustmentReason(loadedDetail.motivoAjusteProduto || '')
        setAttendance(loadedDetail.qtdComparecida == null ? '' : String(loadedDetail.qtdComparecida))
      })
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setError(requestError instanceof Error ? requestError.message : 'Erro ao carregar detalhe.')
      })
      .finally(() => setDetailLoading(false))

    return () => controller.abort()
  }, [selectedId])

  const filteredItems = useMemo(() => {
    const normalizedSearch = search.trim().toUpperCase()

    return items.filter((item) => {
      const matchesSearch = !normalizedSearch || [
        item.idSolicitacao,
        item.operacao,
        item.supervisor,
        item.fornecedor,
        item.usuarioCriacao,
      ].some((value) => value.toUpperCase().includes(normalizedSearch))

      const matchesType = typeFilter === 'TODOS' || item.tipoSolicitacao === typeFilter
      const currentStatus = statusLabel(item)
      const matchesStatus = statusFilter === 'TODOS' || currentStatus === statusFilter

      return matchesSearch && matchesType && matchesStatus
    })
  }, [items, search, typeFilter, statusFilter])

  const metrics = useMemo(() => ({
    total: items.length,
    pending: items.filter((item) => !item.triagemConcluida).length,
    awaitingActual: items.filter(
      (item) => item.tipoSolicitacao === 'MAO_DE_OBRA' && item.triagemConcluida && !item.realizadoRegistrado,
    ).length,
    divergences: items.filter((item) => item.divergencia).length,
  }), [items])

  const eligibleProviders = useMemo(() => {
    if (!catalogs || !detail) return []
    return catalogs.fornecedores.filter((item) => item.tiposSolicitacao.includes(detail.tipoSolicitacao))
  }, [catalogs, detail])

  const foods = catalogs?.produtos.filter((item) => item.categoria === 'ALIMENTACAO') || []
  const drinks = catalogs?.produtos.filter((item) => item.categoria === 'BEBIDA') || []

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
              produtoAlimentacaoAplicado: detail.produtoAlimentacao ? appliedFood : undefined,
              produtoBebidaAplicado: detail.produtoBebida ? appliedDrink : undefined,
              motivoAjusteProduto: adjustmentReason || undefined,
            }
          : {}),
      })
      await reload(detail.idSolicitacao)
      setSuccess('Triagem registrada com sucesso.')
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível registrar a triagem.')
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
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível registrar o comparecimento.')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <>
      <section className="page-header admin-page-header">
        <div>
          <p className="page-eyebrow">ADMINISTRATIVO</p>
          <h1>Solicitações de custos extras</h1>
          <p>Fila central para conferência das solicitações recebidas e acompanhamento do tratamento administrativo.</p>
        </div>
      </section>

      {error && <div className="admin-alert" role="alert">{error}</div>}
      {success && <div className="admin-alert admin-alert-success" role="status">{success}</div>}

      <section className="admin-metrics" aria-label="Resumo da fila">
        <article><span>Total</span><strong>{metrics.total}</strong></article>
        <article><span>Aguardando triagem</span><strong>{metrics.pending}</strong></article>
        <article><span>Aguardando realizado</span><strong>{metrics.awaitingActual}</strong></article>
        <article><span>Com divergência</span><strong>{metrics.divergences}</strong></article>
      </section>

      <section className="panel admin-filter-panel">
        <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar protocolo, operação, supervisor..." aria-label="Buscar solicitações" />
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} aria-label="Filtrar tipo">
          <option value="TODOS">Todos os tipos</option>
          <option value="MAO_DE_OBRA">Mão de obra</option>
          <option value="ALIMENTACAO_BEBIDA">Alimentação / Bebida</option>
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar situação">
          <option value="TODOS">Todas as situações</option>
          <option value="Aguardando triagem">Aguardando triagem</option>
          <option value="Aguardando realizado">Aguardando realizado</option>
          <option value="Com divergência">Com divergência</option>
          <option value="Concluído">Concluído</option>
        </select>
      </section>

      <section className="admin-layout">
        <div className="panel admin-list-panel">
          <div className="admin-list-header"><strong>Fila</strong><span>{filteredItems.length} registro(s)</span></div>
          {loading ? <p className="admin-empty">Carregando solicitações...</p> : filteredItems.length === 0 ? <p className="admin-empty">Nenhuma solicitação encontrada.</p> : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Protocolo</th><th>Operação</th><th>Data</th><th>Tipo</th><th>Situação</th><th>Previsto</th></tr></thead>
                <tbody>{filteredItems.map((item) => (
                  <tr key={item.idSolicitacao} className={selectedId === item.idSolicitacao ? 'admin-row-selected' : ''} onClick={() => setSelectedId(item.idSolicitacao)}>
                    <td><strong>{item.idSolicitacao}</strong></td><td>{item.operacao || '—'}</td><td>{formatDate(item.dataOperacional)}</td><td>{typeLabel(item.tipoSolicitacao)}</td><td><span className={statusClass(item)}>{statusLabel(item)}</span></td><td>{formatMoney(item.valorPrevisto)}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="panel admin-detail-panel" aria-label="Detalhe da solicitação">
          {detailLoading ? <p className="admin-empty">Carregando detalhe...</p> : !detail ? <p className="admin-empty">Selecione uma solicitação.</p> : (
            <>
              <div className="admin-detail-heading">
                <div><span>Solicitação</span><h2>{detail.idSolicitacao}</h2></div>
                <span className={statusClass(detail as AdministrativeSolicitationListItem)}>{statusLabel(detail as AdministrativeSolicitationListItem)}</span>
              </div>

              <div className="admin-detail-grid">
                <DetailField label="Operação" value={detail.operacao} /><DetailField label="Supervisor" value={detail.supervisor} /><DetailField label="Data operacional" value={formatDate(detail.dataOperacional)} /><DetailField label="Responsável pelo custo" value={detail.responsavelCusto} /><DetailField label="Fornecedor" value={detail.fornecedor} /><DetailField label="Justificativa" value={detail.justificativa} />
              </div>

              {detail.tipoSolicitacao === 'MAO_DE_OBRA' ? (
                <div className="admin-detail-section"><h3>Mão de obra</h3><div className="admin-detail-grid"><DetailField label="Atividade" value={detail.atividade} /><DetailField label="Função" value={detail.funcao} /><DetailField label="Turno" value={detail.turno} /><DetailField label="Qtd. solicitada" value={detail.qtdSolicitada} /><DetailField label="Qtd. comparecida" value={detail.qtdComparecida} /><DetailField label="Preço unitário" value={formatMoney(detail.precoUnitarioAplicado)} /></div></div>
              ) : (
                <div className="admin-detail-section"><h3>Alimentação / Bebida</h3><div className="admin-detail-grid"><DetailField label="Alimentação solicitada" value={detail.produtoAlimentacao} /><DetailField label="Alimentação aplicada" value={detail.produtoAlimentacaoAplicado} /><DetailField label="Qtd. alimentação" value={detail.qtdAlimentacao} /><DetailField label="Bebida solicitada" value={detail.produtoBebida} /><DetailField label="Bebida aplicada" value={detail.produtoBebidaAplicado} /><DetailField label="Qtd. bebida" value={detail.qtdBebida} /></div>{detail.motivoAjusteProduto && <div className="admin-adjustment-note"><span>Motivo do ajuste</span><strong>{detail.motivoAjusteProduto}</strong></div>}</div>
              )}

              {!detail.triagemConcluida && (
                <div className="admin-action-box">
                  <h3>Triagem administrativa</h3>
                  <label>Fornecedor<select value={provider} onChange={(event) => setProvider(event.target.value)}><option value="">Selecione</option>{eligibleProviders.map((item) => <option key={item.nome} value={item.nome}>{item.nome}</option>)}</select></label>
                  {detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA' && (
                    <>
                      {detail.produtoAlimentacao && <label>Alimentação aplicada<select value={appliedFood} onChange={(event) => setAppliedFood(event.target.value)}>{foods.map((item) => <option key={item.nome} value={item.nome}>{item.nome}</option>)}</select></label>}
                      {detail.produtoBebida && <label>Bebida aplicada<select value={appliedDrink} onChange={(event) => setAppliedDrink(event.target.value)}>{drinks.map((item) => <option key={item.nome} value={item.nome}>{item.nome}</option>)}</select></label>}
                      <label>Motivo do ajuste<textarea value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} placeholder="Obrigatório apenas quando o produto aplicado for diferente do solicitado." /></label>
                    </>
                  )}
                  <button type="button" onClick={handleTriage} disabled={actionLoading || !provider}>{actionLoading ? 'Salvando...' : 'Registrar triagem'}</button>
                </div>
              )}

              {detail.tipoSolicitacao === 'MAO_DE_OBRA' && detail.triagemConcluida && !detail.realizadoRegistrado && (
                <div className="admin-action-box">
                  <h3>Comparecimento real</h3>
                  <label>Quantidade comparecida<input type="number" min="0" step="1" value={attendance} onChange={(event) => setAttendance(event.target.value)} /></label>
                  <button type="button" onClick={handleAttendance} disabled={actionLoading || attendance === ''}>{actionLoading ? 'Salvando...' : 'Registrar comparecimento'}</button>
                  <small>Depois do primeiro registro, qualquer correção fica bloqueada até existir fluxo formal de auditoria.</small>
                </div>
              )}

              <div className="admin-values"><div><span>Previsto</span><strong>{formatMoney(detail.valorPrevisto)}</strong></div><div><span>Real</span><strong>{formatMoney(detail.valorReal)}</strong></div></div>
            </>
          )}
        </aside>
      </section>
    </>
  )
}
