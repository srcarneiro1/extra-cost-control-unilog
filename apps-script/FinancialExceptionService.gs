const FinancialExceptionService = (() => {
  const SHEET_SOLICITACOES = 'SOLICITACOES';
  const SHEET_FECHAMENTOS = 'FECHAMENTOS';
  const SHEET_ITENS = 'FECHAMENTO_SOLICITACOES';
  const SHEET_DESTINOS = 'DESTINOS_FINANCEIROS_SOLICITACOES';

  const ACTIONS = Object.freeze({
    LIST: 'LISTAR',
    DECIDE: 'DECIDIR',
  });

  const DESTINATIONS = Object.freeze({
    NEXT_COMPETENCE: 'RECLASSIFICAR_PROXIMA_COMPETENCIA',
    ABSORBED: 'ABSORVIDA_NAO_FATURADA',
  });

  const HEADERS = [
    'ID_DESTINO_FINANCEIRO',
    'ID_SOLICITACAO',
    'COMPETENCIA_ORIGINAL',
    'FORNECEDOR',
    'DESTINO_FINANCEIRO',
    'COMPETENCIA_FATURAMENTO',
    'MOTIVO',
    'DATA_DECISAO',
    'USUARIO_DECISAO',
    'DATA_ATUALIZACAO',
  ];

  function execute(payload) {
    const input = payload || {};
    const action = ValidationService.enumValue(
      input.acao || ACTIONS.LIST,
      'Ação da exceção financeira',
      [ACTIONS.LIST, ACTIONS.DECIDE]
    );

    if (action === ACTIONS.DECIDE) return decide_(input);
    return list_(input);
  }

  function list_(input) {
    const competence = optionalCompetence_(input.competencia);
    const providerFilter = text_(input.fornecedor);
    const destinations = readOptionalObjects_(SHEET_DESTINOS);
    const destinationBySolicitation = {};
    destinations.forEach(function (record) {
      const id = text_(record.ID_SOLICITACAO);
      if (id) destinationBySolicitation[id] = record;
    });

    const closeouts = readOptionalObjects_(SHEET_FECHAMENTOS).filter(function (record) {
      if (competence && normalizeCompetence_(record.COMPETENCIA_FATURAMENTO) !== competence) return false;
      if (providerFilter && text_(record.FORNECEDOR) !== providerFilter) return false;
      return true;
    });

    const items = readOptionalObjects_(SHEET_ITENS);
    const linkedByCloseout = {};
    items.forEach(function (record) {
      const closeoutId = text_(record.ID_FECHAMENTO);
      const solicitationId = text_(record.ID_SOLICITACAO);
      if (!closeoutId || !solicitationId) return;
      if (!linkedByCloseout[closeoutId]) linkedByCloseout[closeoutId] = {};
      linkedByCloseout[closeoutId][solicitationId] = true;
    });

    const solicitationCache = {};
    const result = [];

    closeouts.forEach(function (closeout) {
      const originalCompetence = normalizeCompetence_(closeout.COMPETENCIA_FATURAMENTO);
      const provider = text_(closeout.FORNECEDOR);
      const closeoutId = text_(closeout.ID_FECHAMENTO);
      if (!originalCompetence || !provider || !closeoutId) return;

      const cacheKey = originalCompetence + '|' + provider;
      let solicitations = solicitationCache[cacheKey];
      if (!solicitations) {
        solicitations = SheetRepository.readObjectsByFieldValues(
          SHEET_SOLICITACOES,
          'COMPETENCIA',
          [originalCompetence]
        ).filter(function (record) {
          return text_(record.FORNECEDOR) === provider;
        });
        solicitationCache[cacheKey] = solicitations;
      }

      const linked = linkedByCloseout[closeoutId] || {};
      solicitations.forEach(function (record) {
        const solicitationId = text_(record.ID_SOLICITACAO);
        if (!solicitationId || linked[solicitationId] || destinationBySolicitation[solicitationId]) return;
        if (!eligibleSolicitation_(record)) return;

        result.push({
          idSolicitacao: solicitationId,
          competenciaOriginal: originalCompetence,
          fornecedor: provider,
          idFechamentoOriginal: closeoutId,
          statusFechamentoOriginal: text_(closeout.STATUS_FECHAMENTO),
          dataOperacional: isoDate_(record.DATA_OPERACIONAL),
          operacao: text_(record.OPERACAO),
          tipoSolicitacao: text_(record.TIPO_SOLICITACAO),
          responsavelCusto: text_(record.RESPONSAVEL_CUSTO),
          valorReal: numberOrNull_(record.VALOR_REAL),
        });
      });
    });

    result.sort(function (left, right) {
      if (left.competenciaOriginal !== right.competenciaOriginal) {
        return right.competenciaOriginal.localeCompare(left.competenciaOriginal);
      }
      if (left.fornecedor !== right.fornecedor) {
        return left.fornecedor.localeCompare(right.fornecedor, 'pt-BR');
      }
      return left.idSolicitacao.localeCompare(right.idSolicitacao);
    });

    return {
      total: result.length,
      itens: result,
    };
  }

  function decide_(input) {
    const solicitationId = requiredText_(input.idSolicitacao, 'Solicitação');
    const destination = ValidationService.enumValue(
      input.destinoFinanceiro,
      'Destino financeiro',
      [DESTINATIONS.NEXT_COMPETENCE, DESTINATIONS.ABSORBED]
    );
    const reason = requiredReason_(input.motivo);
    const user = requiredText_(input.usuarioAdministrativo, 'Usuário administrativo');
    const billingCompetence = destination === DESTINATIONS.NEXT_COMPETENCE
      ? requiredCompetence_(input.competenciaFaturamento)
      : '';

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      ensureSheet_();

      const existing = SheetRepository.findRowByField(SHEET_DESTINOS, 'ID_SOLICITACAO', solicitationId);
      if (existing) {
        ValidationService.fail('A solicitação já possui destino financeiro registrado.');
      }

      const solicitationMatch = SheetRepository.findRowByField(SHEET_SOLICITACOES, 'ID_SOLICITACAO', solicitationId);
      if (!solicitationMatch) ValidationService.fail('Solicitação não encontrada.');

      const solicitation = solicitationMatch.record;
      if (!eligibleSolicitation_(solicitation)) {
        ValidationService.fail('A solicitação ainda não está elegível para decisão financeira tardia.');
      }

      const originalCompetence = normalizeCompetence_(solicitation.COMPETENCIA);
      const provider = text_(solicitation.FORNECEDOR);
      if (!originalCompetence || !provider) {
        ValidationService.fail('Solicitação sem competência ou fornecedor válido.');
      }

      const closeout = findCloseout_(originalCompetence, provider);
      if (!closeout) {
        ValidationService.fail('Não existe fechamento anterior para esta competência e fornecedor.');
      }

      if (isLinked_(text_(closeout.ID_FECHAMENTO), solicitationId)) {
        ValidationService.fail('A solicitação já pertence ao fechamento original e não é uma exceção tardia.');
      }

      if (destination === DESTINATIONS.NEXT_COMPETENCE && billingCompetence <= originalCompetence) {
        ValidationService.fail('A competência de faturamento deve ser posterior à competência operacional original.');
      }

      const now = new Date();
      const id = 'DFIN-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
      SheetRepository.appendObject(SHEET_DESTINOS, {
        ID_DESTINO_FINANCEIRO: id,
        ID_SOLICITACAO: solicitationId,
        COMPETENCIA_ORIGINAL: originalCompetence,
        FORNECEDOR: provider,
        DESTINO_FINANCEIRO: destination,
        COMPETENCIA_FATURAMENTO: billingCompetence,
        MOTIVO: reason,
        DATA_DECISAO: now,
        USUARIO_DECISAO: user,
        DATA_ATUALIZACAO: now,
      }, {
        textFields: [
          'ID_DESTINO_FINANCEIRO',
          'ID_SOLICITACAO',
          'COMPETENCIA_ORIGINAL',
          'COMPETENCIA_FATURAMENTO',
        ],
      });

      return {
        idDestinoFinanceiro: id,
        idSolicitacao: solicitationId,
        competenciaOriginal: originalCompetence,
        fornecedor: provider,
        destinoFinanceiro: destination,
        competenciaFaturamento: billingCompetence || null,
        motivo: reason,
        dataDecisao: dateTime_(now),
        usuarioDecisao: user,
      };
    } finally {
      lock.releaseLock();
    }
  }

  function eligibleSolicitation_(record) {
    const status = SolicitationStatusService.resolve(record);
    const validStatus = status === SolicitationStatusService.STATUS.ATTENDED ||
      status === SolicitationStatusService.STATUS.WAITING_INVOICE;
    return Boolean(text_(record.FORNECEDOR) && validStatus && numberOrNull_(record.VALOR_REAL) != null);
  }

  function findCloseout_(competence, provider) {
    return readOptionalObjects_(SHEET_FECHAMENTOS).filter(function (record) {
      return normalizeCompetence_(record.COMPETENCIA_FATURAMENTO) === competence &&
        text_(record.FORNECEDOR) === provider;
    })[0] || null;
  }

  function isLinked_(closeoutId, solicitationId) {
    return readOptionalObjects_(SHEET_ITENS).some(function (record) {
      return text_(record.ID_FECHAMENTO) === closeoutId &&
        text_(record.ID_SOLICITACAO) === solicitationId;
    });
  }

  function ensureSheet_() {
    const spreadsheet = SheetRepository.getSpreadsheet();
    let sheet = spreadsheet.getSheetByName(SHEET_DESTINOS);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET_DESTINOS);
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.setFrozenRows(1);
      return sheet;
    }
    SheetRepository.ensureColumns(SHEET_DESTINOS, HEADERS);
    return sheet;
  }

  function readOptionalObjects_(sheetName) {
    const spreadsheet = SheetRepository.getSpreadsheet();
    if (!spreadsheet.getSheetByName(sheetName)) return [];
    return SheetRepository.readObjects(sheetName);
  }

  function requiredText_(value, label) {
    const normalized = text_(value);
    if (!normalized) ValidationService.fail(label + ' obrigatório.');
    return normalized;
  }

  function requiredReason_(value) {
    const reason = requiredText_(value, 'Motivo');
    if (reason.length < 5) ValidationService.fail('Motivo deve ter pelo menos 5 caracteres.');
    return reason;
  }

  function optionalCompetence_(value) {
    const normalized = text_(value);
    return normalized ? requiredCompetence_(normalized) : '';
  }

  function requiredCompetence_(value) {
    const normalized = normalizeCompetence_(value);
    if (!normalized) ValidationService.fail('Competência inválida. Use YYYY-MM.');
    return normalized;
  }

  function normalizeCompetence_(value) {
    const normalized = text_(value);
    return /^\d{4}-(0[1-9]|1[0-2])$/.test(normalized) ? normalized : '';
  }

  function text_(value) {
    return String(value == null ? '' : value).trim();
  }

  function numberOrNull_(value) {
    if (value === '' || value == null) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function isoDate_(value) {
    if (!value) return '';
    try { return DateService.toIsoDate(value); }
    catch (error) { return text_(value); }
  }

  function dateTime_(value) {
    if (!value) return '';
    const date = Object.prototype.toString.call(value) === '[object Date]' ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return text_(value);
    return Utilities.formatDate(date, DateService.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
  }

  return {
    ACTIONS,
    DESTINATIONS,
    execute,
  };
})();
