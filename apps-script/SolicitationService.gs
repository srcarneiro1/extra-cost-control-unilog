const SolicitationService = (() => {
  const SHEET_SOLICITACOES = 'SOLICITACOES';
  const TYPES = Object.freeze({
    LABOR: 'MAO_DE_OBRA',
    FOOD: 'ALIMENTACAO_BEBIDA',
  });

  function create(payload) {
    const input = payload || {};
    const type = ValidationService.enumValue(
      input.tipoSolicitacao,
      'Tipo de solicitação',
      [TYPES.LABOR, TYPES.FOOD]
    );

    const common = normalizeCommon_(input, type);
    const specific = type === TYPES.LABOR
      ? normalizeLabor_(input, common)
      : normalizeFood_(input, common);

    const record = Object.assign({}, common.record, specific.record);
    record.TIPO_SOLICITACAO = type;
    record.DATA_CRIACAO = new Date();
    record.COMPETENCIA = DateService.competence(common.operationalDate);

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw new Error('Não foi possível obter bloqueio para gerar o protocolo da solicitação.');
    }

    try {
      record.ID_SOLICITACAO = nextProtocol_(record.DATA_CRIACAO);
      const rowNumber = SheetRepository.appendObject(SHEET_SOLICITACOES, record);

      return {
        idSolicitacao: record.ID_SOLICITACAO,
        tipoSolicitacao: type,
        competencia: record.COMPETENCIA,
        valorPrevisto: record.VALOR_PREVISTO,
        rowNumber: rowNumber,
      };
    } finally {
      lock.releaseLock();
    }
  }

  function normalizeCommon_(input, type) {
    const catalogs = {
      supervisores: SheetRepository.readObjects('CAD_SUPERVISORES'),
      operacoes: SheetRepository.readObjects('CAD_OPERACOES'),
      fornecedores: SheetRepository.readObjects('CAD_FORNECEDORES'),
    };

    const sessionEmail = ValidationService.normalizeText(Session.getActiveUser().getEmail());
    const user = sessionEmail || ValidationService.requiredText(input.usuarioCriacao, 'Usuário de criação');

    const supervisorRow = ValidationService.findActive(
      catalogs.supervisores,
      'SUPERVISOR',
      ValidationService.requiredText(input.supervisor, 'Supervisor'),
      'Supervisor'
    );

    const operationRow = ValidationService.findActive(
      catalogs.operacoes,
      'OPERACAO',
      ValidationService.requiredText(input.operacao, 'Operação'),
      'Operação'
    );

    const providerRow = ValidationService.findActive(
      catalogs.fornecedores,
      'FORNECEDOR',
      ValidationService.requiredText(input.fornecedor, 'Fornecedor'),
      'Fornecedor'
    );

    if (type === TYPES.LABOR && !ValidationService.isTruthy(providerRow.MAO_DE_OBRA)) {
      ValidationService.fail('Fornecedor não habilitado para mão de obra.');
    }

    if (type === TYPES.FOOD && !ValidationService.isTruthy(providerRow.ALIMENTACAO)) {
      ValidationService.fail('Fornecedor não habilitado para alimentação/bebida.');
    }

    const operationalDate = DateService.parseDateOnly(input.dataOperacional);
    const responsibility = ValidationService.enumValue(
      input.responsavelCusto,
      'Responsável pelo custo',
      ['CLIENTE', 'UNILOG']
    );

    const costCenter = responsibility === 'UNILOG'
      ? ValidationService.digitsOnly(
          ValidationService.requiredText(input.centroCusto, 'Centro de custo'),
          'Centro de custo'
        )
      : '';

    return {
      operationalDate: operationalDate,
      provider: providerRow.FORNECEDOR,
      record: {
        USUARIO_CRIACAO: user,
        ORIGEM: ValidationService.normalizeUpper(input.origem || 'API_WEBAPP'),
        ID_ORIGEM: '',
        LOTE_IMPORTACAO: '',
        SUPERVISOR: supervisorRow.SUPERVISOR,
        OPERACAO: operationRow.OPERACAO,
        DATA_OPERACIONAL: DateService.toIsoDate(operationalDate),
        FORNECEDOR: providerRow.FORNECEDOR,
        JUSTIFICATIVA: ValidationService.requiredText(input.justificativa, 'Justificativa'),
        RESPONSAVEL_CUSTO: responsibility,
        CENTRO_CUSTO: costCenter,
      },
    };
  }

  function normalizeLabor_(input, common) {
    const activityRow = ValidationService.findActive(
      SheetRepository.readObjects('CAD_ATIVIDADES'),
      'ATIVIDADE',
      ValidationService.requiredText(input.atividade, 'Atividade'),
      'Atividade'
    );

    const roleRow = ValidationService.findActive(
      SheetRepository.readObjects('CAD_FUNCOES'),
      'FUNCAO',
      ValidationService.requiredText(input.funcao, 'Função'),
      'Função'
    );

    const shift = ValidationService.enumValue(input.turno, 'Turno', ['DIURNO', 'NOTURNO']);
    const requestedQuantity = ValidationService.positiveInteger(input.qtdSolicitada, 'Quantidade solicitada');
    const priceResult = PricingService.resolveLaborPrice({
      provider: common.provider,
      role: roleRow.FUNCAO,
      shift: shift,
      date: common.operationalDate,
      isHoliday: false,
    });

    const unitPrice = roundMoney_(priceResult.price);
    const expectedValue = roundMoney_(requestedQuantity * unitPrice);

    return {
      record: {
        ATIVIDADE: activityRow.ATIVIDADE,
        FUNCAO: roleRow.FUNCAO,
        TURNO: shift,
        QTD_SOLICITADA: requestedQuantity,
        QTD_COMPARECIDA: '',
        VOLUME_REFERENCIA: input.volumeReferencia == null ? '' : input.volumeReferencia,
        UNIDADE_VOLUME: ValidationService.normalizeText(input.unidadeVolume),
        PRECO_UNITARIO_APLICADO: unitPrice,
        PRODUTO_ALIMENTACAO: '',
        QTD_ALIMENTACAO: '',
        PRECO_ALIMENTACAO_APLICADO: '',
        VALOR_ALIMENTACAO: '',
        PRODUTO_BEBIDA: '',
        QTD_BEBIDA: '',
        PRECO_BEBIDA_APLICADO: '',
        VALOR_BEBIDA: '',
        VALOR_PREVISTO: expectedValue,
        VALOR_REAL: '',
      },
    };
  }

  function normalizeFood_(input, common) {
    const foodProduct = ValidationService.normalizeText(input.produtoAlimentacao);
    const drinkProduct = ValidationService.normalizeText(input.produtoBebida);

    if (!foodProduct && !drinkProduct) {
      ValidationService.fail('Informe pelo menos um produto de alimentação ou bebida.');
    }

    const products = SheetRepository.readObjects('CAD_PRODUTOS');
    let foodQuantity = '';
    let foodUnitPrice = '';
    let foodValue = '';
    let drinkQuantity = '';
    let drinkUnitPrice = '';
    let drinkValue = '';
    let canonicalFood = '';
    let canonicalDrink = '';

    if (foodProduct) {
      const foodRow = ValidationService.findActive(products, 'PRODUTO', foodProduct, 'Produto de alimentação');
      if (ValidationService.normalizeUpper(foodRow.CATEGORIA) !== 'ALIMENTACAO') {
        ValidationService.fail('Produto informado no campo de alimentação não pertence à categoria ALIMENTACAO.');
      }

      foodQuantity = ValidationService.positiveInteger(input.qtdAlimentacao, 'Quantidade de alimentação');
      foodUnitPrice = roundMoney_(PricingService.resolveProductPrice({
        provider: common.provider,
        product: foodRow.PRODUTO,
        date: common.operationalDate,
      }));
      foodValue = roundMoney_(foodQuantity * foodUnitPrice);
      canonicalFood = foodRow.PRODUTO;
    } else if (input.qtdAlimentacao != null && input.qtdAlimentacao !== '') {
      ValidationService.fail('Produto de alimentação é obrigatório quando a quantidade de alimentação for informada.');
    }

    if (drinkProduct) {
      const drinkRow = ValidationService.findActive(products, 'PRODUTO', drinkProduct, 'Produto de bebida');
      if (ValidationService.normalizeUpper(drinkRow.CATEGORIA) !== 'BEBIDA') {
        ValidationService.fail('Produto informado no campo de bebida não pertence à categoria BEBIDA.');
      }

      drinkQuantity = ValidationService.positiveInteger(input.qtdBebida, 'Quantidade de bebida');
      drinkUnitPrice = roundMoney_(PricingService.resolveProductPrice({
        provider: common.provider,
        product: drinkRow.PRODUTO,
        date: common.operationalDate,
      }));
      drinkValue = roundMoney_(drinkQuantity * drinkUnitPrice);
      canonicalDrink = drinkRow.PRODUTO;
    } else if (input.qtdBebida != null && input.qtdBebida !== '') {
      ValidationService.fail('Produto de bebida é obrigatório quando a quantidade de bebida for informada.');
    }

    return {
      record: {
        ATIVIDADE: '',
        FUNCAO: '',
        TURNO: '',
        QTD_SOLICITADA: '',
        QTD_COMPARECIDA: '',
        VOLUME_REFERENCIA: '',
        UNIDADE_VOLUME: '',
        PRECO_UNITARIO_APLICADO: '',
        PRODUTO_ALIMENTACAO: canonicalFood,
        QTD_ALIMENTACAO: foodQuantity,
        PRECO_ALIMENTACAO_APLICADO: foodUnitPrice,
        VALOR_ALIMENTACAO: foodValue,
        PRODUTO_BEBIDA: canonicalDrink,
        QTD_BEBIDA: drinkQuantity,
        PRECO_BEBIDA_APLICADO: drinkUnitPrice,
        VALOR_BEBIDA: drinkValue,
        VALOR_PREVISTO: roundMoney_((foodValue || 0) + (drinkValue || 0)),
        VALOR_REAL: '',
      },
    };
  }

  function nextProtocol_(createdAt) {
    const year = Utilities.formatDate(createdAt, DateService.TIMEZONE, 'yyyy');
    const pattern = new RegExp('^CE-' + year + '-(\\d{6})$');
    const rows = SheetRepository.readObjects(SHEET_SOLICITACOES);
    let maxSequence = 0;

    rows.forEach(function (row) {
      const match = pattern.exec(ValidationService.normalizeText(row.ID_SOLICITACAO));
      if (match) {
        maxSequence = Math.max(maxSequence, Number(match[1]));
      }
    });

    return 'CE-' + year + '-' + String(maxSequence + 1).padStart(6, '0');
  }

  function roundMoney_(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  return {
    TYPES,
    create,
  };
})();
