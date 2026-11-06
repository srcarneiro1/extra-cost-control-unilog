/**
 * Tela aberta de solicitação (05/11/2026) — substitui o Google Forms.
 *
 * - OPCOES: listas lidas na hora dos cadastros (cadastrou no app, aparece na tela).
 * - ENVIAR: mão de obra, lanche ou os dois no mesmo envio → uma solicitação por tipo, cada uma com
 *   seu protocolo. Valida TUDO antes de gravar e grava as duas sob um único bloqueio.
 *   Reaproveita a validação do formulário (FormResponseNormalizerService.buildFromAnswers).
 *   Idempotente: o mesmo idEnvio (clique duplo, reenvio após falha de rede) não duplica.
 * Só é acessível pelo gateway (token); o gateway aplica limite de envios e o anti-robô.
 */
const PublicSolicitationService = (() => {
  const ORIGIN = 'FORMULARIO_WEB';
  const ACTIONS = Object.freeze({ OPTIONS: 'OPCOES', SUBMIT: 'ENVIAR' });
  const ID_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

  const text_ = (v) => String(v == null ? '' : v).trim();

  function execute(payload) {
    const input = payload || {};
    const action = ValidationService.normalizeUpper(input.acao);
    if (action === ACTIONS.OPTIONS) return options();
    if (action === ACTIONS.SUBMIT) return submit(input);
    ValidationService.fail('Ação inválida.');
  }

  function activeNames_(sheet, field) {
    const seen = {};
    return SheetRepository.readObjects(sheet)
      .filter((r) => ValidationService.isTruthy(r.ATIVO))
      .map((r) => text_(r[field]))
      .filter((n) => n && !seen[n.toUpperCase()] && (seen[n.toUpperCase()] = true));
  }

  function options() {
    const products = FormCatalogSyncService.eligibleProducts(new Date());
    return {
      supervisores: activeNames_('CAD_SUPERVISORES', 'SUPERVISOR'),
      operacoes: activeNames_('CAD_OPERACOES', 'OPERACAO'),
      atividades: activeNames_('CAD_ATIVIDADES', 'ATIVIDADE'),
      funcoes: activeNames_('CAD_FUNCOES', 'FUNCAO'),
      turnos: ['DIURNO', 'NOTURNO'],
      alimentacao: products.food,
      bebidas: products.drink,
      responsaveis: CostCenterService.responsibles(false).map((r) => ({ nome: r.nome, exigeCentroCusto: r.exigeCentroCusto })),
      centros: CostCenterService.centers(false).map((c) => ({ codigo: c.codigo, descricao: c.descricao })),
      vinculos: CostCenterService.links(),
      acordos: AgreementService.indicatedOptions(),
    };
  }

  function submit(input) {
    const N = FormResponseNormalizerService;
    const Q = N.QUESTIONS;
    const sendId = text_(input.idEnvio);
    if (!ID_PATTERN.test(sendId)) ValidationService.fail('Envio inválido. Recarregue a página e tente novamente.');

    const labor = input.maoDeObra && typeof input.maoDeObra === 'object' ? input.maoDeObra : null;
    const food = input.alimentacao && typeof input.alimentacao === 'object' ? input.alimentacao : null;
    if (!labor && !food) ValidationService.fail('Escolha o que deseja solicitar: mão de obra, alimentação/bebidas ou os dois.');

    const common = {};
    common[Q.requester] = text_(input.nomeSolicitante);
    common[Q.supervisor] = text_(input.supervisor);
    common[Q.operation] = text_(input.operacao);
    common[Q.operationalDate] = text_(input.dataOperacional);
    common[Q.justification] = text_(input.justificativa);
    common[Q.costResponsibility] = text_(input.responsavelCusto);
    common[Q.costCenter] = text_(input.centroCusto);
    if (!common[Q.requester]) ValidationService.fail('Informe o nome do solicitante.');

    const createdAt = new Date();
    const built = [];

    // Valida as duas partes ANTES de gravar qualquer uma: ou cria tudo, ou nada.
    if (labor) {
      const answers = Object.assign({}, common);
      answers[Q.type] = N.FORM_TYPES.LABOR;
      answers[Q.activity] = text_(labor.atividade);
      answers[Q.role] = text_(labor.funcao);
      answers[Q.shift] = text_(labor.turno);
      answers[Q.requestedQuantity] = text_(labor.quantidade);
      answers[Q.referenceVolume] = text_(labor.volumeReferencia);
      answers[Q.volumeUnit] = text_(labor.unidadeVolume);
      const laborBuilt = withPrefix_('Mão de obra', () => N.buildFromAnswers(answers, { responseId: sendId + '-MO', createdAt: createdAt, origin: ORIGIN }));
      // Acordo indicado pelo solicitante (07/11/2026): validado aqui; o Administrativo confirma na triagem.
      const indicated = withPrefix_('Mão de obra', () => AgreementService.validateIndication(labor.idAcordoIndicado, laborBuilt.record.OPERACAO, laborBuilt.record.DATA_OPERACIONAL, laborBuilt.record.SUPERVISOR));
      if (indicated) {
        PricingService.ensureOriginColumns();
        laborBuilt.record.ID_ACORDO_INDICADO = indicated;
      }
      built.push(laborBuilt);
    }
    if (food) {
      const answers = Object.assign({}, common);
      answers[Q.type] = N.FORM_TYPES.FOOD;
      answers[Q.food] = text_(food.produtoAlimentacao);
      answers[Q.foodQuantity] = text_(food.qtdAlimentacao);
      answers[Q.drink] = text_(food.produtoBebida);
      answers[Q.drinkQuantity] = text_(food.qtdBebida);
      if (answers[Q.food] && !answers[Q.foodQuantity]) ValidationService.fail('Alimentação/bebidas: informe a quantidade de alimentação.');
      if (answers[Q.drink] && !answers[Q.drinkQuantity]) ValidationService.fail('Alimentação/bebidas: informe a quantidade de bebida.');
      built.push(withPrefix_('Alimentação/bebidas', () => N.buildFromAnswers(answers, { responseId: sendId + '-AB', createdAt: createdAt, origin: ORIGIN })));
    }

    const results = N.persistMany(built, ORIGIN);
    return {
      protocolos: results.map((r) => ({ tipoSolicitacao: r.tipoSolicitacao, idSolicitacao: r.idSolicitacao, jaRegistrado: r.duplicado })),
    };
  }

  // Erros de validação dizem a qual parte do pedido se referem.
  function withPrefix_(label, fn) {
    try {
      return fn();
    } catch (error) {
      if (error && error.name === 'ValidationError') ValidationService.fail(label + ': ' + error.message);
      throw error;
    }
  }

  return { ACTIONS, execute, options, submit };
})();
