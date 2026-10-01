import type { AdministrativeSolicitationDetail } from '@/types/solicitation'
import type { SolicitationCorrectionFormState } from '@/features/solicitations/administrative/solicitationCorrectionForm'

export function buildSolicitationCorrectionData(
  form: SolicitationCorrectionFormState,
  detail: AdministrativeSolicitationDetail,
): Record<string, unknown> {
  const dados: Record<string, unknown> = {
    supervisor: form.supervisor,
    operacao: form.operacao,
    dataOperacional: form.dataOperacional,
    fornecedor: form.fornecedor,
    justificativa: form.justificativa,
    responsavelCusto: form.responsavelCusto,
    centroCusto: form.responsavelCusto === 'UNILOG' ? form.centroCusto : '',
  }

  if (detail.tipoSolicitacao === 'MAO_DE_OBRA') {
    dados.atividade = form.atividade
    dados.funcao = form.funcao
    dados.turno = form.turno
    dados.qtdSolicitada = Number(form.qtdSolicitada)
    dados.qtdComparecida = form.qtdComparecida === '' ? '' : Number(form.qtdComparecida)
  } else {
    dados.produtoAlimentacao = form.produtoAlimentacao
    dados.qtdAlimentacao = form.produtoAlimentacao ? Number(form.qtdAlimentacao) : ''
    dados.produtoBebida = form.produtoBebida
    dados.qtdBebida = form.produtoBebida ? Number(form.qtdBebida) : ''
    dados.produtoAlimentacaoAplicado = form.produtoAlimentacaoAplicado
    dados.produtoBebidaAplicado = form.produtoBebidaAplicado
    dados.motivoAjusteProduto = form.motivoAjusteProduto
  }

  return dados
}
