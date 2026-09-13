const SolicitationStatusService = (() => {
  const SHEET_SOLICITACOES = 'SOLICITACOES';
  const SHEET_AUDITORIA = 'AUDITORIA_SOLICITACOES';

  const STATUS = Object.freeze({
    DRAFT: 'RASCUNHO',
    SENT: 'ENVIADA',
    TRIAGE: 'EM_TRIAGEM',
    ADJUSTMENT: 'AGUARDANDO_AJUSTE',
    SUPPLIER_SENT: 'ENVIADA_AO_FORNECEDOR',
    IN_SERVICE: 'EM_ATENDIMENTO',
    ATTENDED: 'ATENDIDA',
    WAITING_INVOICE: 'AGUARDANDO_NF',
    CHECKED: 'CONFERIDA',
    CLOSED: 'ENCERRADA',
  });

  const ACTIVE_OPERATIONAL_STATUSES = [
    STATUS.DRAFT,
    STATUS.SENT,
    STATUS.TRIAGE,
    STATUS.ADJUSTMENT,
    STATUS.SUPPLIER_SENT,
    STATUS.IN_SERVICE,
    STATUS.ATTENDED,
  ];

  const ALL_STATUSES = ACTIVE_OPERATIONAL_STATUSES.concat([
    STATUS.WAITING_INVOICE,
    STATUS.CHECKED,
    STATUS.CLOSED,
  ]);

  const TRANSITIONS = Object.freeze({
    RASCUNHO: ['ENVIADA'],
    ENVIADA: ['EM_TRIAGEM'],
    EM_TRIAGEM: ['AGUARDANDO_AJUSTE', 'ENVIADA_AO_FORNECEDOR'],
    AGUARDANDO_AJUSTE: ['EM_TRIAGEM'],
    ENVIADA_AO_FORNECEDOR: ['EM_ATENDIMENTO', 'ATENDIDA'],
    EM_ATENDIMENTO: ['ATENDIDA'],
    ATENDIDA: [],
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

  function ensureSchema() {
    return SheetRepository.ensureColumns(SHEET_SOLICITACOES, ['STATUS']);
  }

  function resolve(record) {
    const current = normalizeStatus_(record && record.STATUS);
    return current || inferLegacy_(record || {});
  }

  function afterTriage(record) {
    const current = resolve(record);
    if (current === STATUS.SENT || current === STATUS.ADJUSTMENT) return STATUS.TRIAGE;
    return current;
  }

  function attended() {
    return STATUS.ATTENDED;
  }

  function transition(payload) {
    const input = payload || {};
    const solicitationId = ValidationService.requiredText(input.idSolicitacao, 'ID da solicitação');
    const administrativeUser = ValidationService.requiredText(input.usuarioAdministrativo, 'Usuário administrativo');
    const target = ValidationService.enumValue(
      input.status,
      'Status',
      ACTIVE_OPERATIONAL_STATUSES
    );

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw new Error('Não foi possível obter bloqueio para alterar o status da solicitação.');
    }

    try {
      ensureSchema();

      const found = SheetRepository.findRowByField(
        SHEET_SOLICITACOES,
        'ID_SOLICITACAO',
        solicitationId
      );

      if (!found) {
        ValidationService.fail('Solicitação não encontrada: ' + solicitationId + '.');
      }

      return applyWithinLock({
        found: found,
        target: target,
        usuarioAdministrativo: administrativeUser,
        motivo: ValidationService.normalizeText(input.motivo || ''),
      });
    } finally {
      lock.releaseLock();
    }
  }

  function applyWithinLock(options) {
    const input = options || {};
    const found = input.found;
    if (!found || !found.record || !found.rowNumber) {
      throw new Error('Registro da solicitação não informado para alteração de status.');
    }

    const record = found.record;
    const solicitationId = ValidationService.requiredText(
      record.ID_SOLICITACAO,
      'ID da solicitação'
    );
    const administrativeUser = ValidationService.requiredText(
      input.usuarioAdministrativo,
      'Usuário administrativo'
    );
    const target = ValidationService.enumValue(
      input.target,
      'Status',
      ACTIVE_OPERATIONAL_STATUSES
    );
    const current = resolve(record);
    const updates = Object.assign({}, input.updates || {});
    delete updates.STATUS;

    const statusChanged = current !== target;
    if (statusChanged) {
      const allowed = TRANSITIONS[current] || [];
      if (allowed.indexOf(target) < 0) {
        ValidationService.fail(
          'Transição de status inválida: ' + current + ' → ' + target + '.'
        );
      }

      const projectedRecord = Object.assign({}, record, updates, { STATUS: target });
      validateTarget_(projectedRecord, target);
      ensureAuditSheet_();
      updates.STATUS = target;
    }

    const fields = Object.keys(updates);
    if (!fields.length) {
      return {
        idSolicitacao: solicitationId,
        statusAnterior: current,
        status: target,
        alterado: false,
      };
    }

    const rollback = {};
    fields.forEach(function (fieldName) {
      rollback[fieldName] = record[fieldName] == null ? '' : record[fieldName];
    });

    SheetRepository.updateFields(
      SHEET_SOLICITACOES,
      found.rowNumber,
      updates
    );

    if (statusChanged) {
      try {
        appendAudit_(
          solicitationId,
          administrativeUser,
          current,
          target,
          ValidationService.normalizeText(input.motivo || '')
        );
      } catch (auditError) {
        try {
          SheetRepository.updateFields(
            SHEET_SOLICITACOES,
            found.rowNumber,
            rollback
          );
        } catch (rollbackError) {
          throw new Error(
            'Falha ao registrar auditoria de status e também ao restaurar a solicitação: ' +
            String(auditError && auditError.message ? auditError.message : auditError) +
            ' | rollback: ' +
            String(rollbackError && rollbackError.message ? rollbackError.message : rollbackError)
          );
        }
        throw auditError;
      }
    }

    return {
      idSolicitacao: solicitationId,
      statusAnterior: current,
      status: target,
      alterado: statusChanged,
    };
  }

  function previewExistingStatuses() {
    const analysis = analyzeMigration_(readMigrationDataset_());
    return {
      simulacao: true,
      alterouPlanilha: false,
      colunaStatusExiste: analysis.statusColumnExists,
      total: analysis.total,
      existentesValidos: analysis.existingValid,
      pendentes: analysis.pending,
      invalidos: {
        quantidade: analysis.invalidCount,
        exemplos: analysis.invalidExamples,
      },
      porStatus: analysis.counts,
      criterio: {
        semTriagem: STATUS.SENT,
        triagemComFornecedorEPreco: STATUS.TRIAGE,
        maoDeObraComComparecimento: STATUS.ATTENDED,
      },
    };
  }

  function migrateExistingStatuses() {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw new Error('Não foi possível obter bloqueio para migrar os status das solicitações.');
    }

    try {
      const initialAnalysis = analyzeMigration_(readMigrationDataset_());
      if (initialAnalysis.invalidCount > 0) {
        ValidationService.fail(
          'Migração bloqueada: existem ' +
          initialAnalysis.invalidCount +
          ' valor(es) de STATUS inválido(s). Execute previewSolicitationStatusMigration() e revise os exemplos antes de migrar.'
        );
      }

      ensureSchema();

      const dataset = readMigrationDataset_();
      const analysis = analyzeMigration_(dataset);
      if (analysis.invalidCount > 0) {
        ValidationService.fail(
          'Migração bloqueada: a coluna STATUS contém valor(es) inválido(s). Execute previewSolicitationStatusMigration() antes de tentar novamente.'
        );
      }

      if (dataset.rows.length === 0) {
        return {
          migrado: true,
          atualizados: 0,
          preservados: 0,
          total: 0,
          porStatus: {},
        };
      }

      const statusValues = dataset.rows.map(function (row) {
        const record = rowToObject_(dataset.headers, row);
        const current = normalizeStatus_(record.STATUS);
        return [current ? row[dataset.statusIndex] : inferLegacy_(record)];
      });

      dataset.sheet
        .getRange(2, dataset.statusIndex + 1, statusValues.length, 1)
        .setValues(statusValues);

      return {
        migrado: true,
        atualizados: analysis.pending,
        preservados: analysis.existingValid,
        total: analysis.total,
        porStatus: analysis.counts,
      };
    } finally {
      lock.releaseLock();
    }
  }

  function readMigrationDataset_() {
    const spreadsheet = SheetRepository.getSpreadsheet();
    const sheet = spreadsheet.getSheetByName(SHEET_SOLICITACOES);
    if (!sheet) throw new Error('Aba não encontrada: ' + SHEET_SOLICITACOES);

    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    const headers = lastColumn > 0
      ? sheet
          .getRange(1, 1, 1, lastColumn)
          .getDisplayValues()[0]
          .map(function (value) { return String(value || '').trim(); })
      : [];
    const rows = lastRow > 1 && lastColumn > 0
      ? sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues()
      : [];

    return {
      sheet: sheet,
      headers: headers,
      rows: rows,
      statusIndex: headers.indexOf('STATUS'),
    };
  }

  function analyzeMigration_(dataset) {
    let existingValid = 0;
    let pending = 0;
    let invalidCount = 0;
    const invalidExamples = [];
    const counts = {};

    dataset.rows.forEach(function (row) {
      const record = rowToObject_(dataset.headers, row);
      const rawStatus = dataset.statusIndex >= 0 ? record.STATUS : '';
      const rawText = ValidationService.normalizeText(rawStatus || '');
      const current = normalizeStatus_(rawStatus);

      if (rawText && !current) {
        invalidCount += 1;
        if (invalidExamples.length < 20) {
          invalidExamples.push({
            idSolicitacao: ValidationService.normalizeText(record.ID_SOLICITACAO || ''),
            status: rawText,
          });
        }
        return;
      }

      const status = current || inferLegacy_(record);
      if (current) existingValid += 1;
      else pending += 1;
      counts[status] = (counts[status] || 0) + 1;
    });

    return {
      statusColumnExists: dataset.statusIndex >= 0,
      total: dataset.rows.length,
      existingValid: existingValid,
      pending: pending,
      invalidCount: invalidCount,
      invalidExamples: invalidExamples,
      counts: counts,
    };
  }

  function inferLegacy_(record) {
    const type = ValidationService.normalizeUpper(record.TIPO_SOLICITACAO);

    if (type === 'MAO_DE_OBRA' && hasValue_(record.QTD_COMPARECIDA)) {
      return STATUS.ATTENDED;
    }

    if (triageCompleted_(record)) {
      return STATUS.TRIAGE;
    }

    return STATUS.SENT;
  }

  function validateTarget_(record, target) {
    if (target === STATUS.SUPPLIER_SENT && !triageCompleted_(record)) {
      ValidationService.fail('Conclua a triagem e aplique o fornecedor/preço antes de enviar ao fornecedor.');
    }

    if (target === STATUS.ATTENDED) {
      const type = ValidationService.normalizeUpper(record.TIPO_SOLICITACAO);
      if (type === 'MAO_DE_OBRA' && !hasValue_(record.QTD_COMPARECIDA)) {
        ValidationService.fail('Registre o comparecimento antes de marcar a solicitação de mão de obra como atendida.');
      }
      if (type === 'ALIMENTACAO_BEBIDA' && !triageCompleted_(record)) {
        ValidationService.fail('Conclua a triagem antes de marcar a solicitação como atendida.');
      }
    }
  }

  function triageCompleted_(record) {
    return hasValue_(record.FORNECEDOR) && (
      hasValue_(record.PRECO_UNITARIO_APLICADO) ||
      hasValue_(record.PRECO_ALIMENTACAO_APLICADO) ||
      hasValue_(record.PRECO_BEBIDA_APLICADO)
    );
  }

  function normalizeStatus_(value) {
    const normalized = ValidationService.normalizeUpper(value || '');
    return ALL_STATUSES.indexOf(normalized) >= 0 ? normalized : '';
  }

  function hasValue_(value) {
    return value !== '' && value != null;
  }

  function rowToObject_(headers, row) {
    return headers.reduce(function (record, header, index) {
      if (header) record[header] = row[index] == null ? '' : row[index];
      return record;
    }, {});
  }

  function ensureAuditSheet_() {
    const spreadsheet = SheetRepository.getSpreadsheet();
    let sheet = spreadsheet.getSheetByName(SHEET_AUDITORIA);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET_AUDITORIA);
      sheet
        .getRange(1, 1, 1, AUDIT_HEADERS.length)
        .setValues([AUDIT_HEADERS])
        .setFontWeight('bold');
      sheet.setFrozenRows(1);
      return sheet;
    }
    SheetRepository.ensureColumns(SHEET_AUDITORIA, AUDIT_HEADERS);
    return sheet;
  }

  function appendAudit_(solicitationId, user, beforeStatus, afterStatus, reason) {
    const now = new Date();
    const id =
      'STATUS-' +
      Utilities.formatDate(now, DateService.TIMEZONE, 'yyyyMMddHHmmss') +
      '-' +
      Utilities.getUuid().slice(0, 8).toUpperCase();

    SheetRepository.appendObject(
      SHEET_AUDITORIA,
      {
        ID_AUDITORIA: id,
        ID_SOLICITACAO: solicitationId,
        DATA_ALTERACAO: now,
        USUARIO_ADMINISTRATIVO: user,
        MOTIVO_CORRECAO: reason || 'ALTERACAO_STATUS',
        CAMPOS_ALTERADOS: 'STATUS',
        ANTES_JSON: JSON.stringify({ STATUS: beforeStatus }),
        DEPOIS_JSON: JSON.stringify({ STATUS: afterStatus }),
      },
      { textFields: ['ID_AUDITORIA', 'ID_SOLICITACAO'] }
    );
  }

  return {
    STATUS,
    ensureSchema,
    resolve,
    afterTriage,
    attended,
    transition,
    applyWithinLock,
    previewExistingStatuses,
    migrateExistingStatuses,
  };
})();

function previewSolicitationStatusMigration() {
  const result = SolicitationStatusService.previewExistingStatuses();
  console.log(JSON.stringify(result, null, 2));
  return result;
}

function migrateSolicitationStatuses() {
  const result = SolicitationStatusService.migrateExistingStatuses();
  console.log(JSON.stringify(result, null, 2));
  return result;
}
