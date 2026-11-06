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
    categories: 'Categorias solicitadas',
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
      const built = buildRecord_(formResponse);
      const result = persist_(built);
      log_(execution, responseId, responseDate, result.duplicado ? 'DUPLICADA' : 'CRIADA', result.idSolicitacao, (built.notes || []).join(' '), started);
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
    return buildFromAnswers_(responseMap_(formResponse), {
      responseId: ValidationService.requiredText(formResponse.getId(), 'ID da resposta do Forms'),
      createdAt: formResponse.getTimestamp() || new Date(),
      origin: ORIGIN,
    });
  }

  // Mesma validação para o Google Forms e para a tela de solicitação do aplicativo (05/11/2026):
  // answers = { título da pergunta: resposta }; meta = { responseId, createdAt, origin }.
  function buildFromAnswers_(answers, meta) {
    const responseId = ValidationService.requiredText(meta.responseId, 'Identificador do envio');
    const type = resolveType_(answer_(answers, QUESTIONS.type));
    const createdAt = meta.createdAt || new Date();
    const operationalDate = DateService.parseDateOnly(
      ValidationService.requiredText(answer_(answers, QUESTIONS.operationalDate), 'Data operacional')
    );

    // Responsável pelo custo vem do cadastro (CLIENTE, UNILOG, DIRETORIA, PROJETOS…), não mais fixo.
    const cost = CostCenterService.validate(
      answer_(answers, QUESTIONS.costResponsibility),
      answer_(answers, QUESTIONS.costCenter)
    );
    const responsibility = cost.responsavel;
    const costCenter = cost.centroCusto;

    const record = {
      ID_SOLICITACAO: '',
      TIPO_SOLICITACAO: type,
      DATA_CRIACAO: createdAt,
      USUARIO_CRIACAO: ValidationService.requiredText(answer_(answers, QUESTIONS.requester), 'Nome do solicitante'),
      ORIGEM: meta.origin || ORIGIN,
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

    let notes = [];
    if (type === TYPES.LABOR) {
      applyLabor_(record, answers);
    } else {
      notes = applyFood_(record, answers);
    }

    return { responseId: responseId, createdAt: createdAt, type: type, origin: meta.origin || ORIGIN, record: record, notes: notes || [] };
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
      const existing = findExisting_(responseId, built.origin);
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

  // Alimentação/bebidas (07/11/2026): respeita "Categorias solicitadas" do Google Forms.
  // Incidentes de 02/11 e 03/11: categoria só "Alimentação", bebida escolhida e quantidade de
  // bebida vazia → antes recusado. Regras por item (alimentação e bebida, separadamente):
  //   - categoria marcada → produto e quantidade obrigatórios;
  //   - categoria NÃO marcada + produto escolhido + quantidade vazia → resíduo ignorado (anotado no registro);
  //   - categoria NÃO marcada + quantidade preenchida → inconsistência: recusa, sem presumir.
  // Sem a pergunta de categorias (tela de solicitação do app), vale a regra anterior.
  // Retorna as observações (ex.: resíduo ignorado) para o registro de integração.
  function applyFood_(record, answers) {
    let food = ValidationService.normalizeText(answer_(answers, QUESTIONS.food));
    let drink = ValidationService.normalizeText(answer_(answers, QUESTIONS.drink));
    const foodQuantityRaw = ValidationService.normalizeText(answer_(answers, QUESTIONS.foodQuantity));
    const drinkQuantityRaw = ValidationService.normalizeText(answer_(answers, QUESTIONS.drinkQuantity));
    const categoriesRaw = ValidationService.normalizeUpper(answer_(answers, QUESTIONS.categories));
    const notes = [];

    if (categoriesRaw) {
      const wantsFood = categoriesRaw.indexOf('ALIMENTA') >= 0;
      const wantsDrink = categoriesRaw.indexOf('BEBIDA') >= 0;
      const checkItem = function (wanted, product, quantity, label, categoryLabel) {
        if (wanted) {
          if (!product) ValidationService.fail('Categoria ' + categoryLabel + ' marcada, mas nenhum produto de ' + label + ' foi escolhido.');
          return product;
        }
        if (quantity) {
          ValidationService.fail('Inconsistência: quantidade de ' + label + ' informada, mas a categoria ' + categoryLabel + ' não foi marcada.');
        }
        if (product) notes.push(categoryLabel + ' "' + product + '" ignorada: categoria não marcada e quantidade vazia.');
        return '';
      };
      food = checkItem(wantsFood, food, foodQuantityRaw, 'alimentação', 'Alimentação');
      drink = checkItem(wantsDrink, drink, drinkQuantityRaw, 'bebida', 'Bebida');
    }

    if (!food && !drink) {
      ValidationService.fail('Informe pelo menos um produto de alimentação ou bebida.');
    }

    if (food) {
      const canonicalFood = canonicalCatalogValue_('CAD_PRODUTOS', 'PRODUTO', food);
      validateProductCategory_(canonicalFood, 'ALIMENTACAO');
      record.PRODUTO_ALIMENTACAO = canonicalFood;
      record.QTD_ALIMENTACAO = ValidationService.positiveInteger(foodQuantityRaw, 'Quantidade de alimentação');
    } else if (foodQuantityRaw && !categoriesRaw) {
      ValidationService.fail('Produto de alimentação é obrigatório quando a quantidade de alimentação for informada.');
    }

    if (drink) {
      const canonicalDrink = canonicalCatalogValue_('CAD_PRODUTOS', 'PRODUTO', drink);
      validateProductCategory_(canonicalDrink, 'BEBIDA');
      record.PRODUTO_BEBIDA = canonicalDrink;
      record.QTD_BEBIDA = ValidationService.positiveInteger(drinkQuantityRaw, 'Quantidade de bebida');
    } else if (drinkQuantityRaw && !categoriesRaw) {
      ValidationService.fail('Produto de bebida é obrigatório quando a quantidade de bebida for informada.');
    }
    return notes;
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

  // Grava várias solicitações já validadas sob UM bloqueio (envio da tela com mão de obra + lanche).
  // Idempotente por ID de origem: reenvio do mesmo envio devolve os protocolos já criados.
  function persistMany(builtList, execution) {
    const started = Date.now();
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(LOCK_WAIT_MS)) {
      builtList.forEach((b) => log_(execution, b.responseId, b.createdAt, 'ERRO_BLOQUEIO', '', LOCK_ERROR, started));
      throw new Error('Sistema ocupado no momento. Tente enviar novamente em alguns segundos.');
    }
    try {
      SolicitationStatusService.ensureSchema();
      // Duplicidade lida uma vez por origem (não a cada registro) e gravação em lote (07/11/2026).
      const indexes = {};
      const toAppend = [];
      const results = builtList.map((built) => {
        const origin = built.origin || ORIGIN;
        if (!indexes[origin]) indexes[origin] = originIndex(origin);
        const existing = indexes[origin][built.responseId];
        if (existing) return { duplicado: true, idSolicitacao: existing, tipoSolicitacao: built.type };
        built.record.ID_SOLICITACAO = ProtocolService.next(built.createdAt);
        indexes[origin][built.responseId] = built.record.ID_SOLICITACAO;
        toAppend.push(built.record);
        return { duplicado: false, idSolicitacao: built.record.ID_SOLICITACAO, tipoSolicitacao: built.type };
      });
      SheetRepository.appendObjects(SHEET_SOLICITACOES, toAppend, { textFields: TEXT_FIELDS });
      logMany_(builtList.map((b, i) => [execution, b.responseId, b.createdAt, results[i].duplicado ? 'DUPLICADA' : 'CRIADA', results[i].idSolicitacao, (b.notes || []).join(' ')]), started);
      return results;
    } finally {
      lock.releaseLock();
    }
  }

  // Registro de várias tentativas numa única escrita (chamado dentro do bloqueio).
  function logMany_(entries, started) {
    const duration = Date.now() - started;
    try {
      const spreadsheet = SheetRepository.getSpreadsheet();
      let sheet = spreadsheet.getSheetByName(LOG_SHEET);
      if (!sheet) {
        sheet = spreadsheet.insertSheet(LOG_SHEET);
        sheet.getRange(1, 1, 1, LOG_HEADERS.length).setValues([LOG_HEADERS]);
      } else {
        SheetRepository.ensureColumns(LOG_SHEET, LOG_HEADERS);
      }
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const rows = entries.map((e) => {
        const values = { DATA_HORA: new Date(), EXECUCAO: e[0], ID_RESPOSTA: e[1], DATA_RESPOSTA: e[2], RESULTADO: e[3], ID_SOLICITACAO: e[4] || '', MENSAGEM: String(e[5] || '').slice(0, 500), DURACAO_MS: duration };
        return headers.map((h) => (Object.prototype.hasOwnProperty.call(values, h) ? values[h] : ''));
      });
      if (rows.length) sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, headers.length).setValues(rows);
    } catch (error) {
      // registro é auxiliar
    }
    try {
      console.log(JSON.stringify({ evento: 'extra_forms', execucao: entries.length ? entries[0][0] : '', resultado: 'LOTE', quantidade: entries.length, duracaoMs: duration }));
    } catch (error) {
      // idem
    }
  }

  // Lê só as colunas necessárias (antes lia a aba inteira dentro do bloqueio, o que deixava cada
  // execução com 7 a 13 s e aumentava a chance de conflito com outras gravações).
  function findExisting_(responseId, origin) {
    const index = originIndex(origin);
    return index[responseId] ? { ID_SOLICITACAO: index[responseId] } : null;
  }

  // Mapa ID de origem → protocolo, para as solicitações da origem informada (padrão: GOOGLE_FORMS).
  function originIndex(origin) {
    const wanted = ValidationService.normalizeUpper(origin || ORIGIN);
    const origins = SheetRepository.readFieldValues(SHEET_SOLICITACOES, 'ORIGEM');
    const ids = SheetRepository.readFieldValues(SHEET_SOLICITACOES, 'ID_ORIGEM');
    const protocols = SheetRepository.readFieldValues(SHEET_SOLICITACOES, 'ID_SOLICITACAO');
    const index = {};
    for (let i = 0; i < ids.length; i += 1) {
      if (ValidationService.normalizeUpper(origins[i]) !== wanted) continue;
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
    buildFromAnswers: buildFromAnswers_,
    persistMany,
    log: log_,
    QUESTIONS,
    FORM_TYPES,
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
