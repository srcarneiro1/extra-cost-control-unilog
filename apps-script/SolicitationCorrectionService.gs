const SolicitationCorrectionService = (() => {
  const SHEET_SOLICITACOES = 'SOLICITACOES';
  const SHEET_AUDITORIA = 'AUDITORIA_SOLICITACOES';
  const TYPES = Object.freeze({
    LABOR: 'MAO_DE_OBRA',
    FOOD: 'ALIMENTACAO_BEBIDA',
  });

  const AUDIT_HEADERS = [
    'ID_AUDITORIA',
    'ID_SOLICITACAO',
    'DATA_ALTERACAO',
    'USUARIO_ADMINISTRATIVO',
    'MOTIVO_CORRECAO',
    'CAMPOS_ALTERADOS',
    'ANTES_JSON',
    'DEPOIS_JSON',
  ];

  function correct(payload) {
    const input = payload || {};
    const solicitationId = ValidationService.requiredText(
      input.idSolicitacao,
      'ID da solicitação'
    );
    const administrativeUser = ValidationService.requiredText(
      input.usuarioAdministrativo,
      'Usuário administrativo'
    );
    const reason = ValidationService.requiredText(
      input.motivoCorrecao,
      'Motivo da correção'
    );
    const data = input.dados && typeof input.dados === 'object'
      ? input.dados
      : {};

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw new Error('Não foi possível obter bloqueio para corrigir a solicitação.');
    }

    try {
      ensureAuditSheet_();

      const found = SheetRepository.findRowByField(
        SHEET_SOLICITACOES,
        'ID_SOLICITACAO',
        solicitationId
      );

      if (!found) {
        ValidationService.fail('Solicitação não encontrada: ' + solicitationId + '.');
      }

      const record = found.record;
      const type = ValidationService.enumValue(
        record.TIPO_SOLICITACAO,
        'Tipo de solicitação',
        [TYPES.LABOR, TYPES.FOOD]
      );

      const common = normalizeCommon_(record, data, type);
      const specific = type === TYPES.LABOR
        ? normalizeLabor_(record, data, common)
        : normalizeFood_(record, data, common);

      const updates = Object.assign({}, common.updates, specific);
      const changedFields = changedFields_(record, updates);

      if (!changedFields.length) {
        ValidationService.fail('Nenhuma alteração foi identificada na solicitação.');
      }

      const afterRecord = Object.assign({}, record, updates);

      SheetRepository.updateFields(
        SHEET_SOLICITACOES,
        found.rowNumber,
        updates,
        { textFields: ['COMPETENCIA', 'CENTRO_CUSTO'] }
      );

      try {
        appendAudit_({
          idSolicitacao: solicitationId,
          usuarioAdministrativo: administrativeUser,
          motivoCorrecao: reason,
          camposAlterados: changedFields,
          antes: snapshot_(record),
          depois: snapshot_(afterRecord),
        });
      } catch (auditError) {
        const rollback = {};
        Object.keys(updates).forEach(function (fieldName) {
          rollback[fieldName] = record[fieldName] == null ? '' : record[fieldName];
        });
        SheetRepository.updateFields(
          SHEET_SOLICITACOES,
          found.rowNumber,
          rollback,
          { textFields: ['COMPETENCIA', 'CENTRO_CUSTO'] }
        );
        throw auditError;
      }

      return {
        idSolicitacao: solicitationId,
        tipoSolicitacao: type,
        camposAlterados: changedFields,
        motivoCorrecao: reason,
      };
    } finally {
      lock.releaseLock();
    }
  }

  function normalizeCommon_(record, data, type) {
    const supervisor = canonicalActive_(
      'CAD_SUPERVISORES',
      'SUPERVISOR',
      value_(data, 'supervisor', record.SUPERVISOR),
      'Supervisor'
    );
    const operation = canonicalActive_(
      'CAD_OPERACOES',
      'OPERACAO',
      value_(data, 'operacao', record.OPERACAO),
      'Operação'
    );
    const operationalDate = DateService.parseDateOnly(
      value_(data, 'dataOperacional', record.DATA_OPERACIONAL)
    );
    const responsibility = ValidationService.enumValue(
      value_(data, 'responsavelCusto', record.RESPONSAVEL_CUSTO),
      'Responsável pelo custo',
      ['CLIENTE', 'UNILOG']
    );
    const justification = ValidationService.requiredText(
      value_(data, 'justificativa', record.JUSTIFICATIVA),
      'Justificativa'
    );

    const costCenter = responsibility === 'UNILOG'
      ? ValidationService.digitsOnly(
          ValidationService.requiredText(
            value_(data, 'centroCusto', record.CENTRO_CUSTO),
            'Centro de custo'
          ),
          'Centro de custo'
        )
      : '';

    const currentProvider = ValidationService.normalizeText(record.FORNECEDOR);
    const providerInput = ValidationService.normalizeText(
      value_(data, 'fornecedor', currentProvider)
    );

    if (currentProvider && !providerInput) {
      ValidationService.fail(
        'Uma solicitação já triada não pode ter o fornecedor removido. Altere para outro fornecedor válido ou mantenha o atual.'
      );
    }

    let provider = '';
    if (providerInput) {
      const providerRow = ValidationService.findActive(
        SheetRepository.readObjects('CAD_FORNECEDORES'),
        'FORNECEDOR',
        providerInput,
        'Fornecedor'
      );
      validateProviderCompatibility_(providerRow, type);
      provider = ValidationService.normalizeText(providerRow.FORNECEDOR);
    }

    return {
      operationalDate: operationalDate,
      provider: provider,
      updates: {
        SUPERVISOR: supervisor,
        OPERACAO: operation,
        DATA_OPERACIONAL: DateService.toIsoDate(operationalDate),
        COMPETENCIA: DateService.competence(operationalDate),
        FORNECEDOR: provider,
        JUSTIFICATIVA: justification,
        RESPONSAVEL_CUSTO: responsibility,
        CENTRO_CUSTO: costCenter,
      },
    };
  }

  function normalizeLabor_(record, data, common) {
    const activity = canonicalActive_(
      'CAD_ATIVIDADES',
      'ATIVIDADE',
      value_(data, 'atividade', record.ATIVIDADE),
      'Atividade'
    );
    const role = canonicalActive_(
      'CAD_FUNCOES',
      'FUNCAO',
      value_(data, 'funcao', record.FUNCAO),
      'Função'
    );
    const shift = ValidationService.enumValue(
      value_(data, 'turno', record.TURNO),
      'Turno',
      ['DIURNO', 'NOTURNO']
    );
    const requestedQuantity = ValidationService.positiveInteger(
      value_(data, 'qtdSolicitada', record.QTD_SOLICITADA),
      'Quantidade solicitada'
    );

    let attendedQuantity = record.QTD_COMPARECIDA;
    if (Object.prototype.hasOwnProperty.call(data, 'qtdComparecida')) {
      attendedQuantity = data.qtdComparecida === '' || data.qtdComparecida == null
        ? ''
        : ValidationService.nonNegativeInteger(
            data.qtdComparecida,
            'Quantidade comparecida'
          );
    }

    if (attendedQuantity !== '' && attendedQuantity != null && !common.provider) {
      ValidationService.fail(
        'Não é possível manter comparecimento registrado sem fornecedor/preço aplicado.'
      );
    }

    let unitPrice = '';
    let expectedValue = '';
    let realValue = '';

    if (common.provider) {
      const priceResult = PricingService.resolveLaborPrice({
        provider: common.provider,
        role: role,
        shift: shift,
        date: common.operationalDate,
      });
      unitPrice = roundMoney_(priceResult.price);
      expectedValue = roundMoney_(requestedQuantity * unitPrice);
      if (attendedQuantity !== '' && attendedQuantity != null) {
        realValue = PartialShiftService.calculateRealValue(
          record.ID_SOLICITACAO,
          Number(attendedQuantity),
          unitPrice
        );
      }
    }

    return {
      ATIVIDADE: activity,
      FUNCAO: role,
      TURNO: shift,
      QTD_SOLICITADA: requestedQuantity,
      QTD_COMPARECIDA: attendedQuantity,
      PRECO_UNITARIO_APLICADO: unitPrice,
      VALOR_PREVISTO: expectedValue,
      VALOR_REAL: realValue,
    };
  }

  function normalizeFood_(record, data, common) {
    const originalFood = canonicalProductOptional_(
      value_(data, 'produtoAlimentacao', record.PRODUTO_ALIMENTACAO),
      'ALIMENTACAO'
    );
    const originalDrink = canonicalProductOptional_(
      value_(data, 'produtoBebida', record.PRODUTO_BEBIDA),
      'BEBIDA'
    );

    if (!originalFood && !originalDrink) {
      ValidationService.fail('Informe pelo menos um produto de alimentação ou bebida.');
    }

    const foodQuantity = originalFood
      ? ValidationService.positiveInteger(
          value_(data, 'qtdAlimentacao', record.QTD_ALIMENTACAO),
          'Quantidade de alimentação'
        )
      : '';
    const drinkQuantity = originalDrink
      ? ValidationService.positiveInteger(
          value_(data, 'qtdBebida', record.QTD_BEBIDA),
          'Quantidade de bebida'
        )
      : '';

    if (!common.provider) {
      return {
        PRODUTO_ALIMENTACAO: originalFood,
        QTD_ALIMENTACAO: foodQuantity,
        PRODUTO_BEBIDA: originalDrink,
        QTD_BEBIDA: drinkQuantity,
        PRODUTO_ALIMENTACAO_APLICADO: '',
        PRODUTO_BEBIDA_APLICADO: '',
        MOTIVO_AJUSTE_PRODUTO: '',
        PRECO_ALIMENTACAO_APLICADO: '',
        VALOR_ALIMENTACAO: '',
        PRECO_BEBIDA_APLICADO: '',
        VALOR_BEBIDA: '',
        VALOR_PREVISTO: '',
      };
    }

    const appliedFood = originalFood
      ? canonicalProductOptional_(
          value_(
            data,
            'produtoAlimentacaoAplicado',
            record.PRODUTO_ALIMENTACAO_APLICADO || originalFood
          ),
          'ALIMENTACAO'
        )
      : '';
    const appliedDrink = originalDrink
      ? canonicalProductOptional_(
          value_(
            data,
            'produtoBebidaAplicado',
            record.PRODUTO_BEBIDA_APLICADO || originalDrink
          ),
          'BEBIDA'
        )
      : '';

    const adjusted =
      ValidationService.normalizeUpper(appliedFood) !== ValidationService.normalizeUpper(originalFood) ||
      ValidationService.normalizeUpper(appliedDrink) !== ValidationService.normalizeUpper(originalDrink);

    const adjustmentReason = adjusted
      ? ValidationService.requiredText(
          value_(data, 'motivoAjusteProduto', record.MOTIVO_AJUSTE_PRODUTO),
          'Motivo do ajuste de produto'
        )
      : '';

    let foodUnitPrice = '';
    let foodValue = '';
    let drinkUnitPrice = '';
    let drinkValue = '';

    if (originalFood) {
      foodUnitPrice = roundMoney_(PricingService.resolveProductPrice({
        provider: common.provider,
        product: appliedFood,
        date: common.operationalDate,
      }));
      foodValue = roundMoney_(foodQuantity * foodUnitPrice);
    }

    if (originalDrink) {
      drinkUnitPrice = roundMoney_(PricingService.resolveProductPrice({
        provider: common.provider,
        product: appliedDrink,
        date: common.operationalDate,
      }));
      drinkValue = roundMoney_(drinkQuantity * drinkUnitPrice);
    }

    return {
      PRODUTO_ALIMENTACAO: originalFood,
      QTD_ALIMENTACAO: foodQuantity,
      PRODUTO_BEBIDA: originalDrink,
      QTD_BEBIDA: drinkQuantity,
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

  function canonicalActive_(sheetName, fieldName, value, label) {
    const row = ValidationService.findActive(
      SheetRepository.readObjects(sheetName),
      fieldName,
      ValidationService.requiredText(value, label),
      label
    );
    return ValidationService.normalizeText(row[fieldName]);
  }

  function canonicalProductOptional_(value, expectedCategory) {
    const normalized = ValidationService.normalizeText(value);
    if (!normalized) return '';

    const row = ValidationService.findActive(
      SheetRepository.readObjects('CAD_PRODUTOS'),
      'PRODUTO',
      normalized,
      'Produto'
    );

    if (ValidationService.normalizeUpper(row.CATEGORIA) !== expectedCategory) {
      ValidationService.fail('Produto não pertence à categoria ' + expectedCategory + ': ' + row.PRODUTO + '.');
    }

    return ValidationService.normalizeText(row.PRODUTO);
  }

  function validateProviderCompatibility_(providerRow, type) {
    if (type === TYPES.LABOR && !ValidationService.isTruthy(providerRow.MAO_DE_OBRA)) {
      ValidationService.fail('Fornecedor não habilitado para mão de obra.');
    }
    if (type === TYPES.FOOD && !ValidationService.isTruthy(providerRow.ALIMENTACAO)) {
      ValidationService.fail('Fornecedor não habilitado para alimentação/bebida.');
    }
  }

  function value_(data, fieldName, fallback) {
    return Object.prototype.hasOwnProperty.call(data, fieldName)
      ? data[fieldName]
      : fallback;
  }

  function changedFields_(record, updates) {
    return Object.keys(updates).filter(function (fieldName) {
      return comparable_(record[fieldName]) !== comparable_(updates[fieldName]);
    });
  }

  function comparable_(value) {
    if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
      return Utilities.formatDate(value, DateService.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
    }
    if (value == null) return '';
    return String(value).trim();
  }

  function snapshot_(record) {
    const fields = [
      'ID_SOLICITACAO', 'TIPO_SOLICITACAO', 'SUPERVISOR', 'OPERACAO',
      'DATA_OPERACIONAL', 'COMPETENCIA', 'FORNECEDOR', 'JUSTIFICATIVA',
      'RESPONSAVEL_CUSTO', 'CENTRO_CUSTO', 'ATIVIDADE', 'FUNCAO', 'TURNO',
      'QTD_SOLICITADA', 'QTD_COMPARECIDA', 'PRECO_UNITARIO_APLICADO',
      'PRODUTO_ALIMENTACAO', 'QTD_ALIMENTACAO', 'PRECO_ALIMENTACAO_APLICADO',
      'VALOR_ALIMENTACAO', 'PRODUTO_BEBIDA', 'QTD_BEBIDA',
      'PRECO_BEBIDA_APLICADO', 'VALOR_BEBIDA', 'VALOR_PREVISTO', 'VALOR_REAL',
      'PRODUTO_ALIMENTACAO_APLICADO', 'PRODUTO_BEBIDA_APLICADO',
      'MOTIVO_AJUSTE_PRODUTO',
    ];

    return fields.reduce(function (result, fieldName) {
      const value = record[fieldName];
      result[fieldName] = Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())
        ? Utilities.formatDate(value, DateService.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss")
        : value;
      return result;
    }, {});
  }

  function ensureAuditSheet_() {
    const spreadsheetId = PropertiesService
      .getScriptProperties()
      .getProperty('SPREADSHEET_ID');
    if (!spreadsheetId) {
      throw new Error('Propriedade SPREADSHEET_ID não configurada no Apps Script.');
    }

    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    let sheet = spreadsheet.getSheetByName(SHEET_AUDITORIA);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET_AUDITORIA);
      sheet.getRange(1, 1, 1, AUDIT_HEADERS.length).setValues([AUDIT_HEADERS]);
      sheet.getRange(1, 1, 1, AUDIT_HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, AUDIT_HEADERS.length);
    }
  }

  function appendAudit_(params) {
    SheetRepository.appendObject(
      SHEET_AUDITORIA,
      {
        ID_AUDITORIA: 'AUD-' + Utilities.getUuid(),
        ID_SOLICITACAO: params.idSolicitacao,
        DATA_ALTERACAO: new Date(),
        USUARIO_ADMINISTRATIVO: params.usuarioAdministrativo,
        MOTIVO_CORRECAO: params.motivoCorrecao,
        CAMPOS_ALTERADOS: params.camposAlterados.join(', '),
        ANTES_JSON: JSON.stringify(params.antes),
        DEPOIS_JSON: JSON.stringify(params.depois),
      },
      { textFields: ['ID_AUDITORIA', 'ID_SOLICITACAO'] }
    );
  }

  function roundMoney_(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  return {
    correct,
  };
})();
