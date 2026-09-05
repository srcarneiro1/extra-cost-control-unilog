import { useEffect, useMemo, useState } from 'react'
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
      bodyClassName={isLoading ? 'correction-modal-body ui-modal-loading' : 'correction-modal-body'}
      footer={!isLoading ? (
        <>
          <button type="button" className="button" onClick={onClose} disabled={saving}>Cancelar</button>
          <button
            type="button"
            className="button button-primary"
            onClick={() => void handleSave()}
            disabled={saving || !form.motivoCorrecao.trim()}
          >
            {saving ? 'Salvando…' : 'Salvar correção'}
          </button>
        </>
      ) : undefined}
    >
      {isLoading ? (
        <Skeleton lines={10} />
      ) : (
        <>
          {error && <div className="admin-alert correction-modal-error" role="alert">{error}</div>}

          <div className="correction-form-grid">
            <label>Supervisor
              <select value={form.supervisor} onChange={(event) => set('supervisor', event.target.value)}>
                {catalogs?.supervisores.map((item) => <option key={item.nome} value={item.nome}>{item.nome}</option>)}
              </select>
            </label>
            <label>Operação
              <select value={form.operacao} onChange={(event) => set('operacao', event.target.value)}>
                {catalogs?.operacoes.map((item) => <option key={item.nome} value={item.nome}>{item.nome}</option>)}
              </select>
            </label>
            <label>Data operacional
              <input type="date" value={form.dataOperacional} onChange={(event) => set('dataOperacional', event.target.value)} />
            </label>
            <label>Fornecedor
              <select value={form.fornecedor} onChange={(event) => set('fornecedor', event.target.value)}>
                <option value="">Sem triagem</option>
                {providers.map((item) => <option key={item.nome} value={item.nome}>{item.nome}</option>)}
              </select>
            </label>
            <label>Responsável pelo custo
              <select value={form.responsavelCusto} onChange={(event) => set('responsavelCusto', event.target.value)}>
                <option value="CLIENTE">CLIENTE</option>
                <option value="UNILOG">UNILOG</option>
              </select>
            </label>
            {form.responsavelCusto === 'UNILOG' && <label>Centro de custo
              <input value={form.centroCusto} onChange={(event) => set('centroCusto', event.target.value.replace(/\D/g, ''))} inputMode="numeric" />
            </label>}
          </div>

          <label>Justificativa
            <textarea value={form.justificativa} onChange={(event) => set('justificativa', event.target.value)} rows={3} />
          </label>

          {detail.tipoSolicitacao === 'MAO_DE_OBRA' ? (
            <div className="correction-form-grid correction-section">
              <label>Atividade
                <select value={form.atividade} onChange={(event) => set('atividade', event.target.value)}>
                  {catalogs?.atividades.map((item) => <option key={item.nome} value={item.nome}>{item.nome}</option>)}
                </select>
              </label>
              <label>Função
                <select value={form.funcao} onChange={(event) => set('funcao', event.target.value)}>
                  {catalogs?.funcoes.map((item) => <option key={item.nome} value={item.nome}>{item.nome}</option>)}
                </select>
              </label>
              <label>Turno
                <select value={form.turno} onChange={(event) => set('turno', event.target.value)}>
                  <option value="DIURNO">DIURNO</option>
                  <option value="NOTURNO">NOTURNO</option>
                </select>
              </label>
              <label>Qtd. solicitada
                <input type="number" min="1" step="1" value={form.qtdSolicitada} onChange={(event) => set('qtdSolicitada', event.target.value)} />
              </label>
              <label>Qtd. comparecida
                <input type="number" min="0" step="1" value={form.qtdComparecida} onChange={(event) => set('qtdComparecida', event.target.value)} placeholder="Ainda não registrado" />
              </label>
            </div>
          ) : (
            <div className="correction-section">
              <div className="correction-form-grid">
                <label>Alimentação solicitada
                  <select value={form.produtoAlimentacao} onChange={(event) => set('produtoAlimentacao', event.target.value)}>
                    <option value="">Sem alimentação</option>
                    {foods.map((item) => <option key={item.nome} value={item.nome}>{item.nome}</option>)}
                  </select>
                </label>
                {form.produtoAlimentacao && <label>Qtd. alimentação
                  <input type="number" min="1" step="1" value={form.qtdAlimentacao} onChange={(event) => set('qtdAlimentacao', event.target.value)} />
                </label>}
                <label>Bebida solicitada
                  <select value={form.produtoBebida} onChange={(event) => set('produtoBebida', event.target.value)}>
                    <option value="">Sem bebida</option>
                    {drinks.map((item) => <option key={item.nome} value={item.nome}>{item.nome}</option>)}
                  </select>
                </label>
                {form.produtoBebida && <label>Qtd. bebida
                  <input type="number" min="1" step="1" value={form.qtdBebida} onChange={(event) => set('qtdBebida', event.target.value)} />
                </label>}
              </div>
              {form.fornecedor && <div className="correction-form-grid">
                {form.produtoAlimentacao && <label>Alimentação aplicada
                  <select value={form.produtoAlimentacaoAplicado} onChange={(event) => set('produtoAlimentacaoAplicado', event.target.value)}>
                    {foods.map((item) => <option key={item.nome} value={item.nome}>{item.nome}</option>)}
                  </select>
                </label>}
                {form.produtoBebida && <label>Bebida aplicada
                  <select value={form.produtoBebidaAplicado} onChange={(event) => set('produtoBebidaAplicado', event.target.value)}>
                    {drinks.map((item) => <option key={item.nome} value={item.nome}>{item.nome}</option>)}
                  </select>
                </label>}
                <label className="correction-form-span">Motivo do ajuste de produto
                  <input value={form.motivoAjusteProduto} onChange={(event) => set('motivoAjusteProduto', event.target.value)} />
                </label>
              </div>}
            </div>
          )}

          <label className="correction-reason">Motivo da correção <span>*</span>
            <textarea value={form.motivoCorrecao} onChange={(event) => set('motivoCorrecao', event.target.value)} rows={3} placeholder="Ex.: quantidade lançada incorretamente pelo administrativo." />
          </label>
        </>
      )}
    </Modal>
  )
}
