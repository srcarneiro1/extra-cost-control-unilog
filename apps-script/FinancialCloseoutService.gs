const FinancialCloseoutService = (() => {
  const SHEET_SOLICITACOES = 'SOLICITACOES';
  const SHEET_FECHAMENTOS = 'FECHAMENTOS';
  const SHEET_ITENS = 'FECHAMENTO_SOLICITACOES';
  const SHEET_NOTAS = 'NOTAS_FISCAIS';

  const ACTIONS = Object.freeze({
    LIST: 'LISTAR',
    METADATA: 'METADADOS',
    CLOSE: 'FECHAR',
    SAVE_INVOICE: 'SALVAR_NF',
    RECONCILE: 'CONCILIAR',
    COMPLETE: 'ENCERRAR',
  });

  const STATUS = Object.freeze({
    TRACKING: 'EM_ACOMPANHAMENTO',
    WAITING_INVOICE: 'AGUARDANDO_NF',
    CHECKED: 'CONFERIDA',
    CLOSED: 'ENCERRADA',
  });

  const RECONCILIATION = Object.freeze({
    OK: 'OK',
    ADJUSTED: 'COM_AJUSTE',
    DIVERGENT: 'COM_DIVERGENCIA',
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
    'DATA_ENCERRAMENTO',
    'USUARIO_ENCERRAMENTO',
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

  const INVOICE_HEADERS = [
    'ID_NF',
    'ID_FECHAMENTO',
    'COMPETENCIA_FATURAMENTO',
    'FORNECEDOR',
    'NUMERO_NF',
    'DATA_EMISSAO',
    'DATA_RECEBIMENTO',
    'VALOR_NF',
    'VALOR_CONTROLE',
    'DIFERENCA_VALOR',
    'RESULTADO_CONCILIACAO',
    'VALOR_AJUSTE',
    'VALOR_CONCILIADO',
    'OBSERVACAO_CONCILIACAO',
    'DATA_REGISTRO',
    'USUARIO_REGISTRO',
    'DATA_CONFERENCIA',
    'USUARIO_CONFERENCIA',
    'DATA_ATUALIZACAO',
  ];

  function execute(payload) {
    const input = payload || {};
    const action = ValidationService.enumValue(
      input.acao || ACTIONS.LIST,
      'Ação do fechamento',
      [
        ACTIONS.LIST,
        ACTIONS.METADATA,
        ACTIONS.CLOSE,
        ACTIONS.SAVE_INVOICE,
        ACTIONS.RECONCILE,
        ACTIONS.COMPLETE,
      ]
    );

    if (action === ACTIONS.METADATA) return metadata_();
    if (action === ACTIONS.CLOSE) return close_(input);
    if (action === ACTIONS.SAVE_INVOICE) return saveInvoice_(input);
    if (action === ACTIONS.RECONCILE) return reconcile_(input);
    if (action === ACTIONS.COMPLETE) return complete_(input);
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

    const invoices = readOptionalObjects_(SHEET_NOTAS);
    const invoiceByCloseout = {};
    invoices.forEach(function (record) {
      const idFechamento = text_(record.ID_FECHAMENTO);
      if (idFechamento) invoiceByCloseout[idFechamento] = record;
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
      const invoice = closeoutId ? invoiceByCloseout[closeoutId] || null : null;
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
        dataEncerramento: closeout ? dateTime_(closeout.DATA_ENCERRAMENTO) : '',
        resultadoConciliacao: closeout ? text_(closeout.RESULTADO_CONCILIACAO) : '',
        notaFiscal: invoice ? invoiceView_(invoice) : null,
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
      if (group.notaFiscal) acc.notasRegistradas += 1;
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
      notasRegistradas: 0,
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
    const administrativeUser = administrativeUser_(input);

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw new Error('Não foi possível obter bloqueio para fechar a competência do fornecedor.');
    }

    try {
      ensureSheet_(SHEET_FECHAMENTOS, CLOSEOUT_HEADERS);
      ensureSheet_(SHEET_ITENS, ITEM_HEADERS);

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
        DATA_ENCERRAMENTO: '',
        USUARIO_ENCERRAMENTO: '',
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

  function saveInvoice_(input) {
    const closeoutId = ValidationService.requiredText(input.idFechamento, 'Fechamento');
    const administrativeUser = administrativeUser_(input);
    const invoiceNumber = ValidationService.requiredText(input.numeroNf, 'Número da NF');
    const issueDate = requiredDate_(input.dataEmissao, 'Data de emissão');
    const receiptDate = requiredDate_(input.dataRecebimento, 'Data de recebimento');
    const invoiceValue = requiredMoney_(input.valorNf, 'Valor da NF', true);

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw new Error('Não foi possível obter bloqueio para registrar a nota fiscal.');
    }

    try {
      const closeoutSheet = ensureSheet_(SHEET_FECHAMENTOS, CLOSEOUT_HEADERS);
      const invoiceSheet = ensureSheet_(SHEET_NOTAS, INVOICE_HEADERS);
      const closeout = requiredCloseout_(closeoutId);
      const closeoutStatus = text_(closeout.record.STATUS_FECHAMENTO);

      if (closeoutStatus !== STATUS.WAITING_INVOICE) {
        ValidationService.fail('A NF só pode ser registrada enquanto o fechamento estiver aguardando NF.');
      }

      const existing = SheetRepository.findRowByField(SHEET_NOTAS, 'ID_FECHAMENTO', closeoutId);
      const now = new Date();
      const controlValue = requiredMoney_(closeout.record.VALOR_CONTROLE, 'Valor do controle', false);
      const difference = roundMoney_(invoiceValue - controlValue);
      const invoiceId = existing
        ? text_(existing.record.ID_NF)
        : 'NF-' + Utilities.getUuid().slice(0, 12).toUpperCase();

      const record = {
        ID_NF: invoiceId,
        ID_FECHAMENTO: closeoutId,
        COMPETENCIA_FATURAMENTO: normalizeCompetence_(closeout.record.COMPETENCIA_FATURAMENTO),
        FORNECEDOR: text_(closeout.record.FORNECEDOR),
        NUMERO_NF: invoiceNumber,
        DATA_EMISSAO: issueDate,
        DATA_RECEBIMENTO: receiptDate,
        VALOR_NF: invoiceValue,
        VALOR_CONTROLE: controlValue,
        DIFERENCA_VALOR: difference,
        RESULTADO_CONCILIACAO: '',
        VALOR_AJUSTE: '',
        VALOR_CONCILIADO: '',
        OBSERVACAO_CONCILIACAO: '',
        DATA_REGISTRO: existing ? existing.record.DATA_REGISTRO : now,
        USUARIO_REGISTRO: existing ? text_(existing.record.USUARIO_REGISTRO) : administrativeUser,
        DATA_CONFERENCIA: '',
        USUARIO_CONFERENCIA: '',
        DATA_ATUALIZACAO: now,
      };

      let invoiceRow;
      if (existing) {
        invoiceRow = existing.rowNumber;
        SheetRepository.updateFields(
          SHEET_NOTAS,
          invoiceRow,
          record,
          { textFields: ['ID_NF', 'ID_FECHAMENTO', 'NUMERO_NF'] }
        );
      } else {
        invoiceRow = appendRecord_(
          invoiceSheet,
          record,
          ['ID_NF', 'ID_FECHAMENTO', 'NUMERO_NF']
        );
      }

      ['VALOR_NF', 'VALOR_CONTROLE', 'DIFERENCA_VALOR', 'VALOR_AJUSTE', 'VALOR_CONCILIADO']
        .forEach(function (fieldName) {
          formatMoney_(invoiceSheet, fieldName, invoiceRow, 1);
        });

      SheetRepository.updateFields(
        SHEET_FECHAMENTOS,
        closeout.rowNumber,
        {
          ID_NF: invoiceId,
          RESULTADO_CONCILIACAO: '',
          DATA_ATUALIZACAO: now,
        },
        { textFields: ['ID_NF'] }
      );
      formatMoney_(closeoutSheet, 'VALOR_CONTROLE', closeout.rowNumber, 1);

      return {
        idFechamento: closeoutId,
        statusFechamento: STATUS.WAITING_INVOICE,
        notaFiscal: invoiceView_(record),
      };
    } finally {
      lock.releaseLock();
    }
  }

  function reconcile_(input) {
    const closeoutId = ValidationService.requiredText(input.idFechamento, 'Fechamento');
    const administrativeUser = administrativeUser_(input);
    const result = ValidationService.enumValue(
      input.resultadoConciliacao,
      'Resultado da conciliação',
      [RECONCILIATION.OK, RECONCILIATION.ADJUSTED, RECONCILIATION.DIVERGENT]
    );

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw new Error('Não foi possível obter bloqueio para conferir a nota fiscal.');
    }

    try {
      ensureSheet_(SHEET_FECHAMENTOS, CLOSEOUT_HEADERS);
      const invoiceSheet = ensureSheet_(SHEET_NOTAS, INVOICE_HEADERS);
      const closeout = requiredCloseout_(closeoutId);

      if (text_(closeout.record.STATUS_FECHAMENTO) !== STATUS.WAITING_INVOICE) {
        ValidationService.fail('Somente fechamentos aguardando NF podem ser conferidos.');
      }

      const invoice = SheetRepository.findRowByField(SHEET_NOTAS, 'ID_FECHAMENTO', closeoutId);
      if (!invoice) {
        ValidationService.fail('Registre a NF antes de concluir a conferência.');
      }

      const controlValue = requiredMoney_(closeout.record.VALOR_CONTROLE, 'Valor do controle', false);
      const invoiceValue = requiredMoney_(invoice.record.VALOR_NF, 'Valor da NF', true);
      const difference = roundMoney_(invoiceValue - controlValue);
      const observation = text_(input.observacaoConciliacao);
      let adjustment = 0;
      let reconciledValue = controlValue;

      if (result === RECONCILIATION.OK) {
        if (Math.abs(difference) > 0.009) {
          ValidationService.fail(
            'O resultado OK exige que o valor da NF seja igual ao valor do controle. Diferença atual: ' + difference + '.'
          );
        }
      } else if (result === RECONCILIATION.ADJUSTED) {
        if (!observation) {
          ValidationService.fail('Informe o motivo/observação do ajuste.');
        }
        adjustment = requiredMoney_(input.valorAjuste, 'Valor do ajuste', false);
        reconciledValue = roundMoney_(controlValue + adjustment);
        if (Math.abs(reconciledValue - invoiceValue) > 0.009) {
          ValidationService.fail(
            'O valor do controle somado ao ajuste precisa resultar no valor da NF.'
          );
        }
      } else if (!observation) {
        ValidationService.fail('Informe a divergência identificada na conciliação.');
      }

      const now = new Date();
      SheetRepository.updateFields(
        SHEET_NOTAS,
        invoice.rowNumber,
        {
          DIFERENCA_VALOR: difference,
          RESULTADO_CONCILIACAO: result,
          VALOR_AJUSTE: adjustment,
          VALOR_CONCILIADO: reconciledValue,
          OBSERVACAO_CONCILIACAO: observation,
          DATA_CONFERENCIA: now,
          USUARIO_CONFERENCIA: administrativeUser,
          DATA_ATUALIZACAO: now,
        }
      );
      ['VALOR_NF', 'VALOR_CONTROLE', 'DIFERENCA_VALOR', 'VALOR_AJUSTE', 'VALOR_CONCILIADO']
        .forEach(function (fieldName) {
          formatMoney_(invoiceSheet, fieldName, invoice.rowNumber, 1);
        });

      SheetRepository.updateFields(
        SHEET_FECHAMENTOS,
        closeout.rowNumber,
        {
          STATUS_FECHAMENTO: STATUS.CHECKED,
          RESULTADO_CONCILIACAO: result,
          ID_NF: text_(invoice.record.ID_NF),
          DATA_ATUALIZACAO: now,
        },
        { textFields: ['ID_NF'] }
      );

      const updatedInvoice = Object.assign({}, invoice.record, {
        DIFERENCA_VALOR: difference,
        RESULTADO_CONCILIACAO: result,
        VALOR_AJUSTE: adjustment,
        VALOR_CONCILIADO: reconciledValue,
        OBSERVACAO_CONCILIACAO: observation,
        DATA_CONFERENCIA: now,
        USUARIO_CONFERENCIA: administrativeUser,
        DATA_ATUALIZACAO: now,
      });

      return {
        idFechamento: closeoutId,
        statusFechamento: STATUS.CHECKED,
        resultadoConciliacao: result,
        notaFiscal: invoiceView_(updatedInvoice),
      };
    } finally {
      lock.releaseLock();
    }
  }

  function complete_(input) {
    const closeoutId = ValidationService.requiredText(input.idFechamento, 'Fechamento');
    const administrativeUser = administrativeUser_(input);

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw new Error('Não foi possível obter bloqueio para encerrar o fechamento.');
    }

    try {
      ensureSheet_(SHEET_FECHAMENTOS, CLOSEOUT_HEADERS);
      const closeout = requiredCloseout_(closeoutId);

      if (text_(closeout.record.STATUS_FECHAMENTO) !== STATUS.CHECKED) {
        ValidationService.fail('Somente fechamentos conferidos podem ser encerrados.');
      }

      if (!text_(closeout.record.RESULTADO_CONCILIACAO) || !text_(closeout.record.ID_NF)) {
        ValidationService.fail('O fechamento precisa possuir NF e resultado de conciliação antes do encerramento.');
      }

      const now = new Date();
      SheetRepository.updateFields(
        SHEET_FECHAMENTOS,
        closeout.rowNumber,
        {
          STATUS_FECHAMENTO: STATUS.CLOSED,
          DATA_ENCERRAMENTO: now,
          USUARIO_ENCERRAMENTO: administrativeUser,
          DATA_ATUALIZACAO: now,
        }
      );

      return {
        idFechamento: closeoutId,
        statusFechamento: STATUS.CLOSED,
        dataEncerramento: dateTime_(now),
      };
    } finally {
      lock.releaseLock();
    }
  }

  function requiredCloseout_(closeoutId) {
    const found = SheetRepository.findRowByField(SHEET_FECHAMENTOS, 'ID_FECHAMENTO', closeoutId);
    if (!found) ValidationService.fail('Fechamento não encontrado: ' + closeoutId + '.');
    return found;
  }

  function invoiceView_(record) {
    return {
      idNf: text_(record.ID_NF),
      idFechamento: text_(record.ID_FECHAMENTO),
      numeroNf: text_(record.NUMERO_NF),
      dataEmissao: dateOnly_(record.DATA_EMISSAO),
      dataRecebimento: dateOnly_(record.DATA_RECEBIMENTO),
      valorNf: numberOrNull_(record.VALOR_NF),
      valorControle: numberOrNull_(record.VALOR_CONTROLE),
      diferencaValor: numberOrNull_(record.DIFERENCA_VALOR),
      resultadoConciliacao: text_(record.RESULTADO_CONCILIACAO),
      valorAjuste: numberOrNull_(record.VALOR_AJUSTE),
      valorConciliado: numberOrNull_(record.VALOR_CONCILIADO),
      observacaoConciliacao: text_(record.OBSERVACAO_CONCILIACAO),
      dataRegistro: dateTime_(record.DATA_REGISTRO),
      usuarioRegistro: text_(record.USUARIO_REGISTRO),
      dataConferencia: dateTime_(record.DATA_CONFERENCIA),
      usuarioConferencia: text_(record.USUARIO_CONFERENCIA),
    };
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

  function administrativeUser_(input) {
    return ValidationService.requiredText(
      input.usuarioAdministrativo,
      'Usuário administrativo'
    );
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
    const normalized = ValidationService.normalizeText(value || '');
    return /^\d{4}-\d{2}$/.test(normalized) ? normalized : '';
  }

  function groupKey_(competence, provider) {
    return competence + '||' + ValidationService.normalizeUpper(provider || '');
  }

  function requiredMoney_(value, label, positiveOnly) {
    if (value === '' || value == null) {
      ValidationService.fail(label + ' é obrigatório.');
    }
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || (positiveOnly ? parsed <= 0 : false)) {
      ValidationService.fail(label + (positiveOnly ? ' deve ser maior que zero.' : ' deve ser um número válido.'));
    }
    return roundMoney_(parsed);
  }

  function requiredDate_(value, label) {
    const normalized = ValidationService.requiredText(value, label);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(normalized);
    if (!match) ValidationService.fail(label + ' inválida. Use o formato AAAA-MM-DD.');

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      ValidationService.fail(label + ' inválida.');
    }
    return date;
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

  function dateOnly_(value) {
    if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
      return Utilities.formatDate(value, DateService.TIMEZONE, 'yyyy-MM-dd');
    }
    const normalized = text_(value);
    return /^\d{4}-\d{2}-\d{2}/.test(normalized) ? normalized.slice(0, 10) : normalized;
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
    RECONCILIATION,
    execute,
  };
})();