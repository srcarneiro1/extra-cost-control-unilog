import { useEffect, useMemo, useState } from 'react'
import { Button } from 'primereact/button'
import { Dropdown } from 'primereact/dropdown'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import type { CatalogosDto } from '../types/catalog'
import type { AdministrativeSolicitationDetail } from '../types/solicitation'
import {
  applyAdministrativeTriage,
  registerAdministrativeAttendance,
  registerPartialShifts,
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

const money = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
})

function emptyPartialDraft(): PartialShiftDraft {
  return {
    nomeColaborador: '',
    horasTrabalhadas: '',
    horarioSaida: '',
    motivo: '',
  }
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

function statusInfo(detail: AdministrativeSolicitationDetail) {
  if (!detail.triagemConcluida) return { label: 'Aguardando triagem', tone: 'neutral' as const }
  if (detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA') return { label: 'Triagem concluída', tone: 'success' as const }
  if (!detail.realizadoRegistrado) return { label: 'Aguardando realizado', tone: 'warning' as const }
  if (detail.divergencia) return { label: 'Com divergência', tone: 'danger' as const }
  return { label: 'Concluído', tone: 'success' as const }
}

function buildWhatsAppMessage(detail: AdministrativeSolicitationDetail) {
  const lines: string[] = []
  lines.push(`Pedido para ${formatDateShort(detail.dataOperacional)}`)

  if (detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA') {
    const products: string[] = []
    if (detail.produtoAlimentacao && detail.qtdAlimentacao != null) products.push(`${detail.qtdAlimentacao} ${detail.produtoAlimentacao}`)
    if (detail.produtoBebida && detail.qtdBebida != null) products.push(`${detail.qtdBebida} ${detail.produtoBebida}`)
    if (products.length) lines.push(products.join(' + '))
  } else {
    if (detail.qtdSolicitada != null && detail.funcao) lines.push(`${detail.qtdSolicitada} ${detail.funcao}`)
    if (detail.atividade) lines.push(`Atividade: ${detail.atividade}`)
    if (detail.turno) lines.push(`Turno: ${detail.turno}`)
  }

  if (detail.supervisor) lines.push(`Supervisor(a) ${detail.supervisor}`)
  if (detail.justificativa) lines.push(`Observação: ${detail.justificativa}`)
  lines.push(`Protocolo: ${detail.idSolicitacao}`)
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
      <div>
        <strong>{title}</strong>
        <small>{detail}</small>
      </div>
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
  const canShare = Boolean(detail?.triagemConcluida && (detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA' || detail.realizadoRegistrado !== true))

  const whatsappButtonLabel = whatsappProvider?.whatsappDestino === 'GRUPO'
    ? 'Abrir grupo'
    : whatsappProvider?.whatsappDestino === 'NUMERO'
      ? 'Abrir fornecedor'
      : 'Abrir WhatsApp'

  function handlePartialCountChange(raw: string) {
    const next = Math.max(0, Math.min(availablePartialCount, Number(raw) || 0))
    setPartialCount(next)
    setPartialDrafts((current) => Array.from({ length: next }, (_, index) => current[index] || emptyPartialDraft()))
  }

  function updatePartialDraft(index: number, field: keyof PartialShiftDraft, value: string) {
    setPartialDrafts((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item))
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
      await onChanged(detail.idSolicitacao, 'Triagem registrada com sucesso.')
    } catch (error) {
      onNotify('error', error instanceof Error ? error.message : 'Não foi possível registrar a triagem.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handleAttendance() {
    if (!detail || detail.tipoSolicitacao !== 'MAO_DE_OBRA' || detail.realizadoRegistrado) return
    const quantity = Number(attendance)
    if (!Number.isInteger(quantity) || quantity < 0) {
      onNotify('error', 'Quantidade comparecida deve ser um número inteiro maior ou igual a zero.')
      return
    }

    setActionLoading(true)
    try {
      await registerAdministrativeAttendance({ idSolicitacao: detail.idSolicitacao, qtdComparecida: quantity })
      await onChanged(detail.idSolicitacao, 'Comparecimento registrado com sucesso.')
    } catch (error) {
      onNotify('error', error instanceof Error ? error.message : 'Não foi possível registrar o comparecimento.')
    } finally {
      setActionLoading(false)
    }
  }

  async function handlePartialShifts() {
    if (!detail || !canRegisterPartialShift || partialCount <= 0) return
    if (partialDrafts.length !== partialCount) {
      onNotify('error', 'Quantidade de jornadas parciais inconsistente. Selecione novamente a quantidade.')
      return
    }

    const standardHours = detail.jornadaPadraoHoras || 9
    const seen = new Set<string>()
    const payload: PartialShiftEntryInput[] = []

    for (let index = 0; index < partialDrafts.length; index += 1) {
      const item = partialDrafts[index]
      const name = item.nomeColaborador.trim()
      const hours = Number(item.horasTrabalhadas)
      const reason = item.motivo.trim()
      const key = name.toUpperCase()

      if (!name) {
        onNotify('error', `Informe o colaborador da jornada parcial #${index + 1}.`)
        return
      }
      if (seen.has(key) || detail.excecoesJornada.some((existing) => existing.nomeColaborador.trim().toUpperCase() === key)) {
        onNotify('error', `O colaborador ${name} está duplicado nas jornadas parciais.`)
        return
      }
      if (!Number.isFinite(hours) || hours <= 0 || hours >= standardHours) {
        onNotify('error', `Horas trabalhadas da jornada parcial #${index + 1} deve ser maior que zero e menor que ${standardHours} horas.`)
        return
      }
      if (!reason) {
        onNotify('error', `Informe o motivo da jornada parcial #${index + 1}.`)
        return
      }

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
      const number = whatsappProvider.whatsappNumero.replace(/\D/g, '')
      window.open(`https://wa.me/${number}?text=${encodeURIComponent(message)}`, '_blank', 'noopener,noreferrer')
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

  const currentStatus = detail ? statusInfo(detail) : null
  const isLoading = loading || !detail
  const providerOptions = [{ label: 'Selecione', value: '' }, ...eligibleProviders.map((item) => ({ label: item.nome, value: item.nome }))]
  const foodOptions = namedOptions(foods)
  const drinkOptions = namedOptions(drinks)
  const partialCountOptions = [
    { label: 'Selecione', value: '0' },
    ...Array.from({ length: availablePartialCount }, (_, index) => index + 1).map((value) => ({ label: String(value), value: String(value) })),
  ]

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
      {isLoading ? (
        <Skeleton lines={10} />
      ) : (
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
              {detail.motivoAjusteProduto && (
                <div className="workflow-adjustment-note">
                  <span>Motivo do ajuste</span>
                  <strong>{detail.motivoAjusteProduto}</strong>
                </div>
              )}
            </section>
          )}

          {canShare && (
            <section className="workflow-action-box workflow-share-box">
              <SectionHeading icon="pi pi-share-alt" title="Enviar solicitação" detail="Disponível enquanto a solicitação ainda exige atendimento do fornecedor" />
              <div className="workflow-share-actions nx-workflow-actions">
                <Button label="Copiar resumo" icon="pi pi-copy" outlined onClick={() => void handleCopySummary()} />
                <Button label={whatsappButtonLabel} icon="pi pi-whatsapp" onClick={handleOpenWhatsApp} className="nx-primary-button" />
              </div>
            </section>
          )}

          {!detail.triagemConcluida && (
            <section className="workflow-action-box">
              <SectionHeading icon="pi pi-check-square" title="Triagem administrativa" detail="Defina o fornecedor e congele o preço aplicado" />
              <div className="workflow-form-grid nx-workflow-grid">
                <label className="nx-workflow-field">
                  <span>Fornecedor</span>
                  <Dropdown value={provider} options={providerOptions} onChange={(event) => setProvider(event.value || '')} filter />
                </label>
                {detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA' && detail.produtoAlimentacao && (
                  <label className="nx-workflow-field">
                    <span>Alimentação aplicada</span>
                    <Dropdown value={appliedFood} options={foodOptions} onChange={(event) => setAppliedFood(event.value || '')} filter />
                  </label>
                )}
                {detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA' && detail.produtoBebida && (
                  <label className="nx-workflow-field">
                    <span>Bebida aplicada</span>
                    <Dropdown value={appliedDrink} options={drinkOptions} onChange={(event) => setAppliedDrink(event.value || '')} filter />
                  </label>
                )}
                {detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA' && (
                  <label className="workflow-form-wide nx-workflow-field nx-workflow-field-wide">
                    <span>Motivo do ajuste</span>
                    <InputTextarea
                      value={adjustmentReason}
                      onChange={(event) => setAdjustmentReason(event.target.value)}
                      rows={3}
                      autoResize
                      placeholder="Obrigatório somente quando o produto aplicado for diferente."
                    />
                  </label>
                )}
              </div>
              <div className="nx-workflow-actions">
                <Button
                  label={actionLoading ? 'Salvando…' : 'Registrar triagem'}
                  icon={actionLoading ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
                  onClick={() => void handleTriage()}
                  disabled={actionLoading || !provider}
                  className="nx-primary-button"
                />
              </div>
            </section>
          )}

          {detail.tipoSolicitacao === 'MAO_DE_OBRA' && detail.triagemConcluida && !detail.realizadoRegistrado && (
            <section className="workflow-action-box">
              <SectionHeading icon="pi pi-user-plus" title="Comparecimento real" detail="O primeiro registro fica protegido contra sobrescrita" />
              <div className="workflow-form-grid workflow-form-grid-single nx-workflow-grid">
                <label className="nx-workflow-field">
                  <span>Quantidade comparecida</span>
                  <InputText type="number" min="0" step="1" value={attendance} onChange={(event) => setAttendance(event.target.value)} />
                </label>
              </div>
              <div className="nx-workflow-actions">
                <Button
                  label={actionLoading ? 'Salvando…' : 'Registrar comparecimento'}
                  icon={actionLoading ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
                  onClick={() => void handleAttendance()}
                  disabled={actionLoading || attendance === ''}
                  className="nx-primary-button"
                />
              </div>
            </section>
          )}

          {detail.tipoSolicitacao === 'MAO_DE_OBRA' && detail.realizadoRegistrado && (
            <section className="workflow-action-box partial-shift-box">
              <SectionHeading
                icon="pi pi-clock"
                title="Jornada parcial"
                detail={`Diária padrão de ${detail.jornadaPadraoHoras || 9}h · registre somente quem saiu antes.`}
              />

              <div className="partial-shift-capacity">
                <strong>{attendedCount} compareceram</strong>
                <span>{registeredPartialCount} jornada(s) parcial(is) registrada(s)</span>
                <span>{availablePartialCount} disponível(is) para lançamento</span>
              </div>

              {detail.excecoesJornada.length > 0 && (
                <div className="partial-shift-list" aria-label="Jornadas parciais registradas">
                  {detail.excecoesJornada.map((exception) => (
                    <div className="partial-shift-item" key={exception.idExcecao}>
                      <div className="partial-shift-item-main">
                        <strong>{exception.nomeColaborador}</strong>
                        <span>{exception.horasTrabalhadas ?? '—'}h{exception.horarioSaida ? ` · saída ${exception.horarioSaida}` : ''}</span>
                      </div>
                      <div className="partial-shift-item-value">
                        <strong>{formatMoney(exception.valorProporcional)}</strong>
                        <small>{exception.motivo}</small>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {canRegisterPartialShift ? (
                <>
                  <label className="partial-shift-count nx-workflow-field nx-partial-count-field">
                    <span>Quantas pessoas saíram antes?</span>
                    <Dropdown
                      value={String(partialCount)}
                      options={partialCountOptions}
                      onChange={(event) => handlePartialCountChange(event.value || '0')}
                    />
                    <small>Máximo permitido neste momento: {availablePartialCount}.</small>
                  </label>

                  {partialDrafts.length > 0 && (
                    <div className="partial-shift-batch">
                      {partialDrafts.map((entry, index) => (
                        <fieldset className="partial-shift-entry nx-partial-entry" key={index}>
                          <legend>Jornada parcial #{index + 1}</legend>
                          <div className="partial-shift-form-grid nx-workflow-grid">
                            <label className="nx-workflow-field">
                              <span>Colaborador</span>
                              <InputText value={entry.nomeColaborador} onChange={(event) => updatePartialDraft(index, 'nomeColaborador', event.target.value)} placeholder="Nome de quem saiu antes" />
                            </label>
                            <label className="nx-workflow-field">
                              <span>Horas trabalhadas</span>
                              <InputText
                                type="number"
                                min="0.01"
                                max={(detail.jornadaPadraoHoras || 9) - 0.01}
                                step="0.25"
                                value={entry.horasTrabalhadas}
                                onChange={(event) => updatePartialDraft(index, 'horasTrabalhadas', event.target.value)}
                                placeholder="Ex.: 5"
                              />
                            </label>
                            <label className="nx-workflow-field">
                              <span>Horário de saída</span>
                              <InputText type="time" value={entry.horarioSaida} onChange={(event) => updatePartialDraft(index, 'horarioSaida', event.target.value)} />
                            </label>
                            <label className="partial-shift-reason nx-workflow-field">
                              <span>Motivo</span>
                              <InputText value={entry.motivo} onChange={(event) => updatePartialDraft(index, 'motivo', event.target.value)} placeholder="Ex.: saída antecipada autorizada" />
                            </label>
                          </div>
                        </fieldset>
                      ))}
                    </div>
                  )}

                  <div className="nx-workflow-actions">
                    <Button
                      label={actionLoading
                        ? 'Salvando…'
                        : partialCount > 1
                          ? `Registrar ${partialCount} jornadas parciais`
                          : 'Registrar jornada parcial'}
                      icon={actionLoading ? 'pi pi-spin pi-spinner' : 'pi pi-clock'}
                      onClick={() => void handlePartialShifts()}
                      disabled={actionLoading || partialCount === 0}
                      className="nx-primary-button"
                    />
                  </div>
                </>
              ) : attendedCount > 0 ? (
                <div className="partial-shift-complete">Todas as pessoas comparecidas já estão cobertas pelo limite de jornada parcial.</div>
              ) : null}
            </section>
          )}

          <div className="workflow-value-strip">
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
                  : detail.excecoesJornada.length > 0
                    ? 'recalculado com jornada parcial'
                    : 'calculado pelo realizado'}
              </small>
            </div>
          </div>
        </>
      )}
    </Modal>
  )
}
