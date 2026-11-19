import type { AdministrativeSolicitationDetail } from '@/types/solicitation'
import type { SolicitationCorrectionFormState } from '@/features/solicitations/administrative/solicitationCorrectionForm'

export function buildSolicitationCorrectionData(
  form: SolicitationCorrectionFormState,
  detail: AdministrativeSolicitationDetail,
  // Se o responsável exige centro de custo, conforme o cadastro (CAD_RESPONSAVEIS_CUSTO) — a mesma regra que mostra o
  // campo na tela e que o Apps Script valida. Antes era fixo "só UNILOG", e DIRETORIA/PROJETOS iam com centro vazio.
  exigeCentroCusto: boolean,
): Record<string, unknown> {
  const dados: Record<string, unknown> = {
    supervisor: form.supervisor,
    operacao: form.operacao,
    dataOperacional: form.dataOperacional,
    fornecedor: form.fornecedor,
    justificativa: form.justificativa,
    responsavelCusto: form.responsavelCusto,
    centroCusto: exigeCentroCusto ? form.centroCusto.trim() : '',
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
