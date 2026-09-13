const FinancialCloseoutService = (() => {
  const SHEET_SOLICITACOES = 'SOLICITACOES';
  const SHEET_FECHAMENTOS = 'FECHAMENTOS';
  const SHEET_ITENS = 'FECHAMENTO_SOLICITACOES';

  const ACTIONS = Object.freeze({
    LIST: 'LISTAR',
    METADATA: 'METADADOS',
    CLOSE: 'FECHAR',
  });

  const STATUS = Object.freeze({
    TRACKING: 'EM_ACOMPANHAMENTO',
    WAITING_INVOICE: 'AGUARDANDO_NF',
    CHECKED: 'CONFERIDA',
    CLOSED: 'ENCERRADA',
  });

  const CLOSEOUT_HEADERS = [
    'ID_FECHAMENTO',
    'COMPETENCIA_FATURAMENTO',
    'FORNECEDOR',
    'STATUS_FECHAMENTO',
    'QTD_SOLICITACOES',
    'VALOR_CONTROLE',
    'DATA_FECHAMENTO',
    'USUARIO_FECHAMENTO',
    'RESULTADO_CONCILIACAO',
    'ID_NF',
    'DATA_ATUALIZACAO',
  ];

  const ITEM_HEADERS = [
    'ID_FECHAMENTO',
    'ID_SOLICITACAO',
    'COMPETENCIA_ORIGINAL',
    'COMPETENCIA_FATURAMENTO',
    'DATA_OPERACIONAL',
    'OPERACAO',
    'TIPO_SOLICITACAO',
    'RESPONSAVEL_CUSTO',
    'FORNECEDOR',
    'VALOR_REAL_SNAPSHOT',
    'DATA_VINCULO',
    'SNAPSHOT_JSON',
  ];

  function execute(payload) {
    const input = payload || {};
    const action = ValidationService.enumValue(
      input.acao || ACTIONS.LIST,
      'Ação do fechamento',
      [ACTIONS.LIST, ACTIONS.METADATA, ACTIONS.CLOSE]
    );

    if (action === ACTIONS.METADATA) return metadata_();
    if (action === ACTIONS.CLOSE) return close_(input);
    return list_(input);
  }

  function metadata_() {
    const values = SheetRepository.readFieldValues(SHEET_SOLICITACOES, 'COMPETENCIA');
    const unique = {};

    values.forEach(function (value) {
      const competence = normalizeCompetence_(value);
      if (competence) unique[competence] = true;
    });

    const current = DateService.competence(new Date());
    if (current) unique[current] = true;

    return {
      competenciaAtual: current,
      competencias: Object.keys(unique).sort().reverse(),
    };
  }

  function list_(input) {
    const competence = requiredCompetence_(input.competencia);
    const rows = SheetRepository.readObjectsByFieldValues(
      SHEET_SOLICITACOES,
      'COMPETENCIA',
      [competence]
    );

    const closeouts = readOptionalObjects_(SHEET_FECHAMENTOS).filter(function (record) {
      return normalizeCompetence_(record.COMPETENCIA_FATURAMENTO) === competence;
    });
    const closeoutMap = {};
    closeouts.forEach(function (record) {
      closeoutMap[groupKey_(competence, record.FORNECEDOR)] = record;
    });

    const items = readOptionalObjects_(SHEET_ITENS);
    const linkedByCloseout = {};
    items.forEach(function (record) {
      const idFechamento = text_(record.ID_FECHAMENTO);
      const idSolicitacao = text_(record.ID_SOLICITACAO);
      if (!idFechamento || !idSolicitacao) return;
      if (!linkedByCloseout[idFechamento]) linkedByCloseout[idFechamento] = {};
      linkedByCloseout[idFechamento][idSolicitacao] = true;
    });

    const groups = {};
    rows.forEach(function (record) {
      const provider = text_(record.FORNECEDOR);
      const displayProvider = provider || 'SEM FORNECEDOR';
      const key = groupKey_(competence, provider || '__SEM_FORNECEDOR__');
      const status = SolicitationStatusService.resolve(record);
      const realValue = numberOrNull_(record.VALOR_REAL);
      const readyStatus = status === SolicitationStatusService.STATUS.ATTENDED ||
        status === SolicitationStatusService.STATUS.WAITING_INVOICE;
      const ready = Boolean(provider && readyStatus && realValue != null);

      if (!groups[key]) {
        groups[key] = {
          competencia: competence,
          fornecedor: displayProvider,
          fornecedorValido: Boolean(provider),
          totalSolicitacoes: 0,
          prontas: 0,
          pendentes: 0,
          semFornecedor: 0,
          semValorReal: 0,
          statusNaoConcluido: 0,
          valorRealAcumulado: 0,
          ids: [],
        };
      }

      const group = groups[key];
      group.totalSolicitacoes += 1;
      group.ids.push(text_(record.ID_SOLICITACAO));
      if (realValue != null) group.valorRealAcumulado += realValue;

      if (ready) group.prontas += 1;
      else group.pendentes += 1;

      if (!provider) group.semFornecedor += 1;
      if (realValue == null) group.semValorReal += 1;
      if (!readyStatus) group.statusNaoConcluido += 1;
    });

    const result = Object.keys(groups).map(function (key) {
      const group = groups[key];
      const closeout = group.fornecedorValido
        ? closeoutMap[groupKey_(competence, group.fornecedor)] || null
        : null;
      const closeoutId = closeout ? text_(closeout.ID_FECHAMENTO) : '';
      const linked = closeoutId ? linkedByCloseout[closeoutId] || {} : {};
      const newAfterClose = closeout
        ? group.ids.filter(function (id) { return id && !linked[id]; }).length
        : 0;

      return {
        competencia: group.competencia,
        fornecedor: group.fornecedor,
        totalSolicitacoes: group.totalSolicitacoes,
        prontas: group.prontas,
        pendentes: group.pendentes,
        valorRealAcumulado: roundMoney_(group.valorRealAcumulado),
        statusFechamento: closeout ? text_(closeout.STATUS_FECHAMENTO) : STATUS.TRACKING,
        idFechamento: closeoutId || null,
        valorFechado: closeout ? numberOrNull_(closeout.VALOR_CONTROLE) : null,
        qtdFechada: closeout ? numberOrNull_(closeout.QTD_SOLICITACOES) : null,
        dataFechamento: closeout ? dateTime_(closeout.DATA_FECHAMENTO) : '',
        resultadoConciliacao: closeout ? text_(closeout.RESULTADO_CONCILIACAO) : '',
        podeFechar: !closeout && group.fornecedorValido && group.totalSolicitacoes > 0 && group.pendentes === 0,
        novasAposFechamento: newAfterClose,
        pendencias: {
          semFornecedor: group.semFornecedor,
          semValorReal: group.semValorReal,
          statusNaoConcluido: group.statusNaoConcluido,
        },
      };
    }).sort(function (left, right) {
      if (left.statusFechamento !== right.statusFechamento) {
        if (left.statusFechamento === STATUS.TRACKING) return -1;
        if (right.statusFechamento === STATUS.TRACKING) return 1;
      }
      return left.fornecedor.localeCompare(right.fornecedor, 'pt-BR');
    });

    const summary = result.reduce(function (acc, group) {
      acc.fornecedores += group.fornecedor === 'SEM FORNECEDOR' ? 0 : 1;
      acc.solicitacoes += group.totalSolicitacoes;
      acc.prontas += group.prontas;
      acc.pendentes += group.pendentes;
      acc.valorReal += group.valorRealAcumulado;
      if (group.statusFechamento === STATUS.WAITING_INVOICE) acc.aguardandoNf += 1;
      if (group.statusFechamento === STATUS.CHECKED) acc.conferidos += 1;
      if (group.statusFechamento === STATUS.CLOSED) acc.encerrados += 1;
      return acc;
    }, {
      fornecedores: 0,
      solicitacoes: 0,
      prontas: 0,
      pendentes: 0,
      valorReal: 0,
      aguardandoNf: 0,
      conferidos: 0,
      encerrados: 0,
    });
    summary.valorReal = roundMoney_(summary.valorReal);

    return {
      competencia: competence,
      resumo: summary,
      grupos: result,
    };
  }

  function close_(input) {
    const competence = requiredCompetence_(input.competencia);
    const provider = ValidationService.requiredText(input.fornecedor, 'Fornecedor');
    const administrativeUser = ValidationService.requiredText(
      input.usuarioAdministrativo,
      'Usuário administrativo'
    );

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw new Error('Não foi possível obter bloqueio para fechar a competência do fornecedor.');
    }

    try {
      const existing = readOptionalObjects_(SHEET_FECHAMENTOS).find(function (record) {
        return normalizeCompetence_(record.COMPETENCIA_FATURAMENTO) === competence &&
          ValidationService.normalizeUpper(record.FORNECEDOR) === ValidationService.normalizeUpper(provider);
      });

      if (existing) {
        ValidationService.fail(
          'Já existe fechamento para ' + provider + ' na competência ' + competence + '.'
        );
      }

      const rows = SheetRepository.readObjectsByFieldValues(
        SHEET_SOLICITACOES,
        'COMPETENCIA',
        [competence]
      ).filter(function (record) {
        return ValidationService.normalizeUpper(record.FORNECEDOR) === ValidationService.normalizeUpper(provider);
      });

      if (!rows.length) {
        ValidationService.fail(
          'Nenhuma solicitação encontrada para ' + provider + ' na competência ' + competence + '.'
        );
      }

      const pending = rows.filter(function (record) {
        const status = SolicitationStatusService.resolve(record);
        const readyStatus = status === SolicitationStatusService.STATUS.ATTENDED ||
          status === SolicitationStatusService.STATUS.WAITING_INVOICE;
        return !readyStatus || numberOrNull_(record.VALOR_REAL) == null;
      });

      if (pending.length) {
        ValidationService.fail(
          'Fechamento bloqueado: existem ' + pending.length +
          ' solicitação(ões) sem conclusão operacional ou valor real.'
        );
      }

      const now = new Date();
      const closeoutId =
        'FEC-' + competence.replace('-', '') + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
      const totalValue = roundMoney_(rows.reduce(function (sum, record) {
        return sum + Number(record.VALOR_REAL || 0);
      }, 0));

      const closeoutSheet = ensureSheet_(SHEET_FECHAMENTOS, CLOSEOUT_HEADERS);
      const itemSheet = ensureSheet_(SHEET_ITENS, ITEM_HEADERS);

      const closeoutRecord = {
        ID_FECHAMENTO: closeoutId,
        COMPETENCIA_FATURAMENTO: competence,
        FORNECEDOR: provider,
        STATUS_FECHAMENTO: STATUS.WAITING_INVOICE,
        QTD_SOLICITACOES: rows.length,
        VALOR_CONTROLE: totalValue,
        DATA_FECHAMENTO: now,
        USUARIO_FECHAMENTO: administrativeUser,
        RESULTADO_CONCILIACAO: '',
        ID_NF: '',
        DATA_ATUALIZACAO: now,
      };

      const closeoutRow = appendRecord_(closeoutSheet, closeoutRecord, ['ID_FECHAMENTO']);
      let itemStartRow = 0;

      try {
        const itemRecords = rows.map(function (record) {
          return {
            ID_FECHAMENTO: closeoutId,
            ID_SOLICITACAO: text_(record.ID_SOLICITACAO),
            COMPETENCIA_ORIGINAL: normalizeCompetence_(record.COMPETENCIA),
            COMPETENCIA_FATURAMENTO: competence,
            DATA_OPERACIONAL: record.DATA_OPERACIONAL,
            OPERACAO: text_(record.OPERACAO),
            TIPO_SOLICITACAO: text_(record.TIPO_SOLICITACAO),
            RESPONSAVEL_CUSTO: text_(record.RESPONSAVEL_CUSTO),
            FORNECEDOR: provider,
            VALOR_REAL_SNAPSHOT: Number(record.VALOR_REAL || 0),
            DATA_VINCULO: now,
            SNAPSHOT_JSON: JSON.stringify(serializableRecord_(record)),
          };
        });
        itemStartRow = appendRecords_(itemSheet, itemRecords, ['ID_FECHAMENTO', 'ID_SOLICITACAO']);
      } catch (error) {
        if (itemStartRow > 0 && itemSheet.getLastRow() >= itemStartRow) {
          itemSheet.deleteRows(itemStartRow, itemSheet.getLastRow() - itemStartRow + 1);
        }
        closeoutSheet.deleteRow(closeoutRow);
        throw error;
      }

      formatMoney_(closeoutSheet, 'VALOR_CONTROLE', closeoutRow, 1);
      formatMoney_(itemSheet, 'VALOR_REAL_SNAPSHOT', itemStartRow, rows.length);

      return {
        idFechamento: closeoutId,
        competencia: competence,
        fornecedor: provider,
        statusFechamento: STATUS.WAITING_INVOICE,
        qtdSolicitacoes: rows.length,
        valorControle: totalValue,
        dataFechamento: dateTime_(now),
      };
    } finally {
      lock.releaseLock();
    }
  }

  function ensureSheet_(sheetName, requiredHeaders) {
    const spreadsheet = SheetRepository.getSpreadsheet();
    let sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, requiredHeaders.length).setValues([requiredHeaders]);
      sheet.getRange(1, 1, 1, requiredHeaders.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
      return sheet;
    }

    SheetRepository.ensureColumns(sheetName, requiredHeaders);
    return sheet;
  }

  function appendRecord_(sheet, record, textFields) {
    return appendRecords_(sheet, [record], textFields);
  }

  function appendRecords_(sheet, records, textFields) {
    if (!records || !records.length) return 0;
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
      .map(function (value) { return String(value || '').trim(); });
    const startRow = sheet.getLastRow() + 1;
    const rows = records.map(function (record) {
      return headers.map(function (header) {
        return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
      });
    });

    (textFields || []).forEach(function (fieldName) {
      const index = headers.indexOf(fieldName);
      if (index >= 0) sheet.getRange(startRow, index + 1, rows.length, 1).setNumberFormat('@');
    });

    sheet.getRange(startRow, 1, rows.length, headers.length).setValues(rows);
    return startRow;
  }

  function formatMoney_(sheet, fieldName, startRow, count) {
    if (!startRow || !count) return;
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getDisplayValues()[0]
      .map(function (value) { return String(value || '').trim(); });
    const index = headers.indexOf(fieldName);
    if (index >= 0) sheet.getRange(startRow, index + 1, count, 1).setNumberFormat('R$ #,##0.00');
  }

  function readOptionalObjects_(sheetName) {
    const spreadsheet = SheetRepository.getSpreadsheet();
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet || sheet.getLastRow() <= 1 || sheet.getLastColumn() <= 0) return [];
    return SheetRepository.readObjects(sheetName);
  }

  function requiredCompetence_(value) {
    const competence = normalizeCompetence_(ValidationService.requiredText(value, 'Competência'));
    if (!competence) ValidationService.fail('Competência inválida. Use o formato AAAA-MM.');
    return competence;
  }

  function normalizeCompetence_(value) {
    if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
      return Utilities.formatDate(value, DateService.TIMEZONE, 'yyyy-MM');
    }
    const text = ValidationService.normalizeText(value || '');
    return /^\d{4}-\d{2}$/.test(text) ? text : '';
  }

  function groupKey_(competence, provider) {
    return competence + '||' + ValidationService.normalizeUpper(provider || '');
  }

  function serializableRecord_(record) {
    return Object.keys(record || {}).reduce(function (result, key) {
      const value = record[key];
      if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
        result[key] = Utilities.formatDate(value, DateService.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
      } else {
        result[key] = value == null ? '' : value;
      }
      return result;
    }, {});
  }

  function text_(value) {
    return ValidationService.normalizeText(value || '');
  }

  function numberOrNull_(value) {
    if (value === '' || value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function roundMoney_(value) {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  function dateTime_(value) {
    if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
      return Utilities.formatDate(value, DateService.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
    }
    return text_(value);
  }

  return {
    ACTIONS,
    STATUS,
    execute,
  };
})();