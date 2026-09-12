import { useEffect, useMemo, useState } from 'react'
import { Button } from 'primereact/button'
import { Dropdown } from 'primereact/dropdown'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import type { CatalogosDto } from '../types/catalog'
import type { AdministrativeSolicitationDetail, SolicitationStatus } from '../types/solicitation'
import {
  applyAdministrativeTriage,
  registerAdministrativeAttendance,
  registerPartialShifts,
  updateAdministrativeSolicitationStatus,
  type PartialShiftEntryInput,
} from '../services/solicitationService'
import { Modal } from './ui/Modal'
import { Badge, Skeleton } from './ui/Primitives'

type NoticeTone = 'success' | 'error'

type Props = {
  open: boolean
  loading: boolean
  detail: AdministrativeSolicitationDetail | null
  catalogs: CatalogosDto | null
  onClose: () => void
  onChanged: (idSolicitacao: string, message: string) => Promise<void>
  onNotify: (tone: NoticeTone, message: string) => void
}

type PartialShiftDraft = {
  nomeColaborador: string
  horasTrabalhadas: string
  horarioSaida: string
  motivo: string
}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

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

function emptyPartialDraft(): PartialShiftDraft {
  return { nomeColaborador: '', horasTrabalhadas: '', horarioSaida: '', motivo: '' }
}

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

function statusInfo(status: SolicitationStatus) {
  if (status === 'AGUARDANDO_AJUSTE') return { label: STATUS_LABELS[status], tone: 'danger' as const }
  if (status === 'ENVIADA_AO_FORNECEDOR' || status === 'EM_ATENDIMENTO') return { label: STATUS_LABELS[status], tone: 'warning' as const }
  if (status === 'ATENDIDA' || status === 'CONFERIDA' || status === 'ENCERRADA') return { label: STATUS_LABELS[status], tone: 'success' as const }
  return { label: STATUS_LABELS[status], tone: 'neutral' as const }
}

function buildWhatsAppMessage(detail: AdministrativeSolicitationDetail) {
  const lines: string[] = [`Pedido para ${formatDateShort(detail.dataOperacional)}`]

  if (detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA') {
    const products: string[] = []
    if (detail.produtoAlimentacao && detail.qtdAlimentacao != null) products.push(`${detail.qtdAlimentacao} ${detail.produtoAlimentacaoAplicado || detail.produtoAlimentacao}`)
    if (detail.produtoBebida && detail.qtdBebida != null) products.push(`${detail.qtdBebida} ${detail.produtoBebidaAplicado || detail.produtoBebida}`)
    if (products.length) lines.push(products.join(' + '))
  } else {
    if (detail.qtdSolicitada != null && detail.funcao) lines.push(`${detail.qtdSolicitada} ${detail.funcao}`)
    if (detail.atividade) lines.push(`Atividade: ${detail.atividade}`)
    if (detail.turno) lines.push(`Turno: ${detail.turno}`)
  }

  if (detail.supervisor) lines.push(`Supervisor(a) ${detail.supervisor}`)
  return lines.join('\n')
}

function DetailField({ label, value, wide = false }: { label: string; value: string | number | null; wide?: boolean }) {
  return (
    <div className={`workflow-detail-field ${wide ? 'is-wide' : ''}`.trim()}>
      <span>{label}</span>
      <strong>{value === '' || value == null ? '—' : value}</strong>
    </div>
  )
}

function SectionHeading({ icon, title, detail }: { icon: string; title: string; detail: string }) {
  return (
    <div className="workflow-section-heading nx-workflow-section-heading">
      <span className="nx-workflow-section-icon" aria-hidden="true"><i className={icon} /></span>
      <div><strong>{title}</strong><small>{detail}</small></div>
    </div>
  )
}

function namedOptions(items: Array<{ nome: string }>) {
  return items.map((item) => ({ label: item.nome, value: item.nome }))
}

export function SolicitationDetailModal({ open, loading, detail, catalogs, onClose, onChanged, onNotify }: Props) {
  const [actionLoading, setActionLoading] = useState(false)
  const [provider, setProvider] = useState('')
  const [appliedFood, setAppliedFood] = useState('')
  const [appliedDrink, setAppliedDrink] = useState('')
  const [adjustmentReason, setAdjustmentReason] = useState('')
  const [attendance, setAttendance] = useState('')
  const [partialCount, setPartialCount] = useState(0)
  const [partialDrafts, setPartialDrafts] = useState<PartialShiftDraft[]>([])

  useEffect(() => {
    if (!detail) return
    setProvider(detail.fornecedor || '')
    setAppliedFood(detail.produtoAlimentacaoAplicado || detail.produtoAlimentacao || '')
    setAppliedDrink(detail.produtoBebidaAplicado || detail.produtoBebida || '')
    setAdjustmentReason(detail.motivoAjusteProduto || '')
    setAttendance(detail.qtdComparecida == null ? '' : String(detail.qtdComparecida))
    setPartialCount(0)
    setPartialDrafts([])
  }, [detail])

  const eligibleProviders = useMemo(() => {
    if (!catalogs || !detail) return []
    return catalogs.fornecedores.filter((item) => item.tiposSolicitacao.includes(detail.tipoSolicitacao))
  }, [catalogs, detail])

  const whatsappProvider = useMemo(() => {
    if (!catalogs || !detail?.fornecedor) return null
    return catalogs.fornecedores.find((item) => item.nome === detail.fornecedor) || null
  }, [catalogs, detail?.fornecedor])

  const foods = catalogs?.produtos.filter((item) => item.categoria === 'ALIMENTACAO') || []
  const drinks = catalogs?.produtos.filter((item) => item.categoria === 'BEBIDA') || []
  const attendedCount = detail?.qtdComparecida ?? 0
  const registeredPartialCount = detail?.excecoesJornada?.length ?? 0
  const availablePartialCount = Math.max(0, attendedCount - registeredPartialCount)
  const canRegisterPartialShift = detail?.tipoSolicitacao === 'MAO_DE_OBRA' && detail.realizadoRegistrado === true && attendedCount > 0 && availablePartialCount > 0
  const canShare = Boolean(detail?.triagemConcluida && ['EM_TRIAGEM', 'ENVIADA_AO_FORNECEDOR', 'EM_ATENDIMENTO'].includes(detail.status))
  const canRegisterAttendance = detail?.tipoSolicitacao === 'MAO_DE_OBRA' && !detail.realizadoRegistrado && ['ENVIADA_AO_FORNECEDOR', 'EM_ATENDIMENTO'].includes(detail.status)
  const currentStatus = detail ? statusInfo(detail.status) : null
  const isLoading = loading || !detail

  const providerOptions = [{ label: 'Selecione', value: '' }, ...eligibleProviders.map((item) => ({ label: item.nome, value: item.nome }))]
  const foodOptions = namedOptions(foods)
  const drinkOptions = namedOptions(drinks)
  const partialCountOptions = [
    { label: 'Selecione', value: '0' },
    ...Array.from({ length: availablePartialCount }, (_, index) => index + 1).map((value) => ({ label: String(value), value: String(value) })),
  ]

  function handlePartialCountChange(raw: string) {
    const next = Math.max(0, Math.min(availablePartialCount, Number(raw) || 0))
    setPartialCount(next)
    setPartialDrafts((current) => Array.from({ length: next }, (_, index) => current[index] || emptyPartialDraft()))
  }

  function updatePartialDraft(index: number, field: keyof PartialShiftDraft, value: string) {
    setPartialDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))
  }

  async function handleStatus(status: SolicitationStatus, message: string) {
    if (!detail) return
    setActionLoading(true)
    try {
      await updateAdministrativeSolicitationStatus({ idSolicitacao: detail.idSolicitacao, status })
      await onChanged(detail.idSolicitacao, message)
    } catch (error) {
      onNotify('error', error instanceof Error ? error.message : 'Não foi possível atualizar o status da solicitação.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleTriage() {
    if (!detail || detail.triagemConcluida || !provider) return
    setActionLoading(true)
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
      await onChanged(detail.idSolicitacao, 'Triagem registrada. A solicitação está pronta para envio ao fornecedor.')
    } catch (error) {
      onNotify('error', error instanceof Error ? error.message : 'Não foi possível registrar a triagem.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleAttendance() {
    if (!detail || !canRegisterAttendance) return
    const quantity = Number(attendance)
    if (!Number.isInteger(quantity) || quantity < 0) {
      onNotify('error', 'Quantidade comparecida deve ser um número inteiro maior ou igual a zero.')
      return
    }

    setActionLoading(true)
    try {
      await registerAdministrativeAttendance({ idSolicitacao: detail.idSolicitacao, qtdComparecida: quantity })
      await onChanged(detail.idSolicitacao, 'Comparecimento registrado e solicitação marcada como atendida.')
    } catch (error) {
      onNotify('error', error instanceof Error ? error.message : 'Não foi possível registrar o comparecimento.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handlePartialShifts() {
    if (!detail || !canRegisterPartialShift || partialCount <= 0) return
    const standardHours = detail.jornadaPadraoHoras || 9
    const seen = new Set<string>()
    const payload: PartialShiftEntryInput[] = []

    for (let index = 0; index < partialDrafts.length; index += 1) {
      const item = partialDrafts[index]
      const name = item.nomeColaborador.trim()
      const hours = Number(item.horasTrabalhadas)
      const reason = item.motivo.trim()
      const key = name.toUpperCase()

      if (!name) return onNotify('error', `Informe o colaborador da jornada parcial #${index + 1}.`)
      if (seen.has(key) || detail.excecoesJornada.some((existing) => existing.nomeColaborador.trim().toUpperCase() === key)) return onNotify('error', `O colaborador ${name} está duplicado nas jornadas parciais.`)
      if (!Number.isFinite(hours) || hours <= 0 || hours >= standardHours) return onNotify('error', `Horas trabalhadas da jornada parcial #${index + 1} deve ser maior que zero e menor que ${standardHours} horas.`)
      if (!reason) return onNotify('error', `Informe o motivo da jornada parcial #${index + 1}.`)

      seen.add(key)
      payload.push({ nomeColaborador: name, horasTrabalhadas: hours, horarioSaida: item.horarioSaida || undefined, motivo: reason })
    }

    setActionLoading(true)
    try {
      await registerPartialShifts({ idSolicitacao: detail.idSolicitacao, excecoes: payload })
      setPartialCount(0)
      setPartialDrafts([])
      await onChanged(detail.idSolicitacao, `${payload.length} jornada(s) parcial(is) registrada(s) e valor real recalculado.`)
    } catch (error) {
      onNotify('error', error instanceof Error ? error.message : 'Não foi possível registrar as jornadas parciais.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleCopySummary() {
    if (!detail || !canShare) return
    try {
      await navigator.clipboard.writeText(buildWhatsAppMessage(detail))
      onNotify('success', 'Resumo copiado para a área de transferência.')
    } catch {
      onNotify('error', 'Não foi possível copiar o resumo automaticamente.')
    }
  }

  function handleOpenWhatsApp() {
    if (!detail || !canShare) return
    const message = buildWhatsAppMessage(detail)

    if (whatsappProvider?.whatsappDestino === 'NUMERO' && whatsappProvider.whatsappNumero) {
      window.open(`https://wa.me/${whatsappProvider.whatsappNumero.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
      return
    }

    if (whatsappProvider?.whatsappDestino === 'GRUPO' && whatsappProvider.whatsappGrupoLink) {
      void navigator.clipboard.writeText(message)
        .then(() => onNotify('success', 'Resumo copiado. Cole a mensagem no grupo do WhatsApp.'))
        .catch(() => onNotify('error', 'O grupo foi aberto, mas não foi possível copiar o resumo automaticamente.'))
      window.open(whatsappProvider.whatsappGrupoLink, '_blank', 'noopener,noreferrer')
      return
    }

    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <Modal
      open={open}
      titleId="workflow-modal-title"
      eyebrow="DETALHE DA SOLICITAÇÃO"
      title={detail?.idSolicitacao || 'Carregando solicitação…'}
      headerAside={currentStatus ? <Badge tone={currentStatus.tone}>{currentStatus.label}</Badge> : undefined}
      description={detail ? `${detail.operacao || 'Operação não informada'} · operacional em ${formatDate(detail.dataOperacional)}` : 'Buscando os dados mais recentes da solicitação.'}
      onClose={onClose}
      busy={actionLoading}
      width="large"
      bodyClassName={isLoading ? 'workflow-modal-body ui-modal-loading nx-prime-workflow' : 'workflow-modal-body nx-prime-workflow'}
    >
      {isLoading ? <Skeleton lines={10} /> : (
        <>
          <section className="workflow-section">
            <SectionHeading icon="pi pi-file" title="Dados da solicitação" detail="Informações de registro e operação" />
            <div className="workflow-detail-grid">
              <DetailField label="Registrado em" value={formatDateTime(detail.dataCriacao)} />
              <DetailField label="Data operacional" value={formatDate(detail.dataOperacional)} />
              <DetailField label="Operação" value={detail.operacao} />
              <DetailField label="Supervisor" value={detail.supervisor} />
              <DetailField label="Responsável custo" value={detail.responsavelCusto} />
              <DetailField label="Fornecedor" value={detail.fornecedor} />
              <DetailField label="Competência" value={detail.competencia} />
              <DetailField label="Status" value={STATUS_LABELS[detail.status]} />
              <DetailField label="Justificativa" value={detail.justificativa} wide />
            </div>
          </section>

          {detail.tipoSolicitacao === 'MAO_DE_OBRA' ? (
            <section className="workflow-section">
              <SectionHeading icon="pi pi-users" title="Mão de obra" detail="Solicitado, precificado e realizado" />
              <div className="workflow-detail-grid workflow-detail-grid-compact">
                <DetailField label="Atividade" value={detail.atividade} />
                <DetailField label="Função" value={detail.funcao} />
                <DetailField label="Turno" value={detail.turno} />
                <DetailField label="Qtd. solicitada" value={detail.qtdSolicitada} />
                <DetailField label="Qtd. comparecida" value={detail.qtdComparecida} />
                <DetailField label="Preço unitário" value={formatMoney(detail.precoUnitarioAplicado)} />
              </div>
            </section>
          ) : (
            <section className="workflow-section">
              <SectionHeading icon="pi pi-shopping-bag" title="Alimentação / Bebida" detail="Produto solicitado x aplicado" />
              <div className="workflow-detail-grid workflow-detail-grid-compact">
                <DetailField label="Alimentação solicitada" value={detail.produtoAlimentacao} />
                <DetailField label="Alimentação aplicada" value={detail.produtoAlimentacaoAplicado} />
                <DetailField label="Qtd. alimentação" value={detail.qtdAlimentacao} />
                <DetailField label="Bebida solicitada" value={detail.produtoBebida} />
                <DetailField label="Bebida aplicada" value={detail.produtoBebidaAplicado} />
                <DetailField label="Qtd. bebida" value={detail.qtdBebida} />
              </div>
              {detail.motivoAjusteProduto && <div className="workflow-adjustment-note"><span>Motivo do ajuste</span><strong>{detail.motivoAjusteProduto}</strong></div>}
            </section>
          )}

          {!detail.triagemConcluida && detail.status === 'ENVIADA' && (
            <section className="workflow-action-box">
              <SectionHeading icon="pi pi-check-square" title="Triagem administrativa" detail="Defina o fornecedor e congele o preço aplicado" />
              <div className="workflow-form-grid nx-workflow-grid">
                <label className="nx-workflow-field"><span>Fornecedor</span><Dropdown value={provider} options={providerOptions} onChange={(event) => setProvider(event.value || '')} filter /></label>
                {detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA' && detail.produtoAlimentacao && <label className="nx-workflow-field"><span>Alimentação aplicada</span><Dropdown value={appliedFood} options={foodOptions} onChange={(event) => setAppliedFood(event.value || '')} filter /></label>}
                {detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA' && detail.produtoBebida && <label className="nx-workflow-field"><span>Bebida aplicada</span><Dropdown value={appliedDrink} options={drinkOptions} onChange={(event) => setAppliedDrink(event.value || '')} filter /></label>}
                {detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA' && <label className="workflow-form-wide nx-workflow-field nx-workflow-field-wide"><span>Motivo do ajuste</span><InputTextarea value={adjustmentReason} onChange={(event) => setAdjustmentReason(event.target.value)} rows={3} autoResize placeholder="Obrigatório somente quando o produto aplicado for diferente." /></label>}
              </div>
              <div className="nx-workflow-actions"><Button label={actionLoading ? 'Salvando…' : 'Registrar triagem'} icon={actionLoading ? 'pi pi-spin pi-spinner' : 'pi pi-check'} onClick={() => void handleTriage()} disabled={actionLoading || !provider} className="nx-primary-button" /></div>
            </section>
          )}

          {detail.status === 'EM_TRIAGEM' && (
            <section className="workflow-action-box">
              <SectionHeading icon="pi pi-directions" title="Decisão da triagem" detail="Avance o atendimento ou devolva para ajuste" />
              <div className="nx-workflow-actions">
                <Button label="Aguardando ajuste" icon="pi pi-undo" outlined onClick={() => void handleStatus('AGUARDANDO_AJUSTE', 'Solicitação direcionada para ajuste.')} disabled={actionLoading} />
                {detail.triagemConcluida && <Button label="Confirmar envio ao fornecedor" icon="pi pi-send" onClick={() => void handleStatus('ENVIADA_AO_FORNECEDOR', 'Solicitação marcada como enviada ao fornecedor.')} disabled={actionLoading} className="nx-primary-button" />}
              </div>
            </section>
          )}

          {detail.status === 'AGUARDANDO_AJUSTE' && (
            <section className="workflow-action-box">
              <SectionHeading icon="pi pi-refresh" title="Ajuste pendente" detail="Após a correção, retome a triagem" />
              <div className="nx-workflow-actions"><Button label="Retomar triagem" icon="pi pi-arrow-right" onClick={() => void handleStatus('EM_TRIAGEM', 'Solicitação devolvida para triagem.')} disabled={actionLoading} className="nx-primary-button" /></div>
            </section>
          )}

          {canShare && (
            <section className="workflow-action-box workflow-share-box">
              <SectionHeading icon="pi pi-share-alt" title="Contato com fornecedor" detail="Copie ou abra o WhatsApp com o resumo da solicitação" />
              <div className="workflow-share-actions nx-workflow-actions">
                <Button label="Copiar resumo" icon="pi pi-copy" outlined onClick={() => void handleCopySummary()} />
                <Button label="Abrir WhatsApp" icon="pi pi-whatsapp" onClick={handleOpenWhatsApp} className="nx-primary-button" />
              </div>
            </section>
          )}

          {detail.status === 'ENVIADA_AO_FORNECEDOR' && (
            <section className="workflow-action-box">
              <SectionHeading icon="pi pi-hourglass" title="Atendimento do fornecedor" detail="A etapa em atendimento é opcional" />
              <div className="nx-workflow-actions">
                <Button label="Marcar em atendimento" icon="pi pi-play" outlined onClick={() => void handleStatus('EM_ATENDIMENTO', 'Solicitação marcada como em atendimento.')} disabled={actionLoading} />
                {detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA' && <Button label="Marcar atendida" icon="pi pi-check" onClick={() => void handleStatus('ATENDIDA', 'Solicitação marcada como atendida.')} disabled={actionLoading} className="nx-primary-button" />}
              </div>
            </section>
          )}

          {detail.status === 'EM_ATENDIMENTO' && detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA' && (
            <section className="workflow-action-box">
              <SectionHeading icon="pi pi-check-circle" title="Concluir atendimento" detail="Confirme quando alimentação/bebida tiver sido atendida" />
              <div className="nx-workflow-actions"><Button label="Marcar atendida" icon="pi pi-check" onClick={() => void handleStatus('ATENDIDA', 'Solicitação marcada como atendida.')} disabled={actionLoading} className="nx-primary-button" /></div>
            </section>
          )}

          {canRegisterAttendance && (
            <section className="workflow-action-box">
              <SectionHeading icon="pi pi-user-plus" title="Comparecimento real" detail="O registro conclui operacionalmente a solicitação" />
              <div className="workflow-form-grid workflow-form-grid-single nx-workflow-grid"><label className="nx-workflow-field"><span>Quantidade comparecida</span><InputText type="number" min="0" step="1" value={attendance} onChange={(event) => setAttendance(event.target.value)} /></label></div>
              <div className="nx-workflow-actions"><Button label={actionLoading ? 'Salvando…' : 'Registrar comparecimento'} icon={actionLoading ? 'pi pi-spin pi-spinner' : 'pi pi-check'} onClick={() => void handleAttendance()} disabled={actionLoading || attendance === ''} className="nx-primary-button" /></div>
            </section>
          )}

          {detail.tipoSolicitacao === 'MAO_DE_OBRA' && detail.realizadoRegistrado && (
            <section className="workflow-action-box partial-shift-box">
              <SectionHeading icon="pi pi-clock" title="Jornada parcial" detail={`Diária padrão de ${detail.jornadaPadraoHoras || 9}h · registre somente quem saiu antes.`} />
              <div className="partial-shift-capacity"><strong>{attendedCount} compareceram</strong><span>{registeredPartialCount} jornada(s) parcial(is) registrada(s)</span><span>{availablePartialCount} disponível(is) para lançamento</span></div>
              {detail.excecoesJornada.length > 0 && <div className="partial-shift-list" aria-label="Jornadas parciais registradas">{detail.excecoesJornada.map((exception) => <div className="partial-shift-item" key={exception.idExcecao}><div className="partial-shift-item-main"><strong>{exception.nomeColaborador}</strong><span>{exception.horasTrabalhadas ?? '—'}h{exception.horarioSaida ? ` · saída ${exception.horarioSaida}` : ''}</span></div><div className="partial-shift-item-value"><strong>{formatMoney(exception.valorProporcional)}</strong><small>{exception.motivo}</small></div></div>)}</div>}

              {canRegisterPartialShift && (
                <>
                  <label className="partial-shift-count nx-workflow-field nx-partial-count-field"><span>Quantas pessoas saíram antes?</span><Dropdown value={String(partialCount)} options={partialCountOptions} onChange={(event) => handlePartialCountChange(event.value || '0')} /><small>Máximo permitido neste momento: {availablePartialCount}.</small></label>
                  {partialDrafts.length > 0 && <div className="partial-shift-batch">{partialDrafts.map((entry, index) => <fieldset className="partial-shift-entry nx-partial-entry" key={index}><legend>Jornada parcial #{index + 1}</legend><div className="partial-shift-form-grid nx-workflow-grid"><label className="nx-workflow-field"><span>Colaborador</span><InputText value={entry.nomeColaborador} onChange={(event) => updatePartialDraft(index, 'nomeColaborador', event.target.value)} /></label><label className="nx-workflow-field"><span>Horas trabalhadas</span><InputText type="number" min="0.01" max={(detail.jornadaPadraoHoras || 9) - 0.01} step="0.25" value={entry.horasTrabalhadas} onChange={(event) => updatePartialDraft(index, 'horasTrabalhadas', event.target.value)} /></label><label className="nx-workflow-field"><span>Horário de saída</span><InputText type="time" value={entry.horarioSaida} onChange={(event) => updatePartialDraft(index, 'horarioSaida', event.target.value)} /></label><label className="nx-workflow-field nx-workflow-field-wide"><span>Motivo</span><InputTextarea value={entry.motivo} onChange={(event) => updatePartialDraft(index, 'motivo', event.target.value)} rows={2} autoResize /></label></div></fieldset>)}</div>}
                  {partialCount > 0 && <div className="nx-workflow-actions"><Button label={actionLoading ? 'Salvando…' : 'Registrar jornadas parciais'} icon={actionLoading ? 'pi pi-spin pi-spinner' : 'pi pi-save'} onClick={() => void handlePartialShifts()} disabled={actionLoading} className="nx-primary-button" /></div>}
                </>
              )}
            </section>
          )}

          <section className="workflow-section workflow-financial-summary">
            <SectionHeading icon="pi pi-wallet" title="Resumo financeiro" detail="Valores congelados no fluxo administrativo" />
            <div className="workflow-detail-grid workflow-detail-grid-compact">
              <DetailField label="Valor previsto" value={formatMoney(detail.valorPrevisto)} />
              <DetailField label="Valor realizado" value={formatMoney(detail.valorReal)} />
            </div>
          </section>
        </>
      )}
    </Modal>
  )
}
