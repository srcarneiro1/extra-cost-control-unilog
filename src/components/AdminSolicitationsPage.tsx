import { useEffect, useMemo, useState } from 'react'
import {
  fetchAdministrativeSolicitationDetail,
  fetchAdministrativeSolicitations,
} from '../services/solicitationService'
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
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('TODOS')
  const [statusFilter, setStatusFilter] = useState('TODOS')
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const controller = new AbortController()

    setLoading(true)
    fetchAdministrativeSolicitations(100, controller.signal)
      .then((response) => {
        setItems(response.itens)
        setSelectedId((current) => current || response.itens[0]?.idSolicitacao || '')
        setError('')
      })
      .catch((requestError) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return
        setError(requestError instanceof Error ? requestError.message : 'Erro ao carregar solicitações.')
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

    fetchAdministrativeSolicitationDetail(selectedId, controller.signal)
      .then(setDetail)
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

      <section className="admin-metrics" aria-label="Resumo da fila">
        <article><span>Total</span><strong>{metrics.total}</strong></article>
        <article><span>Aguardando triagem</span><strong>{metrics.pending}</strong></article>
        <article><span>Aguardando realizado</span><strong>{metrics.awaitingActual}</strong></article>
        <article><span>Com divergência</span><strong>{metrics.divergences}</strong></article>
      </section>

      <section className="panel admin-filter-panel">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar protocolo, operação, supervisor..."
          aria-label="Buscar solicitações"
        />
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
          <div className="admin-list-header">
            <strong>Fila</strong>
            <span>{filteredItems.length} registro(s)</span>
          </div>

          {loading ? (
            <p className="admin-empty">Carregando solicitações...</p>
          ) : filteredItems.length === 0 ? (
            <p className="admin-empty">Nenhuma solicitação encontrada.</p>
          ) : (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Protocolo</th>
                    <th>Operação</th>
                    <th>Data</th>
                    <th>Tipo</th>
                    <th>Situação</th>
                    <th>Previsto</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr
                      key={item.idSolicitacao}
                      className={selectedId === item.idSolicitacao ? 'admin-row-selected' : ''}
                      onClick={() => setSelectedId(item.idSolicitacao)}
                    >
                      <td><strong>{item.idSolicitacao}</strong></td>
                      <td>{item.operacao || '—'}</td>
                      <td>{formatDate(item.dataOperacional)}</td>
                      <td>{typeLabel(item.tipoSolicitacao)}</td>
                      <td><span className={statusClass(item)}>{statusLabel(item)}</span></td>
                      <td>{formatMoney(item.valorPrevisto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <aside className="panel admin-detail-panel" aria-label="Detalhe da solicitação">
          {detailLoading ? (
            <p className="admin-empty">Carregando detalhe...</p>
          ) : !detail ? (
            <p className="admin-empty">Selecione uma solicitação.</p>
          ) : (
            <>
              <div className="admin-detail-heading">
                <div>
                  <span>Solicitação</span>
                  <h2>{detail.idSolicitacao}</h2>
                </div>
                <span className={statusClass(detail as AdministrativeSolicitationListItem)}>
                  {statusLabel(detail as AdministrativeSolicitationListItem)}
                </span>
              </div>

              <div className="admin-detail-grid">
                <DetailField label="Operação" value={detail.operacao} />
                <DetailField label="Supervisor" value={detail.supervisor} />
                <DetailField label="Data operacional" value={formatDate(detail.dataOperacional)} />
                <DetailField label="Responsável pelo custo" value={detail.responsavelCusto} />
                <DetailField label="Fornecedor" value={detail.fornecedor} />
                <DetailField label="Justificativa" value={detail.justificativa} />
              </div>

              {detail.tipoSolicitacao === 'MAO_DE_OBRA' ? (
                <div className="admin-detail-section">
                  <h3>Mão de obra</h3>
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
                  <h3>Alimentação / Bebida</h3>
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

              <div className="admin-values">
                <div><span>Previsto</span><strong>{formatMoney(detail.valorPrevisto)}</strong></div>
                <div><span>Real</span><strong>{formatMoney(detail.valorReal)}</strong></div>
              </div>
            </>
          )}
        </aside>
      </section>
    </>
  )
}
