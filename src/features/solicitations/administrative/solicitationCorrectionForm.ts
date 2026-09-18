import type { AdministrativeSolicitationDetail } from '@/types/solicitation'

export type SolicitationCorrectionFormState = {
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

export function correctionFormFromDetail(detail: AdministrativeSolicitationDetail): SolicitationCorrectionFormState {
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

export function correctionOptions(items: Array<{ nome: string }> | undefined) {
  return (items || []).map((item) => ({ label: item.nome, value: item.nome }))
}
