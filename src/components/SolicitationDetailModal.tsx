import { useEffect, useMemo, useState } from 'react'
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
  if (!detail.triagemConcluida) {
    return { label: 'Aguardando triagem', tone: 'neutral' as const }
  }
  if (detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA') {
    return { label: 'Triagem concluída', tone: 'success' as const }
  }
  if (!detail.realizadoRegistrado) {
    return { label: 'Aguardando realizado', tone: 'warning' as const }
  }
  if (detail.divergencia) {
    return { label: 'Com divergência', tone: 'danger' as const }
  }
  return { label: 'Concluído', tone: 'success' as const }
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

function DetailField({ label, value, wide = false }: {
  label: string
  value: string | number | null
  wide?: boolean
}) {
  return (
    <div className={`workflow-detail-field ${wide ? 'is-wide' : ''}`.trim()}>
      <span>{label}</span>
      <strong>{value === '' || value == null ? '—' : value}</strong>
    </div>
  )
}

export function SolicitationDetailModal({
  open,
  loading,
  detail,
  catalogs,
  onClose,
  onChanged,
  onNotify,
}: Props) {
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
    return catalogs.fornecedores.filter((item) =>
      item.tiposSolicitacao.includes(detail.tipoSolicitacao),
    )
  }, [catalogs, detail])

  const foods = catalogs?.produtos.filter((item) => item.categoria === 'ALIMENTACAO') || []
  const drinks = catalogs?.produtos.filter((item) => item.categoria === 'BEBIDA') || []

  const attendedCount = detail?.qtdComparecida ?? 0
  const registeredPartialCount = detail?.excecoesJornada?.length ?? 0
  const availablePartialCount = Math.max(0, attendedCount - registeredPartialCount)
  const canRegisterPartialShift =
    detail?.tipoSolicitacao === 'MAO_DE_OBRA' &&
    detail.realizadoRegistrado === true &&
    attendedCount > 0 &&
    availablePartialCount > 0

  const canShare = Boolean(
    detail?.triagemConcluida &&
    (detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA' || detail.realizadoRegistrado !== true),
  )

  function handlePartialCountChange(raw: string) {
    const next = Math.max(0, Math.min(availablePartialCount, Number(raw) || 0))
    setPartialCount(next)
    setPartialDrafts((current) =>
      Array.from({ length: next }, (_, index) => current[index] || emptyPartialDraft()),
    )
  }

  function updatePartialDraft(
    index: number,
    field: keyof PartialShiftDraft,
    value: string,
  ) {
    setPartialDrafts((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    )
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
              produtoAlimentacaoAplicado: detail.produtoAlimentacao
                ? appliedFood
                : undefined,
              produtoBebidaAplicado: detail.produtoBebida
                ? appliedDrink
                : undefined,
              motivoAjusteProduto: adjustmentReason || undefined,
            }
          : {}),
      })
      await onChanged(detail.idSolicitacao, 'Triagem registrada com sucesso.')
    } catch (error) {
      onNotify(
        'error',
        error instanceof Error ? error.message : 'Não foi possível registrar a triagem.',
      )
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
      await registerAdministrativeAttendance({
        idSolicitacao: detail.idSolicitacao,
        qtdComparecida: quantity,
      })
      await onChanged(detail.idSolicitacao, 'Comparecimento registrado com sucesso.')
    } catch (error) {
      onNotify(
        'error',
        error instanceof Error
          ? error.message
          : 'Não foi possível registrar o comparecimento.',
      )
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
      if (
        seen.has(key) ||
        detail.excecoesJornada.some(
          (existing) => existing.nomeColaborador.trim().toUpperCase() === key,
        )
      ) {
        onNotify('error', `O colaborador ${name} está duplicado nas jornadas parciais.`)
        return
      }
      if (!Number.isFinite(hours) || hours <= 0 || hours >= standardHours) {
        onNotify(
          'error',
          `Horas trabalhadas da jornada parcial #${index + 1} deve ser maior que zero e menor que ${standardHours} horas.`,
        )
        return
      }
      if (!reason) {
        onNotify('error', `Informe o motivo da jornada parcial #${index + 1}.`)
        return
      }

      seen.add(key)
      payload.push({
        nomeColaborador: name,
        horasTrabalhadas: hours,
        horarioSaida: item.horarioSaida || undefined,
        motivo: reason,
      })
    }

    setActionLoading(true)
    try {
      await registerPartialShifts({
        idSolicitacao: detail.idSolicitacao,
        excecoes: payload,
      })
      setPartialCount(0)
      setPartialDrafts([])
      await onChanged(
        detail.idSolicitacao,
        `${payload.length} jornada(s) parcial(is) registrada(s) e valor real recalculado.`,
      )
    } catch (error) {
      onNotify(
        'error',
        error instanceof Error
          ? error.message
          : 'Não foi possível registrar as jornadas parciais.',
      )
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
    window.open(
      `https://wa.me/?text=${encodeURIComponent(buildWhatsAppMessage(detail))}`,
      '_blank',
      'noopener,noreferrer',
    )
  }

  const currentStatus = detail ? statusInfo(detail) : null
  const isLoading = loading || !detail

  return (
    <Modal
      open={open}
      titleId="workflow-modal-title"
      eyebrow="DETALHE DA SOLICITAÇÃO"
      title={detail?.idSolicitacao || 'Carregando solicitação…'}
      headerAside={currentStatus ? <Badge tone={currentStatus.tone}>{currentStatus.label}</Badge> : undefined}
      description={detail
        ? `${detail.operacao || 'Operação não informada'} · operacional em ${formatDate(detail.dataOperacional)}`
        : 'Buscando os dados mais recentes da solicitação.'}
      onClose={onClose}
      busy={actionLoading}
      width="large"
      bodyClassName={isLoading ? 'workflow-modal-body ui-modal-loading' : 'workflow-modal-body'}
    >
      {isLoading ? (
        <Skeleton lines={10} />
      ) : (
        <>
          <section className="workflow-section">
            <div className="workflow-section-heading">
              <span className="material-symbols-rounded" aria-hidden="true">description</span>
              <div>
                <strong>Dados da solicitação</strong>
                <small>Informações de registro e operação</small>
              </div>
            </div>
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
              <div className="workflow-section-heading">
                <span className="material-symbols-rounded" aria-hidden="true">groups</span>
                <div>
                  <strong>Mão de obra</strong>
                  <small>Solicitado, precificado e realizado</small>
                </div>
              </div>
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
              <div className="workflow-section-heading">
                <span className="material-symbols-rounded" aria-hidden="true">lunch_dining</span>
                <div>
                  <strong>Alimentação / Bebida</strong>
                  <small>Produto solicitado x aplicado</small>
                </div>
              </div>
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
              <div className="workflow-section-heading">
                <span className="material-symbols-rounded" aria-hidden="true">share</span>
                <div>
                  <strong>Enviar solicitação</strong>
                  <small>Disponível enquanto a solicitação ainda exige atendimento do fornecedor</small>
                </div>
              </div>
              <div className="workflow-share-actions">
                <button className="button" type="button" onClick={() => void handleCopySummary()}>
                  Copiar resumo
                </button>
                <button className="button button-primary" type="button" onClick={handleOpenWhatsApp}>
                  Abrir WhatsApp
                </button>
              </div>
            </section>
          )}

          {!detail.triagemConcluida && (
            <section className="workflow-action-box">
              <div className="workflow-section-heading">
                <span className="material-symbols-rounded" aria-hidden="true">assignment_turned_in</span>
                <div>
                  <strong>Triagem administrativa</strong>
                  <small>Defina o fornecedor e congele o preço aplicado</small>
                </div>
              </div>
              <div className="workflow-form-grid">
                <label>
                  Fornecedor
                  <select value={provider} onChange={(event) => setProvider(event.target.value)}>
                    <option value="">Selecione</option>
                    {eligibleProviders.map((item) => (
                      <option key={item.nome} value={item.nome}>{item.nome}</option>
                    ))}
                  </select>
                </label>
                {detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA' && detail.produtoAlimentacao && (
                  <label>
                    Alimentação aplicada
                    <select value={appliedFood} onChange={(event) => setAppliedFood(event.target.value)}>
                      {foods.map((item) => (
                        <option key={item.nome} value={item.nome}>{item.nome}</option>
                      ))}
                    </select>
                  </label>
                )}
                {detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA' && detail.produtoBebida && (
                  <label>
                    Bebida aplicada
                    <select value={appliedDrink} onChange={(event) => setAppliedDrink(event.target.value)}>
                      {drinks.map((item) => (
                        <option key={item.nome} value={item.nome}>{item.nome}</option>
                      ))}
                    </select>
                  </label>
                )}
                {detail.tipoSolicitacao === 'ALIMENTACAO_BEBIDA' && (
                  <label className="workflow-form-wide">
                    Motivo do ajuste
                    <textarea
                      value={adjustmentReason}
                      onChange={(event) => setAdjustmentReason(event.target.value)}
                      placeholder="Obrigatório somente quando o produto aplicado for diferente."
                    />
                  </label>
                )}
              </div>
              <button
                className="button button-primary"
                type="button"
                onClick={() => void handleTriage()}
                disabled={actionLoading || !provider}
              >
                {actionLoading ? 'Salvando…' : 'Registrar triagem'}
              </button>
            </section>
          )}

          {detail.tipoSolicitacao === 'MAO_DE_OBRA' &&
            detail.triagemConcluida &&
            !detail.realizadoRegistrado && (
              <section className="workflow-action-box">
                <div className="workflow-section-heading">
                  <span className="material-symbols-rounded" aria-hidden="true">how_to_reg</span>
                  <div>
                    <strong>Comparecimento real</strong>
                    <small>O primeiro registro fica protegido contra sobrescrita</small>
                  </div>
                </div>
                <div className="workflow-form-grid workflow-form-grid-single">
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
                </div>
                <button
                  className="button button-primary"
                  type="button"
                  onClick={() => void handleAttendance()}
                  disabled={actionLoading || attendance === ''}
                >
                  {actionLoading ? 'Salvando…' : 'Registrar comparecimento'}
                </button>
              </section>
            )}

          {detail.tipoSolicitacao === 'MAO_DE_OBRA' && detail.realizadoRegistrado && (
            <section className="workflow-action-box partial-shift-box">
              <div className="workflow-section-heading">
                <span className="material-symbols-rounded" aria-hidden="true">schedule</span>
                <div>
                  <strong>Jornada parcial</strong>
                  <small>
                    Diária padrão de {detail.jornadaPadraoHoras || 9}h · registre somente quem saiu antes.
                  </small>
                </div>
              </div>

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
                        <span>
                          {exception.horasTrabalhadas ?? '—'}h
                          {exception.horarioSaida ? ` · saída ${exception.horarioSaida}` : ''}
                        </span>
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
                  <label className="partial-shift-count">
                    Quantas pessoas saíram antes?
                    <select
                      value={String(partialCount)}
                      onChange={(event) => handlePartialCountChange(event.target.value)}
                    >
                      <option value="0">Selecione</option>
                      {Array.from({ length: availablePartialCount }, (_, index) => index + 1).map((value) => (
                        <option key={value} value={value}>{value}</option>
                      ))}
                    </select>
                    <small>Máximo permitido neste momento: {availablePartialCount}.</small>
                  </label>

                  {partialDrafts.length > 0 && (
                    <div className="partial-shift-batch">
                      {partialDrafts.map((entry, index) => (
                        <fieldset className="partial-shift-entry" key={index}>
                          <legend>Jornada parcial #{index + 1}</legend>
                          <div className="partial-shift-form-grid">
                            <label>
                              Colaborador
                              <input
                                value={entry.nomeColaborador}
                                onChange={(event) => updatePartialDraft(index, 'nomeColaborador', event.target.value)}
                                placeholder="Nome de quem saiu antes"
                              />
                            </label>
                            <label>
                              Horas trabalhadas
                              <input
                                type="number"
                                min="0.01"
                                max={(detail.jornadaPadraoHoras || 9) - 0.01}
                                step="0.25"
                                value={entry.horasTrabalhadas}
                                onChange={(event) => updatePartialDraft(index, 'horasTrabalhadas', event.target.value)}
                                placeholder="Ex.: 5"
                              />
                            </label>
                            <label>
                              Horário de saída
                              <input
                                type="time"
                                value={entry.horarioSaida}
                                onChange={(event) => updatePartialDraft(index, 'horarioSaida', event.target.value)}
                              />
                            </label>
                            <label className="partial-shift-reason">
                              Motivo
                              <input
                                value={entry.motivo}
                                onChange={(event) => updatePartialDraft(index, 'motivo', event.target.value)}
                                placeholder="Ex.: saída antecipada autorizada"
                              />
                            </label>
                          </div>
                        </fieldset>
                      ))}
                    </div>
                  )}

                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => void handlePartialShifts()}
                    disabled={actionLoading || partialCount === 0}
                  >
                    {actionLoading
                      ? 'Salvando…'
                      : partialCount > 1
                        ? `Registrar ${partialCount} jornadas parciais`
                        : 'Registrar jornada parcial'}
                  </button>
                </>
              ) : attendedCount > 0 ? (
                <div className="partial-shift-complete">
                  Todas as pessoas comparecidas já estão cobertas pelo limite de jornada parcial.
                </div>
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
