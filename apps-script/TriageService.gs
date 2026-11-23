const TriageService = (() => {
  const SHEET_SOLICITACOES = 'SOLICITACOES';
  const TYPES = Object.freeze({ LABOR: 'MAO_DE_OBRA', FOOD: 'ALIMENTACAO_BEBIDA' });

  function apply(payload) {
    const input = payload || {};
    const solicitationId = ValidationService.requiredText(input.idSolicitacao, 'ID da solicitação');
    const administrativeUser = ValidationService.requiredText(input.usuarioAdministrativo, 'Usuário administrativo');
    const providerInput = ValidationService.requiredText(input.fornecedor, 'Fornecedor');
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw new Error('Não foi possível obter bloqueio para realizar a triagem administrativa.');

    try {
      SolicitationStatusService.ensureSchema();
      const found = SheetRepository.findRowByField(SHEET_SOLICITACOES, 'ID_SOLICITACAO', solicitationId);
      if (!found) ValidationService.fail('Solicitação não encontrada: ' + solicitationId + '.');

      const record = found.record;
      ensureNotTriaged_(record);
      if (SolicitationStatusService.resolve(record) !== SolicitationStatusService.STATUS.SENT) {
        ValidationService.fail('A triagem inicial só pode ser registrada quando a solicitação está com status ENVIADA.');
      }

      const type = ValidationService.enumValue(record.TIPO_SOLICITACAO, 'Tipo de solicitação', [TYPES.LABOR, TYPES.FOOD]);
      const providerRow = ValidationService.findActive(
        SheetRepository.readObjects('CAD_FORNECEDORES'),
        'FORNECEDOR',
        providerInput,
        'Fornecedor'
      );
      validateProviderCompatibility_(providerRow, type);

      const operationalDate = DateService.parseDateOnly(record.DATA_OPERACIONAL);
      // Se o solicitante indicou um acordo, a decisão comercial é obrigatória.
      // Preserva a compatibilidade com clientes antigos que enviavam confirmarAcordo=true.
      const agreementChoice = resolveAgreementChoice_(record, type, input);
      const updates = type === TYPES.LABOR
        ? laborUpdates_(record, providerRow.FORNECEDOR, operationalDate, agreementChoice.confirmedId)
        : foodUpdates_(record, providerRow.FORNECEDOR, operationalDate, input);
      updates.FORNECEDOR = providerRow.FORNECEDOR;

      // A escolha explícita pela tabela não pode ser substituída silenciosamente por outro acordo.
      if (agreementChoice.decision === 'USAR_TABELA' && updates.ORIGEM_PRECO !== 'TABELA') {
        ValidationService.fail('Não foi possível aplicar o preço da tabela. Revise os acordos comerciais vigentes.');
      }

      const auditReason = agreementChoice.decision
        ? 'TRIAGEM_REGISTRADA | ' + JSON.stringify({
            decisaoAcordo: agreementChoice.decision,
            acordoIndicado: agreementChoice.indicatedId,
            acordoAplicado: updates.ID_ACORDO_APLICADO || '',
            origemPreco: updates.ORIGEM_PRECO,
            precoUnitario: updates.PRECO_UNITARIO_APLICADO,
            motivoNaoAplicacao: agreementChoice.reason,
          })
        : 'TRIAGEM_REGISTRADA';
      const statusResult = SolicitationStatusService.applyWithinLock({
        found: found,
        target: SolicitationStatusService.STATUS.TRIAGE,
        usuarioAdministrativo: administrativeUser,
        motivo: auditReason,
        updates: updates,
      });

      return Object.assign({
        idSolicitacao: solicitationId,
        tipoSolicitacao: type,
        fornecedor: providerRow.FORNECEDOR,
        status: statusResult.status,
      }, responseSummary_(type, updates));
    } finally {
      lock.releaseLock();
    }
  }

  function resolveAgreementChoice_(record, type, input) {
    const indicatedId = String(record.ID_ACORDO_INDICADO || '').trim();
    if (type !== TYPES.LABOR || !indicatedId) {
      return { decision: '', confirmedId: '', indicatedId: '', reason: '' };
    }

    let decision = ValidationService.normalizeUpper(input.decisaoAcordo || '');
    // Clientes publicados antes da atualização enviam apenas este booleano.
    // false/ausente NÃO é considerado uma decisão consciente de usar a tabela.
    if (!decision && input.confirmarAcordo === true) decision = 'APLICAR';
    decision = ValidationService.enumValue(
      decision,
      'Decisão sobre o acordo comercial indicado (selecione aplicar acordo ou usar tabela)',
      ['APLICAR', 'USAR_TABELA']
    );

    if (Object.prototype.hasOwnProperty.call(input, 'confirmarAcordo') &&
        input.confirmarAcordo === true && decision !== 'APLICAR') {
      ValidationService.fail('Decisão sobre o acordo comercial inconsistente.');
    }

    let reason = '';
    if (decision === 'USAR_TABELA') {
      reason = ValidationService.requiredText(input.motivoNaoAplicacao, 'Justificativa para utilizar a tabela');
      if (reason.length > 500) ValidationService.fail('Justificativa deve conter no máximo 500 caracteres.');
    }
    return { decision: decision, confirmedId: decision === 'APLICAR' ? indicatedId : '', indicatedId: indicatedId, reason: reason };
  }

  function ensureNotTriaged_(record) {
    const frozenFields = ['FORNECEDOR','PRECO_UNITARIO_APLICADO','PRECO_ALIMENTACAO_APLICADO','PRECO_BEBIDA_APLICADO','VALOR_PREVISTO'];
    const alreadyTriaged = frozenFields.some(function (fieldName) { return record[fieldName] !== '' && record[fieldName] != null; });
    if (alreadyTriaged) ValidationService.fail('Solicitação já possui triagem/preço aplicado. Reprocessamento administrativo não é permitido sem fluxo de auditoria.');
  }

  function validateProviderCompatibility_(providerRow, type) {
    if (type === TYPES.LABOR && !ValidationService.isTruthy(providerRow.MAO_DE_OBRA)) ValidationService.fail('Fornecedor não habilitado para mão de obra.');
    if (type === TYPES.FOOD && !ValidationService.isTruthy(providerRow.ALIMENTACAO)) ValidationService.fail('Fornecedor não habilitado para alimentação/bebida.');
  }

  function laborUpdates_(record, provider, operationalDate, confirmedAgreementId) {
    const role = ValidationService.requiredText(record.FUNCAO, 'Função');
    const shift = ValidationService.enumValue(record.TURNO, 'Turno', ['DIURNO', 'NOTURNO']);
    const requestedQuantity = ValidationService.positiveInteger(record.QTD_SOLICITADA, 'Quantidade solicitada');
    const priceResult = PricingService.resolveLaborPrice({
      provider: provider, role: role, shift: shift, date: operationalDate,
      operation: record.OPERACAO, supervisor: record.SUPERVISOR,
      confirmedAgreementId: confirmedAgreementId || '',
    });
    PricingService.ensureOriginColumns();
    const unitPrice = roundMoney_(priceResult.price);
    return {
      PRECO_UNITARIO_APLICADO: unitPrice,
      VALOR_PREVISTO: roundMoney_(requestedQuantity * unitPrice),
      ORIGEM_PRECO: priceResult.origem,
      ID_ACORDO_APLICADO: priceResult.idAcordo,
    };
  }

  function foodUpdates_(record, provider, operationalDate, input) {
    const originalFood = ValidationService.normalizeText(record.PRODUTO_ALIMENTACAO);
    const originalDrink = ValidationService.normalizeText(record.PRODUTO_BEBIDA);
    if (!originalFood && !originalDrink) ValidationService.fail('Solicitação de alimentação/bebida sem produto original para triagem.');

    const appliedFoodInput = ValidationService.normalizeText(input.produtoAlimentacaoAplicado);
    const appliedDrinkInput = ValidationService.normalizeText(input.produtoBebidaAplicado);
    if (!originalFood && appliedFoodInput) ValidationService.fail('Não é permitido adicionar alimentação aplicada quando a solicitação original não possui alimentação.');
    if (!originalDrink && appliedDrinkInput) ValidationService.fail('Não é permitido adicionar bebida aplicada quando a solicitação original não possui bebida.');

    const appliedFood = originalFood ? canonicalProduct_(appliedFoodInput || originalFood, 'ALIMENTACAO') : '';
    const appliedDrink = originalDrink ? canonicalProduct_(appliedDrinkInput || originalDrink, 'BEBIDA') : '';
    const adjusted = ValidationService.normalizeUpper(appliedFood) !== ValidationService.normalizeUpper(originalFood) || ValidationService.normalizeUpper(appliedDrink) !== ValidationService.normalizeUpper(originalDrink);
    const adjustmentReason = adjusted ? ValidationService.requiredText(input.motivoAjusteProduto, 'Motivo do ajuste de produto') : '';

    let foodUnitPrice = '', foodValue = '', drinkUnitPrice = '', drinkValue = '';
    if (originalFood) {
      const foodQuantity = ValidationService.positiveInteger(record.QTD_ALIMENTACAO, 'Quantidade de alimentação');
      foodUnitPrice = roundMoney_(PricingService.resolveProductPrice({ provider: provider, product: appliedFood, date: operationalDate }));
      foodValue = roundMoney_(foodQuantity * foodUnitPrice);
    }
    if (originalDrink) {
      const drinkQuantity = ValidationService.positiveInteger(record.QTD_BEBIDA, 'Quantidade de bebida');
      drinkUnitPrice = roundMoney_(PricingService.resolveProductPrice({ provider: provider, product: appliedDrink, date: operationalDate }));
      drinkValue = roundMoney_(drinkQuantity * drinkUnitPrice);
    }

    return {
      PRODUTO_ALIMENTACAO_APLICADO: appliedFood,
      PRODUTO_BEBIDA_APLICADO: appliedDrink,
      MOTIVO_AJUSTE_PRODUTO: adjustmentReason,
      PRECO_ALIMENTACAO_APLICADO: foodUnitPrice,
      VALOR_ALIMENTACAO: foodValue,
      PRECO_BEBIDA_APLICADO: drinkUnitPrice,
      VALOR_BEBIDA: drinkValue,
      VALOR_PREVISTO: roundMoney_((foodValue || 0) + (drinkValue || 0)),
    };
  }

  function canonicalProduct_(value, expectedCategory) {
    const row = ValidationService.findActive(SheetRepository.readObjects('CAD_PRODUTOS'), 'PRODUTO', value, 'Produto aplicado');
    if (ValidationService.normalizeUpper(row.CATEGORIA) !== expectedCategory) ValidationService.fail('Produto aplicado não pertence à categoria ' + expectedCategory + ': ' + row.PRODUTO + '.');
    return ValidationService.normalizeText(row.PRODUTO);
  }

  function responseSummary_(type, updates) {
    return type === TYPES.LABOR
      ? { precoUnitarioAplicado: updates.PRECO_UNITARIO_APLICADO, valorPrevisto: updates.VALOR_PREVISTO, origemPreco: updates.ORIGEM_PRECO, idAcordoAplicado: updates.ID_ACORDO_APLICADO }
      : {
          produtoAlimentacaoAplicado: updates.PRODUTO_ALIMENTACAO_APLICADO,
          produtoBebidaAplicado: updates.PRODUTO_BEBIDA_APLICADO,
          motivoAjusteProduto: updates.MOTIVO_AJUSTE_PRODUTO,
          precoAlimentacaoAplicado: updates.PRECO_ALIMENTACAO_APLICADO,
          precoBebidaAplicado: updates.PRECO_BEBIDA_APLICADO,
          valorPrevisto: updates.VALOR_PREVISTO,
        };
  }

  function roundMoney_(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
  return { apply };
})();
