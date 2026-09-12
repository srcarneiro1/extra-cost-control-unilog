const FormResponseNormalizerService = (() => {
  const PROPERTY_FORM_ID = 'FORM_ID';
  const SHEET_SOLICITACOES = 'SOLICITACOES';
  const ORIGIN = 'GOOGLE_FORMS';
  const TRIGGER_HANDLER = 'onOperationalFormSubmit';
  const TEXT_FIELDS = ['COMPETENCIA', 'CENTRO_CUSTO', 'ID_ORIGEM'];

  const TYPES = Object.freeze({
    LABOR: 'MAO_DE_OBRA',
    FOOD: 'ALIMENTACAO_BEBIDA',
  });

  const FORM_TYPES = Object.freeze({
    LABOR: 'MÃO DE OBRA TERCEIRIZADA',
    FOOD: 'ALIMENTAÇÃO / BEBIDAS',
  });

  const QUESTIONS = Object.freeze({
    type: 'O que você deseja solicitar?',
    requester: 'Nome do solicitante',
    supervisor: 'Supervisor responsável',
    operation: 'Operação',
    operationalDate: 'Data operacional',
    justification: 'Justificativa da solicitação',
    activity: 'Atividade',
    requestedQuantity: 'Quantidade de pessoas solicitadas',
    referenceVolume: 'Volume de referência',
    volumeUnit: 'Unidade do volume',
    role: 'Função',
    shift: 'Turno',
    auxiliaryShift: 'Turno — Auxiliar Operacional',
    forkliftShift: 'Turno — Operador de Empilhadeira',
    food: 'Alimentação',
    foodQuantity: 'Quantidade de alimentação',
    drink: 'Bebida',
    drinkQuantity: 'Quantidade de bebida',
    costResponsibility: 'Responsável pelo custo',
    costCenter: 'Centro de custo',
  });

  function normalizeEvent(event) {
    if (!event || !event.response) {
      throw new Error('Evento de envio do Google Forms inválido ou ausente.');
    }

    return normalizeResponse_(event.response);
  }

  function normalizeResponse_(formResponse) {
    const responseId = ValidationService.requiredText(formResponse.getId(), 'ID da resposta do Forms');
    const answers = responseMap_(formResponse);
    const type = resolveType_(answer_(answers, QUESTIONS.type));
    const createdAt = formResponse.getTimestamp() || new Date();
    const operationalDate = DateService.parseDateOnly(
      ValidationService.requiredText(answer_(answers, QUESTIONS.operationalDate), 'Data operacional')
    );

    const responsibility = ValidationService.enumValue(
      answer_(answers, QUESTIONS.costResponsibility),
      'Responsável pelo custo',
      ['CLIENTE', 'UNILOG']
    );

    const costCenter = responsibility === 'UNILOG'
      ? ValidationService.digitsOnly(
          ValidationService.requiredText(answer_(answers, QUESTIONS.costCenter), 'Centro de custo'),
          'Centro de custo'
        )
      : '';

    const record = {
      ID_SOLICITACAO: '',
      TIPO_SOLICITACAO: type,
      DATA_CRIACAO: createdAt,
      USUARIO_CRIACAO: ValidationService.requiredText(answer_(answers, QUESTIONS.requester), 'Nome do solicitante'),
      ORIGEM: ORIGIN,
      ID_ORIGEM: responseId,
      LOTE_IMPORTACAO: '',
      SUPERVISOR: canonicalCatalogValue_(
        'CAD_SUPERVISORES',
        'SUPERVISOR',
        ValidationService.requiredText(answer_(answers, QUESTIONS.supervisor), 'Supervisor')
      ),
      OPERACAO: canonicalCatalogValue_(
        'CAD_OPERACOES',
        'OPERACAO',
        ValidationService.requiredText(answer_(answers, QUESTIONS.operation), 'Operação')
      ),
      DATA_OPERACIONAL: DateService.toIsoDate(operationalDate),
      COMPETENCIA: DateService.competence(operationalDate),
      FORNECEDOR: '',
      JUSTIFICATIVA: ValidationService.requiredText(answer_(answers, QUESTIONS.justification), 'Justificativa'),
      RESPONSAVEL_CUSTO: responsibility,
      CENTRO_CUSTO: costCenter,
      ATIVIDADE: '',
      FUNCAO: '',
      TURNO: '',
      QTD_SOLICITADA: '',
      QTD_COMPARECIDA: '',
      VOLUME_REFERENCIA: '',
      UNIDADE_VOLUME: '',
      PRECO_UNITARIO_APLICADO: '',
      PRODUTO_ALIMENTACAO: '',
      QTD_ALIMENTACAO: '',
      PRECO_ALIMENTACAO_APLICADO: '',
      VALOR_ALIMENTACAO: '',
      PRODUTO_BEBIDA: '',
      QTD_BEBIDA: '',
      PRECO_BEBIDA_APLICADO: '',
      VALOR_BEBIDA: '',
      VALOR_PREVISTO: '',
      VALOR_REAL: '',
    };

    if (type === TYPES.LABOR) {
      applyLabor_(record, answers);
    } else {
      applyFood_(record, answers);
    }

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw new Error('Não foi possível obter bloqueio para normalizar a resposta do Forms.');
    }

    try {
      const existing = findExisting_(responseId);
      if (existing) {
        return {
          normalizado: false,
          duplicado: true,
          idSolicitacao: existing.ID_SOLICITACAO,
          idOrigem: responseId,
        };
      }

      record.ID_SOLICITACAO = ProtocolService.next(createdAt);
      SheetRepository.appendObject(SHEET_SOLICITACOES, record, {
        textFields: TEXT_FIELDS,
      });

      return {
        normalizado: true,
        duplicado: false,
        idSolicitacao: record.ID_SOLICITACAO,
        idOrigem: responseId,
        tipoSolicitacao: type,
        competencia: record.COMPETENCIA,
      };
    } finally {
      lock.releaseLock();
    }
  }

  function applyLabor_(record, answers) {
    const activity = ValidationService.requiredText(answer_(answers, QUESTIONS.activity), 'Atividade');
    const role = canonicalCatalogValue_(
      'CAD_FUNCOES',
      'FUNCAO',
      ValidationService.requiredText(answer_(answers, QUESTIONS.role), 'Função')
    );

    const genericShift = ValidationService.normalizeUpper(answer_(answers, QUESTIONS.shift));
    const auxiliaryShift = ValidationService.normalizeUpper(answer_(answers, QUESTIONS.auxiliaryShift));
    const forkliftShift = ValidationService.normalizeUpper(answer_(answers, QUESTIONS.forkliftShift));

    const legacyShifts = [auxiliaryShift, forkliftShift].filter(Boolean);
    if (legacyShifts.length > 1) {
      ValidationService.fail('Resposta inválida: dois campos de turno legados foram preenchidos para a mesma solicitação.');
    }

    if (genericShift && legacyShifts.length && genericShift !== legacyShifts[0]) {
      ValidationService.fail('Resposta inválida: turno genérico e turno legado estão divergentes.');
    }

    const shift = ValidationService.enumValue(
      genericShift || legacyShifts[0] || '',
      'Turno',
      ['DIURNO', 'NOTURNO']
    );

    record.ATIVIDADE = canonicalOrOriginal_('CAD_ATIVIDADES', 'ATIVIDADE', activity);
    record.FUNCAO = role;
    record.TURNO = shift;
    record.QTD_SOLICITADA = ValidationService.positiveInteger(
      answer_(answers, QUESTIONS.requestedQuantity),
      'Quantidade solicitada'
    );
    record.VOLUME_REFERENCIA = ValidationService.normalizeText(answer_(answers, QUESTIONS.referenceVolume));
    record.UNIDADE_VOLUME = ValidationService.normalizeText(answer_(answers, QUESTIONS.volumeUnit));
  }

  function applyFood_(record, answers) {
    const food = ValidationService.normalizeText(answer_(answers, QUESTIONS.food));
    const drink = ValidationService.normalizeText(answer_(answers, QUESTIONS.drink));
    const foodQuantityRaw = ValidationService.normalizeText(answer_(answers, QUESTIONS.foodQuantity));
    const drinkQuantityRaw = ValidationService.normalizeText(answer_(answers, QUESTIONS.drinkQuantity));

    if (!food && !drink) {
      ValidationService.fail('Informe pelo menos um produto de alimentação ou bebida.');
    }

    if (food) {
      const canonicalFood = canonicalCatalogValue_('CAD_PRODUTOS', 'PRODUTO', food);
      validateProductCategory_(canonicalFood, 'ALIMENTACAO');
      record.PRODUTO_ALIMENTACAO = canonicalFood;
      record.QTD_ALIMENTACAO = ValidationService.positiveInteger(foodQuantityRaw, 'Quantidade de alimentação');
    } else if (foodQuantityRaw) {
      ValidationService.fail('Produto de alimentação é obrigatório quando a quantidade de alimentação for informada.');
    }

    if (drink) {
      const canonicalDrink = canonicalCatalogValue_('CAD_PRODUTOS', 'PRODUTO', drink);
      validateProductCategory_(canonicalDrink, 'BEBIDA');
      record.PRODUTO_BEBIDA = canonicalDrink;
      record.QTD_BEBIDA = ValidationService.positiveInteger(drinkQuantityRaw, 'Quantidade de bebida');
    } else if (drinkQuantityRaw) {
      ValidationService.fail('Produto de bebida é obrigatório quando a quantidade de bebida for informada.');
    }
  }

  function validateProductCategory_(productName, expectedCategory) {
    const rows = SheetRepository.readObjects('CAD_PRODUTOS');
    const target = ValidationService.normalizeUpper(productName);
    const row = rows.find(function (item) {
      return ValidationService.normalizeUpper(item.PRODUTO) === target;
    });

    if (!row || !ValidationService.isTruthy(row.ATIVO)) {
      ValidationService.fail('Produto não encontrado ou inativo: ' + productName + '.');
    }

    if (ValidationService.normalizeUpper(row.CATEGORIA) !== expectedCategory) {
      ValidationService.fail('Produto ' + productName + ' não pertence à categoria ' + expectedCategory + '.');
    }
  }

  function resolveType_(formValue) {
    const normalized = ValidationService.normalizeUpper(formValue);
    if (normalized === FORM_TYPES.LABOR) return TYPES.LABOR;
    if (normalized === FORM_TYPES.FOOD) return TYPES.FOOD;
    ValidationService.fail('Tipo de solicitação do Forms não reconhecido: ' + ValidationService.normalizeText(formValue) + '.');
  }

  function responseMap_(formResponse) {
    return formResponse.getItemResponses().reduce(function (map, itemResponse) {
      const title = normalizeTitle_(itemResponse.getItem().getTitle());
      map[title] = normalizeResponseValue_(itemResponse.getResponse());
      return map;
    }, {});
  }

  function normalizeResponseValue_(value) {
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (value == null) return '';
    if (Object.prototype.toString.call(value) === '[object Date]') {
      return DateService.toIsoDate(value);
    }
    return String(value).trim();
  }

  function answer_(answers, title) {
    return Object.prototype.hasOwnProperty.call(answers, normalizeTitle_(title))
      ? answers[normalizeTitle_(title)]
      : '';
  }

  function normalizeTitle_(value) {
    return ValidationService.normalizeText(value);
  }

  function canonicalCatalogValue_(sheetName, fieldName, submittedValue) {
    const row = ValidationService.findActive(
      SheetRepository.readObjects(sheetName),
      fieldName,
      submittedValue,
      fieldName
    );

    return ValidationService.normalizeText(row[fieldName]);
  }

  function canonicalOrOriginal_(sheetName, fieldName, submittedValue) {
    const normalized = ValidationService.normalizeUpper(submittedValue);
    const row = SheetRepository.readObjects(sheetName).find(function (item) {
      return ValidationService.normalizeUpper(item[fieldName]) === normalized;
    });

    if (!row) {
      return ValidationService.normalizeText(submittedValue);
    }

    if (!ValidationService.isTruthy(row.ATIVO)) {
      ValidationService.fail(fieldName + ' não encontrado ou inativo: ' + submittedValue + '.');
    }

    return ValidationService.normalizeText(row[fieldName]);
  }

  function findExisting_(responseId) {
    return SheetRepository.readObjects(SHEET_SOLICITACOES).find(function (row) {
      return ValidationService.normalizeUpper(row.ORIGEM) === ORIGIN &&
        ValidationService.normalizeText(row.ID_ORIGEM) === responseId;
    }) || null;
  }

  function installTrigger() {
    const form = openForm_();

    ScriptApp.getProjectTriggers().forEach(function (trigger) {
      if (trigger.getHandlerFunction() === TRIGGER_HANDLER) {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    ScriptApp
      .newTrigger(TRIGGER_HANDLER)
      .forForm(form)
      .onFormSubmit()
      .create();

    return {
      instalado: true,
      handler: TRIGGER_HANDLER,
    };
  }

  function openForm_() {
    const formId = PropertiesService
      .getScriptProperties()
      .getProperty(PROPERTY_FORM_ID);

    if (!formId) {
      throw new Error('Propriedade FORM_ID não configurada no Apps Script.');
    }

    return FormApp.openById(formId);
  }

  return {
    normalizeEvent,
    installTrigger,
  };
})();

function onOperationalFormSubmit(event) {
  return FormResponseNormalizerService.normalizeEvent(event);
}

function installFormResponseNormalizerTrigger() {
  return FormResponseNormalizerService.installTrigger();
}
