const FinancialCloseoutPhase2CService = (() => {
  const SHEET_SOLICITACOES = 'SOLICITACOES';
  const SHEET_FECHAMENTOS = 'FECHAMENTOS';
  const SHEET_ITENS = 'FECHAMENTO_SOLICITACOES';
  const SHEET_DESTINOS = 'DESTINOS_FINANCEIROS_SOLICITACOES';
  const DESTINO_RECLASSIFICADO = 'RECLASSIFICAR_PROXIMA_COMPETENCIA';

  const CLOSEOUT_HEADERS = [
    'ID_FECHAMENTO', 'COMPETENCIA_FATURAMENTO', 'FORNECEDOR', 'STATUS_FECHAMENTO',
    'QTD_SOLICITACOES', 'VALOR_CONTROLE', 'DATA_FECHAMENTO', 'USUARIO_FECHAMENTO',
    'RESULTADO_CONCILIACAO', 'ID_NF', 'DATA_ENCERRAMENTO', 'USUARIO_ENCERRAMENTO',
    'DATA_ATUALIZACAO',
  ];

  const ITEM_HEADERS = [
    'ID_FECHAMENTO', 'ID_SOLICITACAO', 'COMPETENCIA_ORIGINAL', 'COMPETENCIA_FATURAMENTO',
    'DATA_OPERACIONAL', 'OPERACAO', 'TIPO_SOLICITACAO', 'RESPONSAVEL_CUSTO', 'FORNECEDOR',
    'VALOR_REAL_SNAPSHOT', 'DATA_VINCULO', 'SNAPSHOT_JSON',
  ];

  function execute(payload) {
    const input = payload || {};
    const action = ValidationService.normalizeUpper(input.acao || FinancialCloseoutService.ACTIONS.LIST);
    if (action === FinancialCloseoutService.ACTIONS.METADATA) return metadata_();
    if (action === FinancialCloseoutService.ACTIONS.LIST) return list_(input);
    if (action === FinancialCloseoutService.ACTIONS.CLOSE) return close_(input);
    return FinancialCloseoutService.execute(input);
  }

  function metadata_() {
    const base = FinancialCloseoutService.execute({ acao: FinancialCloseoutService.ACTIONS.METADATA });
    const unique = {};
    (base.competencias || []).forEach(function (value) { if (value) unique[value] = true; });
    readOptionalObjects_(SHEET_DESTINOS).forEach(function (record) {
      if (text_(record.DESTINO_FINANCEIRO) !== DESTINO_RECLASSIFICADO) return;
      const competence = normalizeCompetence_(record.COMPETENCIA_FATURAMENTO);
      if (competence) unique[competence] = true;
    });
    return {
      competenciaAtual: base.competenciaAtual,
      competencias: Object.keys(unique).sort().reverse(),
    };
  }

  function list_(input) {
    const competence = requiredCompetence_(input.competencia);
    const base = FinancialCloseoutService.execute({
      acao: FinancialCloseoutService.ACTIONS.LIST,
      competencia: competence,
    });
    const groups = (base.grupos || []).map(function (group) { return Object.assign({}, group); });
    const byProvider = {};
    groups.forEach(function (group) { byProvider[text_(group.fornecedor)] = group; });

    const reclassified = destinationSolicitations_(competence);
    reclassified.forEach(function (entry) {
      const provider = text_(entry.record.FORNECEDOR);
      if (!provider) return;
      let group = byProvider[provider];
      if (!group) {
        group = {
          competencia: competence,
          fornecedor: provider,
          totalSolicitacoes: 0,
          prontas: 0,
          pendentes: 0,
          valorRealAcumulado: 0,
          statusFechamento: 'EM_ACOMPANHAMENTO',
          idFechamento: null,
          valorFechado: null,
          qtdFechada: null,
          dataFechamento: '',
          dataEncerramento: '',
          resultadoConciliacao: '',
          notaFiscal: null,
          podeFechar: true,
          novasAposFechamento: 0,
          pendencias: { semFornecedor: 0, semValorReal: 0, statusNaoConcluido: 0 },
        };
        groups.push(group);
        byProvider[provider] = group;
      }

      const status = SolicitationStatusService.resolve(entry.record);
      const value = numberOrNull_(entry.record.VALOR_REAL);
      const readyStatus = status === SolicitationStatusService.STATUS.ATTENDED ||
        status === SolicitationStatusService.STATUS.WAITING_INVOICE;
      const ready = readyStatus && value != null;

      group.totalSolicitacoes += 1;
      if (ready) group.prontas += 1;
      else group.pendentes += 1;
      if (value != null) group.valorRealAcumulado = roundMoney_(group.valorRealAcumulado + value);
      if (value == null) group.pendencias.semValorReal += 1;
      if (!readyStatus) group.pendencias.statusNaoConcluido += 1;
      group.podeFechar = !group.idFechamento && group.totalSolicitacoes > 0 && group.pendentes === 0;
    });

    const unresolved = FinancialExceptionService.execute({
      acao: FinancialExceptionService.ACTIONS.LIST,
      competencia: competence,
    });
    const unresolvedByProvider = {};
    (unresolved.itens || []).forEach(function (item) {
      const provider = text_(item.fornecedor);
      unresolvedByProvider[provider] = (unresolvedByProvider[provider] || 0) + 1;
    });
    groups.forEach(function (group) {
      if (group.idFechamento) group.novasAposFechamento = unresolvedByProvider[text_(group.fornecedor)] || 0;
    });

    groups.sort(function (left, right) {
      if (left.statusFechamento !== right.statusFechamento) {
        if (left.statusFechamento === 'EM_ACOMPANHAMENTO') return -1;
        if (right.statusFechamento === 'EM_ACOMPANHAMENTO') return 1;
      }
      return text_(left.fornecedor).localeCompare(text_(right.fornecedor), 'pt-BR');
    });

    const summary = groups.reduce(function (acc, group) {
      acc.fornecedores += group.fornecedor === 'SEM FORNECEDOR' ? 0 : 1;
      acc.solicitacoes += Number(group.totalSolicitacoes || 0);
      acc.prontas += Number(group.prontas || 0);
      acc.pendentes += Number(group.pendentes || 0);
      acc.valorReal += Number(group.valorRealAcumulado || 0);
      if (group.notaFiscal) acc.notasRegistradas += 1;
      if (group.statusFechamento === 'AGUARDANDO_NF') acc.aguardandoNf += 1;
      if (group.statusFechamento === 'CONFERIDA') acc.conferidos += 1;
      if (group.statusFechamento === 'ENCERRADA') acc.encerrados += 1;
      return acc;
    }, {
      fornecedores: 0, solicitacoes: 0, prontas: 0, pendentes: 0, valorReal: 0,
      notasRegistradas: 0, aguardandoNf: 0, conferidos: 0, encerrados: 0,
    });
    summary.valorReal = roundMoney_(summary.valorReal);

    return { competencia: competence, resumo: summary, grupos: groups };
  }

  function close_(input) {
    const competence = requiredCompetence_(input.competencia);
    const provider = ValidationService.requiredText(input.fornecedor, 'Fornecedor');
    const administrativeUser = ValidationService.requiredText(input.usuarioAdministrativo, 'Usuário administrativo');

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) throw new Error('Não foi possível obter bloqueio para fechar a competência do fornecedor.');

    try {
      ensureSheet_(SHEET_FECHAMENTOS, CLOSEOUT_HEADERS);
      ensureSheet_(SHEET_ITENS, ITEM_HEADERS);

      const existing = readOptionalObjects_(SHEET_FECHAMENTOS).find(function (record) {
        return normalizeCompetence_(record.COMPETENCIA_FATURAMENTO) === competence &&
          ValidationService.normalizeUpper(record.FORNECEDOR) === ValidationService.normalizeUpper(provider);
      });
      if (existing) ValidationService.fail('Já existe fechamento para ' + provider + ' na competência ' + competence + '.');

      const rows = SheetRepository.readObjectsByFieldValues(SHEET_SOLICITACOES, 'COMPETENCIA', [competence])
        .filter(function (record) {
          return ValidationService.normalizeUpper(record.FORNECEDOR) === ValidationService.normalizeUpper(provider);
        });

      destinationSolicitations_(competence).forEach(function (entry) {
        if (ValidationService.normalizeUpper(entry.record.FORNECEDOR) !== ValidationService.normalizeUpper(provider)) return;
        const id = text_(entry.record.ID_SOLICITACAO);
        if (!rows.some(function (row) { return text_(row.ID_SOLICITACAO) === id; })) rows.push(entry.record);
      });

      if (!rows.length) ValidationService.fail('Nenhuma solicitação encontrada para ' + provider + ' na competência ' + competence + '.');

      const pending = rows.filter(function (record) {
        const status = SolicitationStatusService.resolve(record);
        const readyStatus = status === SolicitationStatusService.STATUS.ATTENDED ||
          status === SolicitationStatusService.STATUS.WAITING_INVOICE;
        return !readyStatus || numberOrNull_(record.VALOR_REAL) == null;
      });
      if (pending.length) {
        ValidationService.fail('Fechamento bloqueado: existem ' + pending.length + ' solicitação(ões) sem conclusão operacional ou valor real.');
      }

      const now = new Date();
      const closeoutId = 'FEC-' + competence.replace('-', '') + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
      const totalValue = roundMoney_(rows.reduce(function (sum, record) { return sum + Number(record.VALOR_REAL || 0); }, 0));
      const closeoutSheet = ensureSheet_(SHEET_FECHAMENTOS, CLOSEOUT_HEADERS);
      const itemSheet = ensureSheet_(SHEET_ITENS, ITEM_HEADERS);

      const closeoutRecord = {
        ID_FECHAMENTO: closeoutId,
        COMPETENCIA_FATURAMENTO: competence,
        FORNECEDOR: provider,
        STATUS_FECHAMENTO: 'AGUARDANDO_NF',
        QTD_SOLICITACOES: rows.length,
        VALOR_CONTROLE: totalValue,
        DATA_FECHAMENTO: now,
        USUARIO_FECHAMENTO: administrativeUser,
        RESULTADO_CONCILIACAO: '', ID_NF: '', DATA_ENCERRAMENTO: '', USUARIO_ENCERRAMENTO: '',
        DATA_ATUALIZACAO: now,
      };

      const closeoutRow = SheetRepository.appendObject(SHEET_FECHAMENTOS, closeoutRecord, { textFields: ['ID_FECHAMENTO'] });
      const itemStartRow = itemSheet.getLastRow() + 1;

      try {
        rows.forEach(function (record) {
          SheetRepository.appendObject(SHEET_ITENS, {
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
          }, { textFields: ['ID_FECHAMENTO', 'ID_SOLICITACAO', 'COMPETENCIA_ORIGINAL', 'COMPETENCIA_FATURAMENTO'] });
        });
      } catch (error) {
        const appended = itemSheet.getLastRow() - itemStartRow + 1;
        if (appended > 0) itemSheet.deleteRows(itemStartRow, appended);
        closeoutSheet.deleteRow(closeoutRow);
        throw error;
      }

      formatMoney_(closeoutSheet, 'VALOR_CONTROLE', closeoutRow, 1);
      formatMoney_(itemSheet, 'VALOR_REAL_SNAPSHOT', itemStartRow, rows.length);

      return {
        idFechamento: closeoutId,
        competencia: competence,
        fornecedor: provider,
        statusFechamento: 'AGUARDANDO_NF',
        qtdSolicitacoes: rows.length,
        valorControle: totalValue,
        dataFechamento: dateTime_(now),
      };
    } finally {
      lock.releaseLock();
    }
  }

  function destinationSolicitations_(competence) {
    const result = [];
    readOptionalObjects_(SHEET_DESTINOS).forEach(function (destination) {
      if (text_(destination.DESTINO_FINANCEIRO) !== DESTINO_RECLASSIFICADO) return;
      if (normalizeCompetence_(destination.COMPETENCIA_FATURAMENTO) !== competence) return;
      const id = text_(destination.ID_SOLICITACAO);
      if (!id) return;
      const match = SheetRepository.findRowByField(SHEET_SOLICITACOES, 'ID_SOLICITACAO', id);
      if (match) result.push({ destination: destination, record: match.record });
    });
    return result;
  }

  function ensureSheet_(sheetName, headers) {
    const spreadsheet = SheetRepository.getSpreadsheet();
    let sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(sheetName);
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      sheet.setFrozenRows(1);
      return sheet;
    }
    SheetRepository.ensureColumns(sheetName, headers);
    return sheet;
  }

  function readOptionalObjects_(sheetName) {
    const spreadsheet = SheetRepository.getSpreadsheet();
    if (!spreadsheet.getSheetByName(sheetName)) return [];
    return SheetRepository.readObjects(sheetName);
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

  function text_(value) { return String(value == null ? '' : value).trim(); }

  function numberOrNull_(value) {
    if (value === '' || value == null) return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function roundMoney_(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }

  function dateTime_(value) {
    if (!value) return '';
    const date = Object.prototype.toString.call(value) === '[object Date]' ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return text_(value);
    return Utilities.formatDate(date, DateService.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
  }

  function serializableRecord_(record) {
    const result = {};
    Object.keys(record || {}).forEach(function (key) {
      const value = record[key];
      result[key] = Object.prototype.toString.call(value) === '[object Date]'
        ? Utilities.formatDate(value, DateService.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss")
        : value;
    });
    return result;
  }

  function formatMoney_(sheet, fieldName, startRow, count) {
    if (!sheet || !startRow || !count) return;
    const lastColumn = sheet.getLastColumn();
    const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
      .map(function (value) { return String(value || '').trim(); });
    const index = headers.indexOf(fieldName);
    if (index >= 0) sheet.getRange(startRow, index + 1, count, 1).setNumberFormat('R$ #,##0.00');
  }

  return { execute };
})();
