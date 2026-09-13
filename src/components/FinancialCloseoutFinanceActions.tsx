'use client'

import { useState } from 'react'
import { Button } from 'primereact/button'
import { Dropdown } from 'primereact/dropdown'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { Modal } from './ui/Modal'
import {
  completeFinancialCloseout,
  reconcileFinancialInvoice,
  saveFinancialInvoice,
} from '../services/financialCloseoutService'
import type { FinancialCloseoutGroup, ReconciliationResult } from '../types/financialCloseout'

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

const RECONCILIATION_OPTIONS = [
  { label: 'Conferida', value: 'OK' },
  { label: 'Conferida com ajuste', value: 'COM_AJUSTE' },
  { label: 'Conferida com divergência', value: 'COM_DIVERGENCIA' },
]

function competenceLabel(value: string) {
  const [year, month] = value.split('-')
  return year && month ? `${month}/${year}` : value
}

function reconciliationLabel(value: ReconciliationResult) {
  if (value === 'OK') return 'Conferida'
  if (value === 'COM_AJUSTE') return 'Com ajuste'
  if (value === 'COM_DIVERGENCIA') return 'Com divergência'
  return 'Não conferida'
}

function parseMoneyInput(value: string) {
  const normalized = value.replace(/\./g, '').replace(',', '.').replace(/[^0-9.-]/g, '')
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : NaN
}

function moneyInput(value: number | null | undefined) {
  return value == null ? '' : value.toFixed(2).replace('.', ',')
}

type Props = {
  group: FinancialCloseoutGroup
  onChanged: () => Promise<void>
  onNotice: (tone: 'success' | 'error', message: string) => void
}

export function FinancialCloseoutFinanceActions({ group, onChanged, onNotice }: Props) {
  const [busy, setBusy] = useState(false)
  const [invoiceOpen, setInvoiceOpen] = useState(false)
  const [reconcileOpen, setReconcileOpen] = useState(false)
  const [completeOpen, setCompleteOpen] = useState(false)
  const [invoiceDraft, setInvoiceDraft] = useState({ numeroNf: '', dataEmissao: '', dataRecebimento: '', valorNf: '' })
  const [result, setResult] = useState<Exclude<ReconciliationResult, ''>>('OK')
  const [adjustment, setAdjustment] = useState('')
  const [note, setNote] = useState('')

  function openInvoice() {
    setInvoiceDraft({
      numeroNf: group.notaFiscal?.numeroNf || '',
      dataEmissao: group.notaFiscal?.dataEmissao || '',
      dataRecebimento: group.notaFiscal?.dataRecebimento || '',
      valorNf: moneyInput(group.notaFiscal?.valorNf),
    })
    setInvoiceOpen(true)
  }

  async function saveInvoice() {
    if (!group.idFechamento || busy) return
    const value = parseMoneyInput(invoiceDraft.valorNf)
    if (!invoiceDraft.numeroNf.trim() || !invoiceDraft.dataEmissao || !invoiceDraft.dataRecebimento || !Number.isFinite(value) || value <= 0) {
      onNotice('error', 'Preencha número, datas e valor válido da NF.')
      return
    }
    setBusy(true)
    try {
      const response = await saveFinancialInvoice({
        idFechamento: group.idFechamento,
        numeroNf: invoiceDraft.numeroNf.trim(),
        dataEmissao: invoiceDraft.dataEmissao,
        dataRecebimento: invoiceDraft.dataRecebimento,
        valorNf: value,
      })
      setInvoiceOpen(false)
      onNotice('success', `NF ${response.notaFiscal.numeroNf} registrada com sucesso.`)
      await onChanged()
    } catch (error) {
      onNotice('error', error instanceof Error ? error.message : 'Não foi possível registrar a NF.')
    } finally {
      setBusy(false)
    }
  }

  function openReconcile() {
    const difference = group.notaFiscal?.diferencaValor ?? 0
    setResult(Math.abs(difference) <= 0.009 ? 'OK' : 'COM_DIVERGENCIA')
    setAdjustment(moneyInput(difference))
    setNote('')
    setReconcileOpen(true)
  }

  async function reconcile() {
    if (!group.idFechamento || busy) return
    const adjustmentValue = parseMoneyInput(adjustment)
    if (result === 'COM_AJUSTE' && !Number.isFinite(adjustmentValue)) {
      onNotice('error', 'Informe um valor de ajuste válido.')
      return
    }
    if (result !== 'OK' && !note.trim()) {
      onNotice('error', 'Informe a justificativa da conciliação.')
      return
    }
    setBusy(true)
    try {
      await reconcileFinancialInvoice({
        idFechamento: group.idFechamento,
        resultadoConciliacao: result,
        ...(result === 'COM_AJUSTE' ? { valorAjuste: adjustmentValue } : {}),
        ...(note.trim() ? { observacaoConciliacao: note.trim() } : {}),
      })
      setReconcileOpen(false)
      onNotice('success', `${group.fornecedor} conferido: ${reconciliationLabel(result)}.`)
      await onChanged()
    } catch (error) {
      onNotice('error', error instanceof Error ? error.message : 'Não foi possível concluir a conciliação.')
    } finally {
      setBusy(false)
    }
  }

  async function complete() {
    if (!group.idFechamento || busy) return
    setBusy(true)
    try {
      await completeFinancialCloseout(group.idFechamento)
      setCompleteOpen(false)
      onNotice('success', `${group.fornecedor} encerrado com sucesso.`)
      await onChanged()
    } catch (error) {
      onNotice('error', error instanceof Error ? error.message : 'Não foi possível encerrar o fechamento.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      {group.statusFechamento === 'AGUARDANDO_NF' && (
        <div className="nx-closeout-row-actions">
          <Button label={group.notaFiscal ? 'Editar NF' : 'Registrar NF'} icon="pi pi-file-edit" size="small" outlined onClick={openInvoice} />
          {group.notaFiscal && <Button label="Conferir" icon="pi pi-check-circle" size="small" onClick={openReconcile} />}
        </div>
      )}

      {group.statusFechamento === 'CONFERIDA' && (
        <Button label="Encerrar" icon="pi pi-check" size="small" outlined onClick={() => setCompleteOpen(true)} />
      )}

      <Modal open={invoiceOpen} titleId={`invoice-${group.idFechamento}`} eyebrow="NOTA FISCAL" title={`${group.fornecedor} · ${competenceLabel(group.competencia)}`} description="Registre a única NF consolidada deste fornecedor para o fechamento." onClose={() => { if (!busy) setInvoiceOpen(false) }} busy={busy} width="medium" footer={<><Button label="Cancelar" text disabled={busy} onClick={() => setInvoiceOpen(false)} /><Button label={busy ? 'Salvando…' : 'Salvar NF'} icon={busy ? 'pi pi-spin pi-spinner' : 'pi pi-save'} disabled={busy} onClick={() => void saveInvoice()} /></>}>
        <div className="nx-form-grid nx-closeout-form-grid">
          <label className="nx-field"><span>Número da NF</span><InputText value={invoiceDraft.numeroNf} onChange={(event) => setInvoiceDraft((current) => ({ ...current, numeroNf: event.target.value }))} /></label>
          <label className="nx-field"><span>Valor da NF</span><InputText inputMode="decimal" value={invoiceDraft.valorNf} onChange={(event) => setInvoiceDraft((current) => ({ ...current, valorNf: event.target.value }))} placeholder="0,00" /></label>
          <label className="nx-field"><span>Data de emissão</span><InputText type="date" value={invoiceDraft.dataEmissao} onChange={(event) => setInvoiceDraft((current) => ({ ...current, dataEmissao: event.target.value }))} /></label>
          <label className="nx-field"><span>Data de recebimento</span><InputText type="date" value={invoiceDraft.dataRecebimento} onChange={(event) => setInvoiceDraft((current) => ({ ...current, dataRecebimento: event.target.value }))} /></label>
          <div className="nx-closeout-financial-preview"><span>Nosso fechamento</span><strong>{money.format(group.valorFechado || 0)}</strong><small>A diferença será calculada automaticamente.</small></div>
        </div>
      </Modal>

      <Modal open={reconcileOpen} titleId={`reconcile-${group.idFechamento}`} eyebrow="CONCILIAÇÃO" title={`${group.fornecedor} · NF ${group.notaFiscal?.numeroNf || ''}`} description="Compare o espelho interno com a NF e registre como a conferência foi concluída." onClose={() => { if (!busy) setReconcileOpen(false) }} busy={busy} width="medium" footer={<><Button label="Cancelar" text disabled={busy} onClick={() => setReconcileOpen(false)} /><Button label={busy ? 'Conferindo…' : 'Concluir conferência'} icon={busy ? 'pi pi-spin pi-spinner' : 'pi pi-check-circle'} disabled={busy} onClick={() => void reconcile()} /></>}>
        {group.notaFiscal && (
          <div className="nx-closeout-reconciliation-stack">
            <div className="nx-closeout-confirm-summary">
              <div><span>Nosso fechamento</span><strong>{money.format(group.valorFechado || 0)}</strong><small>valor congelado</small></div>
              <div><span>NF fornecedor</span><strong>{money.format(group.notaFiscal.valorNf || 0)}</strong><small>diferença {money.format(group.notaFiscal.diferencaValor || 0)}</small></div>
            </div>
            <label className="nx-field"><span>Resultado da conferência</span><Dropdown value={result} options={RECONCILIATION_OPTIONS} onChange={(event) => setResult(event.value)} /></label>
            {result === 'COM_AJUSTE' && <label className="nx-field"><span>Valor do ajuste</span><InputText inputMode="decimal" value={adjustment} onChange={(event) => setAdjustment(event.target.value)} /><small>Controle + ajuste deve resultar no valor da NF.</small></label>}
            {result !== 'OK' && <label className="nx-field"><span>Justificativa</span><InputTextarea autoResize rows={4} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Descreva o ajuste ou a divergência encontrada." /></label>}
          </div>
        )}
      </Modal>

      <Modal open={completeOpen} titleId={`complete-${group.idFechamento}`} eyebrow="ENCERRAMENTO" title={`${group.fornecedor} · ${competenceLabel(group.competencia)}`} description="Encerrada representa o fim da etapa financeira. Não haverá mais ação pendente neste fechamento." onClose={() => { if (!busy) setCompleteOpen(false) }} busy={busy} width="medium" footer={<><Button label="Cancelar" text disabled={busy} onClick={() => setCompleteOpen(false)} /><Button label={busy ? 'Encerrando…' : 'Encerrar'} icon={busy ? 'pi pi-spin pi-spinner' : 'pi pi-check'} disabled={busy} onClick={() => void complete()} /></>}>
        <div className="nx-closeout-confirm-summary"><div><span>Resultado</span><strong>{reconciliationLabel(group.resultadoConciliacao)}</strong><small>conciliação concluída</small></div><div><span>NF</span><strong>{group.notaFiscal?.numeroNf || '—'}</strong><small>{money.format(group.notaFiscal?.valorNf || 0)}</small></div></div>
      </Modal>
    </>
  )
}
