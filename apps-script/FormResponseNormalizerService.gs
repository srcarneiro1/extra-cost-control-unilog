const FormResponseNormalizerService = (() => {
  const PROPERTY_FORM_ID = 'FORM_ID';
  const SHEET_SOLICITACOES = 'SOLICITACOES';
  const ORIGIN = 'GOOGLE_FORMS';
  const TRIGGER_HANDLER = 'onOperationalFormSubmit';
  const TEXT_FIELDS = ['COMPETENCIA', 'CENTRO_CUSTO', 'ID_ORIGEM'];
  // 05/11/2026 — incidente: a resposta do Allan (18:25) falhou por bloqueio ocupado por mais de 10 s
  // e se perdeu sem registro. Agora: espera de até 30 s, checagem de duplicidade lendo só colunas
  // (menos tempo segurando o bloqueio), registro de toda tentativa em LOG_INTEGRACAO_FORMS e
  // conciliação idempotente (FormReconciliationService) para recuperar respostas pendentes.
  const LOCK_WAIT_MS = 30000;
  const LOG_SHEET = 'LOG_INTEGRACAO_FORMS';
  const LOG_HEADERS = ['DATA_HORA', 'EXECUCAO', 'ID_RESPOSTA', 'DATA_RESPOSTA', 'RESULTADO', 'ID_SOLICITACAO', 'MENSAGEM', 'DURACAO_MS'];
  const LOCK_ERROR = 'Não foi possível obter bloqueio para normalizar a resposta do Forms.';

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

    // Erros continuam sendo relançados: a execução aparece como "Falha" no painel e o Google avisa
    // por e-mail; a diferença é que agora a falha fica registrada e a resposta pode ser recuperada.
    return processResponse(event.response, 'GATILHO');
  }

  // Ponto único de processamento (gatilho e conciliação). Registra o resultado sempre.
  function processResponse(formResponse, execution) {
    const started = Date.now();
    let responseId = '';
    let responseDate = '';
    try {
      responseId = String(formResponse.getId() || '');
      responseDate = formResponse.getTimestamp() || '';
    } catch (error) {
      // segue: a validação abaixo reporta a ausência do ID
    }
    try {
      const result = persist_(buildRecord_(formResponse));
      log_(execution, responseId, responseDate, result.duplicado ? 'DUPLICADA' : 'CRIADA', result.idSolicitacao, '', started);
      return result;
    } catch (error) {
      const message = String(error && error.message || error);
      const kind = message === LOCK_ERROR ? 'ERRO_BLOQUEIO'
        : error && error.name === 'ValidationError' ? 'ERRO_VALIDACAO'
        : 'ERRO_INESPERADO';
      log_(execution, responseId, responseDate, kind, '', message, started);
      throw error;
    }
  }

  // Monta e valida a solicitação a partir da resposta, sem gravar nada (usado também na simulação).
  function buildRecord_(formResponse) {
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
      STATUS: SolicitationStatusService.STATUS.SENT,
    };

    if (type === TYPES.LABOR) {
      applyLabor_(record, answers);
    } else {
      applyFood_(record, answers);
    }

    return { responseId: responseId, createdAt: createdAt, type: type, record: record };
  }

  // Grava com bloqueio. A checagem de duplicidade pelo ID da resposta acontece DENTRO do bloqueio:
  // gatilho repetido, edição de resposta ou conciliação nunca criam uma segunda solicitação.
  function persist_(built) {
    const responseId = built.responseId;
    const createdAt = built.createdAt;
    const type = built.type;
    const record = built.record;

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(LOCK_WAIT_MS)) {
      throw new Error(LOCK_ERROR);
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

      SolicitationStatusService.ensureSchema();
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
        status: record.STATUS,
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

  // Lê só as colunas necessárias (antes lia a aba inteira dentro do bloqueio, o que deixava cada
  // execução com 7 a 13 s e aumentava a chance de conflito com outras gravações).
  function findExisting_(responseId) {
    const index = originIndex();
    return index[responseId] ? { ID_SOLICITACAO: index[responseId] } : null;
  }

  // Mapa ID da resposta do Forms → protocolo, para as solicitações de origem GOOGLE_FORMS.
  function originIndex() {
    const origins = SheetRepository.readFieldValues(SHEET_SOLICITACOES, 'ORIGEM');
    const ids = SheetRepository.readFieldValues(SHEET_SOLICITACOES, 'ID_ORIGEM');
    const protocols = SheetRepository.readFieldValues(SHEET_SOLICITACOES, 'ID_SOLICITACAO');
    const index = {};
    for (let i = 0; i < ids.length; i += 1) {
      if (ValidationService.normalizeUpper(origins[i]) !== ORIGIN) continue;
      const id = ValidationService.normalizeText(ids[i]);
      if (id) index[id] = ValidationService.normalizeText(protocols[i]) || '(sem protocolo)';
    }
    return index;
  }

  // Registro de cada tentativa (sem dados pessoais). appendRow é atômico, então pode ser usado fora
  // do bloqueio. Falha no registro nunca derruba o processamento.
  function log_(execution, responseId, responseDate, result, protocol, message, started) {
    const duration = Date.now() - started;
    try {
      const spreadsheet = SheetRepository.getSpreadsheet();
      let sheet = spreadsheet.getSheetByName(LOG_SHEET);
      if (!sheet) {
        // Primeira execução: cria a aba de registro com o cabeçalho.
        sheet = spreadsheet.insertSheet(LOG_SHEET);
        sheet.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
      } else {
        SheetRepository.ensureColumns(LOG_SHEET, LOG_HEADERS);
      }
      const values = {
        DATA_HORA: new Date(),
        EXECUCAO: execution,
        ID_RESPOSTA: responseId,
        DATA_RESPOSTA: responseDate,
        RESULTADO: result,
        ID_SOLICITACAO: protocol || '',
        MENSAGEM: String(message || '').slice(0, 500),
        DURACAO_MS: duration,
      };
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      sheet.appendRow(headers.map(function (header) {
        return Object.prototype.hasOwnProperty.call(values, header) ? values[header] : '';
      }));
    } catch (error) {
      // registro é auxiliar
    }
    try {
      console.log(JSON.stringify({
        evento: 'extra_forms', execucao: execution, resultado: result, protocolo: protocol || '',
        resposta: maskId(responseId), duracaoMs: duration,
      }));
    } catch (error) {
      // idem
    }
  }

  function maskId(value) {
    const text = String(value || '');
    return text.length > 8 ? '…' + text.slice(-8) : text;
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
    TRIGGER_HANDLER,
    PROPERTY_FORM_ID,
    normalizeEvent,
    processResponse,
    buildRecord: buildRecord_,
    originIndex,
    maskId,
    openForm: openForm_,
    installTrigger,
  };
})();

function onOperationalFormSubmit(event) {
  return FormResponseNormalizerService.normalizeEvent(event);
}

function installFormResponseNormalizerTrigger() {
  return FormResponseNormalizerService.installTrigger();
}
