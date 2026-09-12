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
      const current = resolve(record);

      if (current === target) {
        return {
          idSolicitacao: solicitationId,
          statusAnterior: current,
          status: target,
          alterado: false,
        };
      }

      const allowed = TRANSITIONS[current] || [];
      if (allowed.indexOf(target) < 0) {
        ValidationService.fail(
          'Transição de status inválida: ' + current + ' → ' + target + '.'
        );
      }

      validateTarget_(record, target);

      SheetRepository.updateFields(
        SHEET_SOLICITACOES,
        found.rowNumber,
        { STATUS: target }
      );

      appendAudit_(
        solicitationId,
        administrativeUser,
        current,
        target,
        ValidationService.normalizeText(input.motivo || '')
      );

      return {
        idSolicitacao: solicitationId,
        statusAnterior: current,
        status: target,
        alterado: true,
      };
    } finally {
      lock.releaseLock();
    }
  }

  function migrateExistingStatuses() {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw new Error('Não foi possível obter bloqueio para migrar os status das solicitações.');
    }

    try {
      ensureSchema();
      const spreadsheet = SheetRepository.getSpreadsheet();
      const sheet = spreadsheet.getSheetByName(SHEET_SOLICITACOES);
      if (!sheet) throw new Error('Aba não encontrada: ' + SHEET_SOLICITACOES);

      const lastRow = sheet.getLastRow();
      const lastColumn = sheet.getLastColumn();
      if (lastRow <= 1) {
        return { migrado: true, atualizados: 0, total: 0, porStatus: {} };
      }

      const headers = sheet
        .getRange(1, 1, 1, lastColumn)
        .getDisplayValues()[0]
        .map(function (value) { return String(value || '').trim(); });
      const statusIndex = headers.indexOf('STATUS');
      if (statusIndex < 0) throw new Error('Coluna STATUS não foi criada corretamente.');

      const rows = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
      let updated = 0;
      const counts = {};
      const statusValues = rows.map(function (row) {
        const record = rowToObject_(headers, row);
        const current = normalizeStatus_(record.STATUS);
        const status = current || inferLegacy_(record);
        if (!current) updated += 1;
        counts[status] = (counts[status] || 0) + 1;
        return [status];
      });

      sheet.getRange(2, statusIndex + 1, statusValues.length, 1).setValues(statusValues);

      return {
        migrado: true,
        atualizados: updated,
        total: statusValues.length,
        porStatus: counts,
      };
    } finally {
      lock.releaseLock();
    }
  }

  function inferLegacy_(record) {
    const type = ValidationService.normalizeUpper(record.TIPO_SOLICITACAO);
    const triageCompleted = hasValue_(record.FORNECEDOR) && (
      hasValue_(record.PRECO_UNITARIO_APLICADO) ||
      hasValue_(record.PRECO_ALIMENTACAO_APLICADO) ||
      hasValue_(record.PRECO_BEBIDA_APLICADO)
    );

    if (type === 'MAO_DE_OBRA') {
      if (hasValue_(record.QTD_COMPARECIDA)) return STATUS.ATTENDED;
      if (triageCompleted) return STATUS.SUPPLIER_SENT;
      return STATUS.SENT;
    }

    if (type === 'ALIMENTACAO_BEBIDA') {
      return triageCompleted ? STATUS.ATTENDED : STATUS.SENT;
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
      sheet.getRange(1, 1, 1, AUDIT_HEADERS.length).setValues([AUDIT_HEADERS]).setFontWeight('bold');
      sheet.setFrozenRows(1);
      return sheet;
    }
    SheetRepository.ensureColumns(SHEET_AUDITORIA, AUDIT_HEADERS);
    return sheet;
  }

  function appendAudit_(solicitationId, user, beforeStatus, afterStatus, reason) {
    const now = new Date();
    const id = 'STATUS-' + Utilities.formatDate(now, DateService.TIMEZONE, 'yyyyMMddHHmmss') + '-' + Utilities.getUuid().slice(0, 8).toUpperCase();
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
    migrateExistingStatuses,
  };
})();

function migrateSolicitationStatuses() {
  return SolicitationStatusService.migrateExistingStatuses();
}
