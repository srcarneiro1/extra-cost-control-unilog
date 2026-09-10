const SolicitationDeletionService = (() => {
  const SHEET_SOLICITACOES = 'SOLICITACOES';
  const SHEET_EXCECOES = 'EXCECOES_JORNADA_MO';
  const SHEET_AUDITORIA = 'AUDITORIA_SOLICITACOES';
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

  function remove(payload) {
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
      input.motivoExclusao,
      'Motivo da exclusão'
    );

    if (reason.length < 5) {
      ValidationService.fail('Informe um motivo de exclusão com pelo menos 5 caracteres.');
    }

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw new Error('Não foi possível obter bloqueio para excluir a solicitação.');
    }

    try {
      const found = SheetRepository.findRowByField(
        SHEET_SOLICITACOES,
        'ID_SOLICITACAO',
        solicitationId
      );

      if (!found) {
        ValidationService.fail('Solicitação não encontrada: ' + solicitationId + '.');
      }

      const spreadsheet = SheetRepository.getSpreadsheet();
      const requestSheet = spreadsheet.getSheetByName(SHEET_SOLICITACOES);
      if (!requestSheet) throw new Error('Aba não encontrada: ' + SHEET_SOLICITACOES);

      const exceptionSnapshot = findRelatedExceptions_(spreadsheet, solicitationId);
      ensureAuditSheet_(spreadsheet);
      appendAudit_(solicitationId, administrativeUser, reason, found.record, exceptionSnapshot.rows);

      if (exceptionSnapshot.sheet) {
        exceptionSnapshot.rowNumbers
          .slice()
          .sort(function (a, b) { return b - a; })
          .forEach(function (rowNumber) {
            exceptionSnapshot.sheet.deleteRow(rowNumber);
          });
      }

      requestSheet.deleteRow(found.rowNumber);
      clearCaches_(solicitationId);

      return {
        idSolicitacao: solicitationId,
        excluida: true,
        excecoesJornadaExcluidas: exceptionSnapshot.rowNumbers.length,
      };
    } finally {
      lock.releaseLock();
    }
  }

  function findRelatedExceptions_(spreadsheet, solicitationId) {
    const sheet = spreadsheet.getSheetByName(SHEET_EXCECOES);
    if (!sheet || sheet.getLastRow() <= 1 || sheet.getLastColumn() <= 0) {
      return { sheet: sheet || null, rowNumbers: [], rows: [] };
    }

    const values = sheet.getDataRange().getValues();
    const headers = values[0].map(function (header) { return String(header || '').trim(); });
    const idIndex = headers.indexOf('ID_SOLICITACAO');
    if (idIndex < 0) {
      return { sheet: sheet, rowNumbers: [], rows: [] };
    }

    const rowNumbers = [];
    const rows = [];
    values.slice(1).forEach(function (row, index) {
      if (String(row[idIndex] == null ? '' : row[idIndex]).trim() !== solicitationId) return;
      rowNumbers.push(index + 2);
      rows.push(headers.reduce(function (record, header, columnIndex) {
        if (header) record[header] = serializable_(row[columnIndex]);
        return record;
      }, {}));
    });

    return { sheet: sheet, rowNumbers: rowNumbers, rows: rows };
  }

  function ensureAuditSheet_(spreadsheet) {
    let sheet = spreadsheet.getSheetByName(SHEET_AUDITORIA);
    if (sheet) return sheet;

    sheet = spreadsheet.insertSheet(SHEET_AUDITORIA);
    sheet.getRange(1, 1, 1, AUDIT_HEADERS.length).setValues([AUDIT_HEADERS]);
    sheet.getRange(1, 1, 1, AUDIT_HEADERS.length).setFontWeight('bold');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, AUDIT_HEADERS.length);
    return sheet;
  }

  function appendAudit_(solicitationId, administrativeUser, reason, record, exceptionRows) {
    const before = {
      solicitacao: snapshot_(record),
      excecoesJornada: exceptionRows || [],
    };

    SheetRepository.appendObject(
      SHEET_AUDITORIA,
      {
        ID_AUDITORIA: 'AUD-' + Utilities.getUuid(),
        ID_SOLICITACAO: solicitationId,
        DATA_ALTERACAO: new Date(),
        USUARIO_ADMINISTRATIVO: administrativeUser,
        MOTIVO_CORRECAO: reason,
        CAMPOS_ALTERADOS: 'EXCLUSAO_REGISTRO',
        ANTES_JSON: JSON.stringify(before),
        DEPOIS_JSON: JSON.stringify({ excluida: true }),
      },
      { textFields: ['ID_AUDITORIA', 'ID_SOLICITACAO'] }
    );
  }

  function snapshot_(record) {
    return Object.keys(record || {}).reduce(function (result, fieldName) {
      result[fieldName] = serializable_(record[fieldName]);
      return result;
    }, {});
  }

  function serializable_(value) {
    if (
      Object.prototype.toString.call(value) === '[object Date]' &&
      !Number.isNaN(value.getTime())
    ) {
      return Utilities.formatDate(value, DateService.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
    }
    return value == null ? '' : value;
  }

  function clearCaches_(solicitationId) {
    try {
      const cache = CacheService.getScriptCache();
      cache.remove('admin_solicitations_metadata_v2');
      cache.remove('admin_solicitations_list_v1_100');
      cache.remove('admin_solicitations_list_v1_500');
      cache.remove('partial_shift_rows_v1_' + solicitationId);
    } catch (error) {
      // Cache é apenas otimização; falha não invalida a exclusão persistida.
    }
  }

  return {
    remove,
  };
})();
