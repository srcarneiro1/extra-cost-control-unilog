const PartialShiftService = (() => {
  const SHEET_SOLICITACOES = 'SOLICITACOES';
  const SHEET_EXCECOES = 'EXCECOES_JORNADA_MO';
  const FULL_SHIFT_HOURS = 9;
  const HEADERS = [
    'ID_EXCECAO',
    'ID_SOLICITACAO',
    'NOME_COLABORADOR',
    'HORAS_TRABALHADAS',
    'HORARIO_SAIDA',
    'MOTIVO',
    'VALOR_REGISTRADO',
    'DATA_REGISTRO',
    'USUARIO_ADMINISTRATIVO',
    'ATIVO',
  ];

  function register(payload) {
    const input = payload || {};
    const solicitationId = ValidationService.requiredText(
      input.idSolicitacao,
      'ID da solicitação'
    );
    const employeeName = ValidationService.requiredText(
      input.nomeColaborador,
      'Nome do colaborador'
    );
    const workedHours = validateWorkedHours_(input.horasTrabalhadas);
    const departureTime = validateDepartureTime_(input.horarioSaida);
    const reason = ValidationService.requiredText(input.motivo, 'Motivo');
    const administrativeUser = ValidationService.requiredText(
      input.usuarioAdministrativo,
      'Usuário administrativo'
    );

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw new Error('Não foi possível obter bloqueio para registrar a jornada parcial.');
    }

    try {
      ensureSheet_();

      const found = SheetRepository.findRowByField(
        SHEET_SOLICITACOES,
        'ID_SOLICITACAO',
        solicitationId
      );

      if (!found) {
        ValidationService.fail('Solicitação não encontrada: ' + solicitationId + '.');
      }

      const record = found.record;
      if (ValidationService.normalizeUpper(record.TIPO_SOLICITACAO) !== 'MAO_DE_OBRA') {
        ValidationService.fail('Jornada parcial só pode ser registrada para solicitação de mão de obra.');
      }

      const attendedQuantity = toIntegerOrNull_(record.QTD_COMPARECIDA);
      if (attendedQuantity == null) {
        ValidationService.fail('Registre primeiro a quantidade comparecida antes de informar jornada parcial.');
      }
      if (attendedQuantity <= 0) {
        ValidationService.fail('Não é possível registrar jornada parcial quando a quantidade comparecida é zero.');
      }

      const unitPrice = toMoneyNumber_(record.PRECO_UNITARIO_APLICADO);
      if (unitPrice == null) {
        ValidationService.fail('A solicitação não possui preço unitário aplicado.');
      }

      const existing = activeRows_(solicitationId);
      const normalizedEmployee = ValidationService.normalizeUpper(employeeName);
      const duplicate = existing.some(function (row) {
        return ValidationService.normalizeUpper(row.NOME_COLABORADOR) === normalizedEmployee;
      });

      if (duplicate) {
        ValidationService.fail(
          'Já existe uma exceção de jornada ativa para ' + employeeName + '. Correção exige fluxo auditado.'
        );
      }

      if (existing.length >= attendedQuantity) {
        ValidationService.fail(
          'A quantidade de exceções de jornada não pode ser maior ou igual ao total comparecido já registrado.'
        );
      }

      const proportionalValue = proportionalValue_(unitPrice, workedHours);
      const exceptionId = 'JPAR-' + Utilities.getUuid();

      SheetRepository.appendObject(
        SHEET_EXCECOES,
        {
          ID_EXCECAO: exceptionId,
          ID_SOLICITACAO: solicitationId,
          NOME_COLABORADOR: employeeName,
          HORAS_TRABALHADAS: workedHours,
          HORARIO_SAIDA: departureTime,
          MOTIVO: reason,
          VALOR_REGISTRADO: proportionalValue,
          DATA_REGISTRO: new Date(),
          USUARIO_ADMINISTRATIVO: administrativeUser,
          ATIVO: 'SIM',
        },
        { textFields: ['ID_EXCECAO', 'ID_SOLICITACAO', 'HORARIO_SAIDA'] }
      );

      const realValue = calculateRealValue_(
        attendedQuantity,
        unitPrice,
        existing.concat([{
          HORAS_TRABALHADAS: workedHours,
        }])
      );

      SheetRepository.updateFields(
        SHEET_SOLICITACOES,
        found.rowNumber,
        { VALOR_REAL: realValue }
      );

      return {
        idExcecao: exceptionId,
        idSolicitacao: solicitationId,
        nomeColaborador: employeeName,
        horasTrabalhadas: workedHours,
        horarioSaida: departureTime,
        motivo: reason,
        valorProporcional: proportionalValue,
        valorReal: realValue,
        jornadaPadraoHoras: FULL_SHIFT_HOURS,
      };
    } finally {
      lock.releaseLock();
    }
  }

  function listBySolicitation(solicitationId, unitPrice) {
    const normalizedId = ValidationService.requiredText(
      solicitationId,
      'ID da solicitação'
    );
    ensureSheet_();

    const currentUnitPrice = toMoneyNumber_(unitPrice);

    return activeRows_(normalizedId)
      .slice()
      .sort(function (left, right) {
        return timestamp_(left.DATA_REGISTRO) - timestamp_(right.DATA_REGISTRO);
      })
      .map(function (row) {
        const hours = Number(row.HORAS_TRABALHADAS);
        const registeredValue = toMoneyNumber_(row.VALOR_REGISTRADO);
        return {
          idExcecao: ValidationService.normalizeText(row.ID_EXCECAO),
          nomeColaborador: ValidationService.normalizeText(row.NOME_COLABORADOR),
          horasTrabalhadas: Number.isFinite(hours) ? hours : null,
          horarioSaida: ValidationService.normalizeText(row.HORARIO_SAIDA),
          motivo: ValidationService.normalizeText(row.MOTIVO),
          valorProporcional: currentUnitPrice == null || !Number.isFinite(hours)
            ? registeredValue
            : proportionalValue_(currentUnitPrice, hours),
          valorRegistrado: registeredValue,
          dataRegistro: dateTime_(row.DATA_REGISTRO),
          usuarioAdministrativo: ValidationService.normalizeText(row.USUARIO_ADMINISTRATIVO),
        };
      });
  }

  function calculateRealValue(solicitationId, attendedQuantity, unitPrice) {
    const normalizedId = ValidationService.requiredText(
      solicitationId,
      'ID da solicitação'
    );
    const attended = ValidationService.nonNegativeInteger(
      attendedQuantity,
      'Quantidade comparecida'
    );
    const price = toMoneyNumber_(unitPrice);

    if (price == null) {
      ValidationService.fail('Preço unitário aplicado inválido para cálculo do valor real.');
    }

    ensureSheet_();
    return calculateRealValue_(attended, price, activeRows_(normalizedId));
  }

  function activeCount(solicitationId) {
    ensureSheet_();
    return activeRows_(solicitationId).length;
  }

  function calculateRealValue_(attendedQuantity, unitPrice, exceptions) {
    if (exceptions.length > attendedQuantity) {
      ValidationService.fail(
        'A quantidade comparecida não pode ser menor que o número de exceções de jornada já registradas.'
      );
    }

    const fullShiftQuantity = attendedQuantity - exceptions.length;
    const partialTotal = exceptions.reduce(function (total, row) {
      const hours = Number(row.HORAS_TRABALHADAS);
      if (!Number.isFinite(hours) || hours <= 0 || hours >= FULL_SHIFT_HOURS) {
        ValidationService.fail('Existe uma exceção de jornada com quantidade de horas inválida.');
      }
      return total + proportionalValue_(unitPrice, hours);
    }, 0);

    return roundMoney_((fullShiftQuantity * unitPrice) + partialTotal);
  }

  function proportionalValue_(unitPrice, workedHours) {
    return roundMoney_((Number(unitPrice) / FULL_SHIFT_HOURS) * Number(workedHours));
  }

  function activeRows_(solicitationId) {
    const target = ValidationService.normalizeText(solicitationId);
    return SheetRepository.readObjects(SHEET_EXCECOES).filter(function (row) {
      return ValidationService.normalizeText(row.ID_SOLICITACAO) === target &&
        ValidationService.isTruthy(row.ATIVO);
    });
  }

  function validateWorkedHours_(value) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue <= 0 || numberValue >= FULL_SHIFT_HOURS) {
      ValidationService.fail(
        'Horas trabalhadas deve ser maior que zero e menor que ' + FULL_SHIFT_HOURS + ' horas.'
      );
    }
    return Math.round(numberValue * 100) / 100;
  }

  function validateDepartureTime_(value) {
    const normalized = ValidationService.normalizeText(value);
    if (!normalized) return '';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized)) {
      ValidationService.fail('Horário de saída deve estar no formato HH:MM.');
    }
    return normalized;
  }

  function ensureSheet_() {
    const spreadsheetId = PropertiesService
      .getScriptProperties()
      .getProperty('SPREADSHEET_ID');

    if (!spreadsheetId) {
      throw new Error('Propriedade SPREADSHEET_ID não configurada no Apps Script.');
    }

    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    let sheet = spreadsheet.getSheetByName(SHEET_EXCECOES);

    if (!sheet) {
      sheet = spreadsheet.insertSheet(SHEET_EXCECOES);
      sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
      sheet.autoResizeColumns(1, HEADERS.length);
    }
  }

  function toIntegerOrNull_(value) {
    if (value === '' || value == null) return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  }

  function toMoneyNumber_(value) {
    if (value === '' || value == null) return null;
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    const text = String(value).trim();
    let normalized = text;

    if (text.indexOf(',') >= 0 && text.indexOf('.') >= 0) {
      normalized = text.lastIndexOf(',') > text.lastIndexOf('.')
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '');
    } else if (text.indexOf(',') >= 0) {
      normalized = text.replace(',', '.');
    }

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function timestamp_(value) {
    if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
      return value.getTime();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  function dateTime_(value) {
    if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
      return Utilities.formatDate(value, DateService.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
    }
    return ValidationService.normalizeText(value);
  }

  function roundMoney_(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  return {
    FULL_SHIFT_HOURS,
    register,
    listBySolicitation,
    calculateRealValue,
    activeCount,
  };
})();
