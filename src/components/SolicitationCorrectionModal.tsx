import { useEffect, useMemo, useState } from 'react'
import { Button } from 'primereact/button'
import { Dropdown } from 'primereact/dropdown'
import { InputText } from 'primereact/inputtext'
import { InputTextarea } from 'primereact/inputtextarea'
import { Message } from 'primereact/message'
import type { CatalogosDto } from '../types/catalog'
import type { AdministrativeSolicitationDetail } from '../types/solicitation'
import { correctAdministrativeSolicitation } from '../services/solicitationService'
import { Modal } from './ui/Modal'
import { Skeleton } from './ui/Primitives'

type Props = {
  open: boolean
  loading?: boolean
  detail: AdministrativeSolicitationDetail | null
  catalogs: CatalogosDto | null
  onClose: () => void
  onSaved: (idSolicitacao: string) => Promise<void> | void
}

type FormState = {
  supervisor: string
  operacao: string
  dataOperacional: string
  fornecedor: string
  justificativa: string
  responsavelCusto: string
  centroCusto: string
  atividade: string
  funcao: string
  turno: string
  qtdSolicitada: string
  qtdComparecida: string
  produtoAlimentacao: string
  qtdAlimentacao: string
  produtoBebida: string
  qtdBebida: string
  produtoAlimentacaoAplicado: string
  produtoBebidaAplicado: string
  motivoAjusteProduto: string
  motivoCorrecao: string
}

function fromDetail(detail: AdministrativeSolicitationDetail): FormState {
  return {
    supervisor: detail.supervisor || '',
    operacao: detail.operacao || '',
    dataOperacional: detail.dataOperacional || '',
    fornecedor: detail.fornecedor || '',
    justificativa: detail.justificativa || '',
    responsavelCusto: detail.responsavelCusto || 'CLIENTE',
    centroCusto: detail.centroCusto || '',
    atividade: detail.atividade || '',
    funcao: detail.funcao || '',
    turno: detail.turno || 'DIURNO',
    qtdSolicitada: detail.qtdSolicitada == null ? '' : String(detail.qtdSolicitada),
    qtdComparecida: detail.qtdComparecida == null ? '' : String(detail.qtdComparecida),
    produtoAlimentacao: detail.produtoAlimentacao || '',
    qtdAlimentacao: detail.qtdAlimentacao == null ? '' : String(detail.qtdAlimentacao),
    produtoBebida: detail.produtoBebida || '',
    qtdBebida: detail.qtdBebida == null ? '' : String(detail.qtdBebida),
    produtoAlimentacaoAplicado: detail.produtoAlimentacaoAplicado || detail.produtoAlimentacao || '',
    produtoBebidaAplicado: detail.produtoBebidaAplicado || detail.produtoBebida || '',
    motivoAjusteProduto: detail.motivoAjusteProduto || '',
    motivoCorrecao: '',
  }
}

function options(items: Array<{ nome: string }> | undefined) {
  return (items || []).map((item) => ({ label: item.nome, value: item.nome }))
}

export function SolicitationCorrectionModal({
  open,
  loading = false,
  detail,
  catalogs,
  onClose,
  onSaved,
}: Props) {
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open && detail) {
      setForm(fromDetail(detail))
      setError('')
    }
  }, [open, detail])

  useEffect(() => {
    if (!open) {
      setForm(null)
      setError('')
    }
  }, [open])

  const providers = useMemo(() => {
    if (!catalogs || !detail) return []
    return catalogs.fornecedores.filter((item) => item.tiposSolicitacao.includes(detail.tipoSolicitacao))
  }, [catalogs, detail])

  const foods = catalogs?.produtos.filter((item) => item.categoria === 'ALIMENTACAO') || []
  const drinks = catalogs?.produtos.filter((item) => item.categoria === 'BEBIDA') || []

  function set<K extends keyof FormState>(field: K, value: FormState[K]) {
    setForm((current) => current ? { ...current, [field]: value } : current)
  }

  async function handleSave() {
    const currentForm = form
    const currentDetail = detail

    if (!currentForm || !currentDetail) return

    if (!currentForm.motivoCorrecao.trim()) {
      setError('Informe o motivo da correção.')
      return
    }

    const dados: Record<string, unknown> = {
      supervisor: currentForm.supervisor,
      operacao: currentForm.operacao,
      dataOperacional: currentForm.dataOperacional,
      fornecedor: currentForm.fornecedor,
      justificativa: currentForm.justificativa,
      responsavelCusto: currentForm.responsavelCusto,
      centroCusto: currentForm.responsavelCusto === 'UNILOG' ? currentForm.centroCusto : '',
    }

    if (currentDetail.tipoSolicitacao === 'MAO_DE_OBRA') {
      dados.atividade = currentForm.atividade
      dados.funcao = currentForm.funcao
      dados.turno = currentForm.turno
      dados.qtdSolicitada = Number(currentForm.qtdSolicitada)
      dados.qtdComparecida = currentForm.qtdComparecida === '' ? '' : Number(currentForm.qtdComparecida)
    } else {
      dados.produtoAlimentacao = currentForm.produtoAlimentacao
      dados.qtdAlimentacao = currentForm.produtoAlimentacao ? Number(currentForm.qtdAlimentacao) : ''
      dados.produtoBebida = currentForm.produtoBebida
      dados.qtdBebida = currentForm.produtoBebida ? Number(currentForm.qtdBebida) : ''
      dados.produtoAlimentacaoAplicado = currentForm.produtoAlimentacaoAplicado
      dados.produtoBebidaAplicado = currentForm.produtoBebidaAplicado
      dados.motivoAjusteProduto = currentForm.motivoAjusteProduto
    }

    setSaving(true)
    setError('')

    try {
      await correctAdministrativeSolicitation({
        idSolicitacao: currentDetail.idSolicitacao,
        motivoCorrecao: currentForm.motivoCorrecao.trim(),
        dados,
      })
      await onSaved(currentDetail.idSolicitacao)
      onClose()
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Não foi possível corrigir a solicitação.')
    } finally {
      setSaving(false)
    }
  }

  const isLoading = loading || !detail || !form
  const supervisorOptions = options(catalogs?.supervisores)
  const operationOptions = options(catalogs?.operacoes)
  const providerOptions = [
    { label: 'Sem triagem', value: '' },
    ...providers.map((item) => ({ label: item.nome, value: item.nome })),
  ]
  const foodOptions = [
    { label: 'Sem alimentação', value: '' },
    ...foods.map((item) => ({ label: item.nome, value: item.nome })),
  ]
  const drinkOptions = [
    { label: 'Sem bebida', value: '' },
    ...drinks.map((item) => ({ label: item.nome, value: item.nome })),
  ]

  return (
    <Modal
      open={open}
      titleId="correction-modal-title"
      eyebrow="CORREÇÃO ADMINISTRATIVA"
      title={detail?.idSolicitacao || 'Carregando solicitação…'}
      description={detail ? 'As alterações serão recalculadas e registradas em auditoria.' : 'Buscando os dados mais recentes para edição.'}
      onClose={onClose}
      busy={saving}
      width="medium"
      bodyClassName={isLoading ? 'correction-modal-body ui-modal-loading nx-prime-workflow' : 'correction-modal-body nx-prime-workflow'}
      footer={!isLoading ? (
        <>
          <Button label="Cancelar" text onClick={onClose} disabled={saving} />
          <Button
            label={saving ? 'Salvando…' : 'Salvar correção'}
            icon={saving ? 'pi pi-spin pi-spinner' : 'pi pi-check'}
            onClick={() => void handleSave()}
            disabled={saving || !form.motivoCorrecao.trim()}
            className="nx-primary-button"
          />
        </>
      ) : undefined}
    >
      {isLoading ? (
        <Skeleton lines={10} />
      ) : (
        <div className="nx-workflow-form-stack">
          {error && <Message severity="error" text={error} className="nx-workflow-message" />}

          <div className="correction-form-grid nx-workflow-grid">
            <label className="nx-workflow-field">
              <span>Supervisor</span>
              <Dropdown value={form.supervisor} options={supervisorOptions} onChange={(event) => set('supervisor', event.value || '')} filter />
            </label>
            <label className="nx-workflow-field">
              <span>Operação</span>
              <Dropdown value={form.operacao} options={operationOptions} onChange={(event) => set('operacao', event.value || '')} filter />
            </label>
            <label className="nx-workflow-field">
              <span>Data operacional</span>
              <InputText type="date" value={form.dataOperacional} onChange={(event) => set('dataOperacional', event.target.value)} />
            </label>
            <label className="nx-workflow-field">
              <span>Fornecedor</span>
              <Dropdown value={form.fornecedor} options={providerOptions} onChange={(event) => set('fornecedor', event.value || '')} filter />
            </label>
            <label className="nx-workflow-field">
              <span>Responsável pelo custo</span>
              <Dropdown
                value={form.responsavelCusto}
                options={[
                  { label: 'CLIENTE', value: 'CLIENTE' },
                  { label: 'UNILOG', value: 'UNILOG' },
                ]}
                onChange={(event) => set('responsavelCusto', event.value)}
              />
            </label>
            {form.responsavelCusto === 'UNILOG' && (
              <label className="nx-workflow-field">
                <span>Centro de custo</span>
                <InputText value={form.centroCusto} onChange={(event) => set('centroCusto', event.target.value.replace(/\D/g, ''))} inputMode="numeric" />
              </label>
            )}
          </div>

          <label className="nx-workflow-field nx-workflow-field-wide">
            <span>Justificativa</span>
            <InputTextarea value={form.justificativa} onChange={(event) => set('justificativa', event.target.value)} rows={3} autoResize />
          </label>

          {detail.tipoSolicitacao === 'MAO_DE_OBRA' ? (
            <div className="correction-form-grid correction-section nx-workflow-grid nx-workflow-section">
              <label className="nx-workflow-field">
                <span>Atividade</span>
                <Dropdown value={form.atividade} options={options(catalogs?.atividades)} onChange={(event) => set('atividade', event.value || '')} filter />
              </label>
              <label className="nx-workflow-field">
                <span>Função</span>
                <Dropdown value={form.funcao} options={options(catalogs?.funcoes)} onChange={(event) => set('funcao', event.value || '')} filter />
              </label>
              <label className="nx-workflow-field">
                <span>Turno</span>
                <Dropdown
                  value={form.turno}
                  options={[
                    { label: 'DIURNO', value: 'DIURNO' },
                    { label: 'NOTURNO', value: 'NOTURNO' },
                  ]}
                  onChange={(event) => set('turno', event.value)}
                />
              </label>
              <label className="nx-workflow-field">
                <span>Qtd. solicitada</span>
                <InputText type="number" min="1" step="1" value={form.qtdSolicitada} onChange={(event) => set('qtdSolicitada', event.target.value)} />
              </label>
              <label className="nx-workflow-field">
                <span>Qtd. comparecida</span>
                <InputText type="number" min="0" step="1" value={form.qtdComparecida} onChange={(event) => set('qtdComparecida', event.target.value)} placeholder="Ainda não registrado" />
              </label>
            </div>
          ) : (
            <div className="correction-section nx-workflow-section">
              <div className="correction-form-grid nx-workflow-grid">
                <label className="nx-workflow-field">
                  <span>Alimentação solicitada</span>
                  <Dropdown value={form.produtoAlimentacao} options={foodOptions} onChange={(event) => set('produtoAlimentacao', event.value || '')} filter />
                </label>
                {form.produtoAlimentacao && (
                  <label className="nx-workflow-field">
                    <span>Qtd. alimentação</span>
                    <InputText type="number" min="1" step="1" value={form.qtdAlimentacao} onChange={(event) => set('qtdAlimentacao', event.target.value)} />
                  </label>
                )}
                <label className="nx-workflow-field">
                  <span>Bebida solicitada</span>
                  <Dropdown value={form.produtoBebida} options={drinkOptions} onChange={(event) => set('produtoBebida', event.value || '')} filter />
                </label>
                {form.produtoBebida && (
                  <label className="nx-workflow-field">
                    <span>Qtd. bebida</span>
                    <InputText type="number" min="1" step="1" value={form.qtdBebida} onChange={(event) => set('qtdBebida', event.target.value)} />
                  </label>
                )}
              </div>

              {form.fornecedor && (
                <div className="correction-form-grid nx-workflow-grid nx-workflow-subsection">
                  {form.produtoAlimentacao && (
                    <label className="nx-workflow-field">
                      <span>Alimentação aplicada</span>
                      <Dropdown value={form.produtoAlimentacaoAplicado} options={options(foods)} onChange={(event) => set('produtoAlimentacaoAplicado', event.value || '')} filter />
                    </label>
                  )}
                  {form.produtoBebida && (
                    <label className="nx-workflow-field">
                      <span>Bebida aplicada</span>
                      <Dropdown value={form.produtoBebidaAplicado} options={options(drinks)} onChange={(event) => set('produtoBebidaAplicado', event.value || '')} filter />
                    </label>
                  )}
                  <label className="nx-workflow-field correction-form-span">
                    <span>Motivo do ajuste de produto</span>
                    <InputText value={form.motivoAjusteProduto} onChange={(event) => set('motivoAjusteProduto', event.target.value)} />
                  </label>
                </div>
              )}
            </div>
          )}

          <label className="correction-reason nx-workflow-field nx-workflow-reason">
            <span>Motivo da correção <strong>*</strong></span>
            <InputTextarea
              value={form.motivoCorrecao}
              onChange={(event) => set('motivoCorrecao', event.target.value)}
              rows={3}
              autoResize
              placeholder="Ex.: quantidade lançada incorretamente pelo administrativo."
            />
          </label>
        </div>
      )}
    </Modal>
  )
}
