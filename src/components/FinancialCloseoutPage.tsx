'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from 'primereact/button'
import { Column } from 'primereact/column'
import { DataTable } from 'primereact/datatable'
import { Dropdown } from 'primereact/dropdown'
import { Tag } from 'primereact/tag'
import { PageHeader } from './PageHeader'
import { Modal } from './ui/Modal'
import {
  EmptyState,
  Panel,
  PanelHeader,
  Skeleton,
  SummaryMetrics,
  type SummaryMetricItem,
} from './ui/Primitives'
import {
  closeFinancialGroup,
  fetchFinancialCloseout,
  fetchFinancialCloseoutMetadata,
} from '../services/financialCloseoutService'
import type {
  FinancialCloseoutGroup,
  FinancialCloseoutListResponse,
  FinancialCloseoutMetadata,
  FinancialCloseoutStatus,
} from '../types/financialCloseout'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const STATUS_LABELS: Record<FinancialCloseoutStatus, string> = {
  EM_ACOMPANHAMENTO: 'Em acompanhamento',
  AGUARDANDO_NF: 'Aguardando NF',
  CONFERIDA: 'Conferida',
  ENCERRADA: 'Encerrada',
}

function competenceLabel(value: string) {
  if (!value) return '—'
  const [year, month] = value.split('-')
  return year && month ? `${month}/${year}` : value
}

function formatDateTime(value: string) {
  if (!value) return '—'
  const [date, time = ''] = value.split('T')
  const [year, month, day] = date.split('-')
  if (!year || !month || !day) return value
  return `${day}/${month}/${year}${time ? ` ${time.slice(0, 5)}` : ''}`
}

function statusSeverity(status: FinancialCloseoutStatus) {
  if (status === 'AGUARDANDO_NF') return 'warning' as const
  if (status === 'CONFERIDA' || status === 'ENCERRADA') return 'success' as const
  return 'secondary' as const
}

function pendingLabel(group: FinancialCloseoutGroup) {
  const parts: string[] = []
  if (group.pendencias.semFornecedor) parts.push(`${group.pendencias.semFornecedor} sem fornecedor`)
  if (group.pendencias.semValorReal) parts.push(`${group.pendencias.semValorReal} sem valor real`)
  if (group.pendencias.statusNaoConcluido) parts.push(`${group.pendencias.statusNaoConcluido} não concluída(s)`)
  return parts.length ? parts.join(' · ') : 'Sem pendências'
}

export function FinancialCloseoutPage() {
  const [metadata, setMetadata] = useState<FinancialCloseoutMetadata | null>(null)
  const [competence, setCompetence] = useState('')
  const [data, setData] = useState<FinancialCloseoutListResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [closing, setClosing] = useState(false)
  const [target, setTarget] = useState<FinancialCloseoutGroup | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    void fetchFinancialCloseoutMetadata(controller.signal)
      .then((loaded) => {
        setMetadata(loaded)
        setCompetence((current) => current || loaded.competenciaAtual || loaded.competencias[0] || '')
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível carregar as competências.' })
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!competence) return
    const controller = new AbortController()
    setRefreshing(true)
    void fetchFinancialCloseout(competence, controller.signal)
      .then(setData)
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível carregar o fechamento.' })
      })
      .finally(() => setRefreshing(false))
    return () => controller.abort()
  }, [competence])

  useEffect(() => {
    if (!notice) return
    const timeout = window.setTimeout(() => setNotice(null), notice.tone === 'success' ? 4500 : 8000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const competenceOptions = useMemo(
    () => (metadata?.competencias || []).map((value) => ({ label: competenceLabel(value), value })),
    [metadata],
  )

  async function refresh() {
    if (!competence || refreshing) return
    setRefreshing(true)
    try {
      setData(await fetchFinancialCloseout(competence))
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível atualizar o fechamento.' })
    } finally {
      setRefreshing(false)
    }
  }

  async function confirmClose() {
    if (!target || closing) return
    setClosing(true)
    try {
      const result = await closeFinancialGroup({
        competencia: target.competencia,
        fornecedor: target.fornecedor,
      })
      setTarget(null)
      setNotice({
        tone: 'success',
        message: `${result.fornecedor} fechado em ${competenceLabel(result.competencia)} por ${money.format(result.valorControle)}.`,
      })
      await refresh()
    } catch (error) {
      setNotice({ tone: 'error', message: error instanceof Error ? error.message : 'Não foi possível concluir o fechamento.' })
    } finally {
      setClosing(false)
    }
  }

  const summary = data?.resumo
  const summaryItems: SummaryMetricItem[] = summary ? [
    {
      key: 'providers',
      label: 'Fornecedores',
      value: summary.fornecedores,
      detail: 'na competência',
      icon: 'local_shipping',
    },
    {
      key: 'requests',
      label: 'Solicitações',
      value: summary.solicitacoes,
      detail: `${summary.prontas} prontas`,
      icon: 'receipt_long',
      tone: 'info',
    },
    {
      key: 'pending',
      label: 'Pendências',
      value: summary.pendentes,
      detail: summary.pendentes ? 'exigem tratamento' : 'competência em dia',
      icon: summary.pendentes ? 'error' : 'verified_user',
      tone: summary.pendentes ? 'warning' : 'success',
    },
    {
      key: 'realized',
      label: 'Valor realizado',
      value: money.format(summary.valorReal),
      detail: 'acumulado no controle',
      icon: 'payments',
      tone: 'success',
    },
    {
      key: 'invoice',
      label: 'Aguardando NF',
      value: summary.aguardandoNf,
      detail: 'fornecedor(es) fechado(s)',
      icon: 'pending_actions',
      tone: summary.aguardandoNf ? 'warning' : 'neutral',
    },
  ] : []

  const providerBody = (group: FinancialCloseoutGroup) => (
    <div className="nx-closeout-cell nx-closeout-provider">
      <strong>{group.fornecedor}</strong>
      <small>{group.idFechamento || 'Ainda não fechado'}</small>
    </div>
  )

  const statusBody = (group: FinancialCloseoutGroup) => (
    <Tag
      value={STATUS_LABELS[group.statusFechamento]}
      severity={statusSeverity(group.statusFechamento)}
      rounded
      className="nx-closeout-status"
    />
  )

  const progressBody = (group: FinancialCloseoutGroup) => {
    const progress = group.totalSolicitacoes > 0
      ? Math.min(100, Math.round((group.prontas / group.totalSolicitacoes) * 100))
      : 0

    return (
      <div className="nx-closeout-progress">
        <div className="nx-closeout-progress-copy">
          <strong>{group.prontas}/{group.totalSolicitacoes} prontas</strong>
          <small>{group.pendentes ? pendingLabel(group) : 'Pronto para fechamento'}</small>
        </div>
        <span className="nx-closeout-progress-track" aria-hidden="true">
          <i style={{ width: `${progress}%` }} />
        </span>
      </div>
    )
  }

  const closeoutBody = (group: FinancialCloseoutGroup) => (
    <div className="nx-closeout-cell">
      <strong>{group.valorFechado == null ? '—' : money.format(group.valorFechado)}</strong>
      <small>{group.valorFechado == null ? 'Não fechado' : formatDateTime(group.dataFechamento)}</small>
    </div>
  )

  const actionBody = (group: FinancialCloseoutGroup) => {
    if (group.statusFechamento !== 'EM_ACOMPANHAMENTO') {
      return group.novasAposFechamento > 0
        ? <Tag value={`${group.novasAposFechamento} nova(s)`} severity="danger" rounded title="Solicitações registradas após o fechamento" />
        : <span className="nx-closeout-muted">—</span>
    }

    return (
      <Button
        label="Fechar"
        icon="pi pi-lock"
        size="small"
        outlined
        disabled={!group.podeFechar || refreshing}
        onClick={() => setTarget(group)}
        title={group.podeFechar ? 'Congelar o espelho e enviar o grupo para aguardando NF' : pendingLabel(group)}
        className="nx-closeout-action"
      />
    )
  }

  return (
    <section className="admin-page nx-modern-page nx-closeout-page">
      <PageHeader
        eyebrow="FECHAMENTO FINANCEIRO"
        title="Fechamentos"
        description="Acompanhamento diário e fechamento consolidado por competência e fornecedor."
      />

      {notice && (
        <div className={`nx-prime-notice ${notice.tone === 'success' ? 'is-success' : 'is-error'}`} role={notice.tone === 'error' ? 'alert' : 'status'}>
          <i className={notice.tone === 'success' ? 'pi pi-check-circle' : 'pi pi-exclamation-circle'} />
          <span>{notice.message}</span>
          <Button text rounded icon="pi pi-times" aria-label="Fechar notificação" onClick={() => setNotice(null)} />
        </div>
      )}

      <Panel className="nx-prime-data-panel nx-closeout-panel">
        <PanelHeader
          eyebrow="COMPETÊNCIA"
          title={competence ? `Competência ${competenceLabel(competence)}` : 'Selecione a competência'}
          description="Espelho diário dos registros realizados antes da conciliação da nota fiscal."
          trailing={(
            <div className="nx-closeout-controls">
              <Dropdown
                value={competence}
                options={competenceOptions}
                onChange={(event) => setCompetence(event.value || '')}
                placeholder="Competência"
                disabled={loading}
                className="nx-closeout-competence"
              />
              <Button
                icon={refreshing ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'}
                aria-label="Atualizar fechamento"
                title="Atualizar fechamento"
                outlined
                disabled={!competence || refreshing}
                onClick={() => void refresh()}
                className="nx-closeout-refresh"
              />
            </div>
          )}
        />

        {summaryItems.length > 0 && (
          <div className="nx-closeout-summary-shell">
            <SummaryMetrics items={summaryItems} ariaLabel="Resumo do fechamento da competência" />
          </div>
        )}

        {loading || (refreshing && !data) ? (
          <Skeleton lines={7} />
        ) : !data || data.grupos.length === 0 ? (
          <EmptyState
            title="Nenhum grupo encontrado"
            description="Não há solicitações registradas para a competência selecionada."
          />
        ) : (
          <DataTable
            value={data.grupos}
            dataKey="fornecedor"
            rowHover
            responsiveLayout="scroll"
            size="small"
            className="nx-prime-table nx-closeout-table"
          >
            <Column header="Fornecedor" body={providerBody} />
            <Column header="Status" body={statusBody} />
            <Column header="Acompanhamento" body={progressBody} />
            <Column header="Valor acumulado" body={(group: FinancialCloseoutGroup) => <strong className="nx-closeout-money">{money.format(group.valorRealAcumulado)}</strong>} />
            <Column header="Fechado" body={closeoutBody} />
            <Column header="Ação" body={actionBody} />
          </DataTable>
        )}
      </Panel>

      <Modal
        open={Boolean(target)}
        titleId="financial-closeout-confirm-title"
        eyebrow="FECHAMENTO DA COMPETÊNCIA"
        title={target ? `${target.fornecedor} · ${competenceLabel(target.competencia)}` : 'Confirmar fechamento'}
        description="O fechamento congela o conjunto de solicitações e o valor que será conciliado com a NF do fornecedor."
        onClose={() => { if (!closing) setTarget(null) }}
        busy={closing}
        width="medium"
        footer={(
          <>
            <Button label="Cancelar" text disabled={closing} onClick={() => setTarget(null)} />
            <Button
              label={closing ? 'Fechando…' : 'Confirmar fechamento'}
              icon={closing ? 'pi pi-spin pi-spinner' : 'pi pi-lock'}
              disabled={closing}
              onClick={() => void confirmClose()}
            />
          </>
        )}
      >
        {target && (
          <div className="nx-closeout-confirm-summary">
            <div>
              <span>Solicitações</span>
              <strong>{target.totalSolicitacoes}</strong>
              <small>registros serão congelados</small>
            </div>
            <div>
              <span>Valor do controle</span>
              <strong>{money.format(target.valorRealAcumulado)}</strong>
              <small>base para conciliação da NF</small>
            </div>
          </div>
        )}
      </Modal>
    </section>
  )
}
