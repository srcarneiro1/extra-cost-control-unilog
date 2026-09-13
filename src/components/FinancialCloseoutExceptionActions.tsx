'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from 'primereact/button'
import { Dropdown } from 'primereact/dropdown'
import { InputTextarea } from 'primereact/inputtextarea'
import { Modal } from './ui/Modal'
import { EmptyState, Skeleton } from './ui/Primitives'
import { decideFinancialException, fetchFinancialExceptions } from '../services/financialExceptionService'
import type { FinancialCloseoutGroup, FinancialExceptionDestination, FinancialExceptionItem } from '../types/financialCloseout'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function competenceLabel(value: string) {
  if (!value) return '—'
  const [year, month] = value.split('-')
  return year && month ? `${month}/${year}` : value
}

function dateLabel(value: string) {
  if (!value) return '—'
  const [year, month, day] = value.slice(0, 10).split('-')
  return year && month && day ? `${day}/${month}/${year}` : value
}

function nextCompetences(value: string, amount = 12) {
  const [yearRaw, monthRaw] = value.split('-')
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) return []

  return Array.from({ length: amount }, (_, index) => {
    const date = new Date(Date.UTC(year, month - 1 + index + 1, 1))
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
  })
}

type Props = {
  group: FinancialCloseoutGroup
  competencias: string[]
  onChanged: () => Promise<void> | void
  onNotice: (tone: 'success' | 'error', message: string) => void
}

export function FinancialCloseoutExceptionActions({ group, competencias, onChanged, onNotice }: Props) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [items, setItems] = useState<FinancialExceptionItem[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [destination, setDestination] = useState<FinancialExceptionDestination>('RECLASSIFICAR_PROXIMA_COMPETENCIA')
  const [billingCompetence, setBillingCompetence] = useState('')
  const [reason, setReason] = useState('')

  const current = items.find((item) => item.idSolicitacao === selectedId) || items[0] || null
  const futureCompetences = useMemo(() => {
    const values = new Set<string>(nextCompetences(group.competencia))
    competencias.filter((value) => value > group.competencia).forEach((value) => values.add(value))
    return Array.from(values).sort()
  }, [competencias, group.competencia])

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setLoading(true)
    void fetchFinancialExceptions(group.competencia, group.fornecedor, controller.signal)
      .then((result) => {
        setItems(result.itens)
        setSelectedId(result.itens[0]?.idSolicitacao || '')
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        onNotice('error', error instanceof Error ? error.message : 'Não foi possível carregar as exceções financeiras.')
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [open, group.competencia, group.fornecedor, onNotice])

  useEffect(() => {
    if (!open) return
    setDestination('RECLASSIFICAR_PROXIMA_COMPETENCIA')
    setBillingCompetence(futureCompetences[0] || '')
    setReason('')
  }, [open, selectedId, futureCompetences])

  async function save() {
    if (!current || saving) return
    if (reason.trim().length < 5) {
      onNotice('error', 'Informe uma justificativa com pelo menos 5 caracteres.')
      return
    }
    if (destination === 'RECLASSIFICAR_PROXIMA_COMPETENCIA' && !billingCompetence) {
      onNotice('error', 'Selecione a competência de faturamento futura.')
      return
    }

    setSaving(true)
    try {
      const result = await decideFinancialException({
        idSolicitacao: current.idSolicitacao,
        destinoFinanceiro: destination,
        ...(destination === 'RECLASSIFICAR_PROXIMA_COMPETENCIA' ? { competenciaFaturamento: billingCompetence } : {}),
        motivo: reason.trim(),
      })
      const remaining = items.filter((item) => item.idSolicitacao !== current.idSolicitacao)
      setItems(remaining)
      setSelectedId(remaining[0]?.idSolicitacao || '')
      setReason('')
      onNotice(
        'success',
        result.destinoFinanceiro === 'ABSORVIDA_NAO_FATURADA'
          ? `${result.idSolicitacao} marcada como absorvida / não faturada.`
          : `${result.idSolicitacao} reclassificada para ${competenceLabel(result.competenciaFaturamento || '')}.`,
      )
      await onChanged()
      if (!remaining.length) setOpen(false)
    } catch (error) {
      onNotice('error', error instanceof Error ? error.message : 'Não foi possível registrar o destino financeiro.')
    } finally {
      setSaving(false)
    }
  }

  const itemOptions = items.map((item) => ({ label: `${item.idSolicitacao} · ${money.format(item.valorReal || 0)}`, value: item.idSolicitacao }))
  const destinationOptions = [
    { label: 'Próxima competência de faturamento', value: 'RECLASSIFICAR_PROXIMA_COMPETENCIA' },
    { label: 'Absorver / não faturar', value: 'ABSORVIDA_NAO_FATURADA' },
  ]
  const competenceOptions = futureCompetences.map((value) => ({ label: competenceLabel(value), value }))

  return (
    <>
      <Button label={`Tratar exceção${group.novasAposFechamento > 1 ? 'ões' : ''} (${group.novasAposFechamento})`} icon="pi pi-exclamation-triangle" size="small" severity="danger" outlined onClick={() => setOpen(true)} />
      <Modal open={open} titleId="financial-exception-title" eyebrow="EXCEÇÃO FINANCEIRA" title={`${group.fornecedor} · ${competenceLabel(group.competencia)}`} description="Solicitações registradas após o fechamento precisam de um destino financeiro explícito. O fechamento anterior não será reaberto." onClose={() => { if (!saving) setOpen(false) }} busy={saving} width="large" footer={current ? <><Button label="Cancelar" text disabled={saving} onClick={() => setOpen(false)} /><Button label={saving ? 'Salvando…' : 'Confirmar destino'} icon={saving ? 'pi pi-spin pi-spinner' : 'pi pi-check'} disabled={saving} onClick={() => void save()} /></> : undefined}>
        {loading ? <Skeleton lines={6} /> : !current ? <EmptyState title="Sem exceções pendentes" description="Não há solicitações tardias sem destino financeiro para este fornecedor." /> : (
          <div className="nx-financial-exception-form">
            {items.length > 1 && <label className="nx-workflow-field"><span>Solicitação</span><Dropdown value={current.idSolicitacao} options={itemOptions} onChange={(event) => setSelectedId(event.value || '')} /></label>}
            <div className="nx-closeout-confirm-summary"><div><span>Solicitação</span><strong>{current.idSolicitacao}</strong><small>{current.operacao || 'Operação não informada'}</small></div><div><span>Valor realizado</span><strong>{money.format(current.valorReal || 0)}</strong><small>operacional em {dateLabel(current.dataOperacional)}</small></div></div>
            <label className="nx-workflow-field"><span>Destino financeiro</span><Dropdown value={destination} options={destinationOptions} onChange={(event) => setDestination(event.value)} /></label>
            {destination === 'RECLASSIFICAR_PROXIMA_COMPETENCIA' && <label className="nx-workflow-field"><span>Competência de faturamento</span><Dropdown value={billingCompetence} options={competenceOptions} onChange={(event) => setBillingCompetence(event.value || '')} placeholder="Selecione uma competência futura" /></label>}
            <label className="nx-workflow-field"><span>Justificativa</span><InputTextarea value={reason} onChange={(event) => setReason(event.target.value)} rows={4} autoResize placeholder="Explique o motivo da decisão financeira." /></label>
          </div>
        )}
      </Modal>
    </>
  )
}
