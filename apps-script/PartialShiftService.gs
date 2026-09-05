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
    const administrativeUser = ValidationService.requiredText(
      input.usuarioAdministrativo,
      'Usuário administrativo'
    );
    const entries = normalizeEntries_(input);

    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      throw new Error('Não foi possível obter bloqueio para registrar a jornada parcial.');
    }

    try {
      const exceptionSheet = ensureSheet_();
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
      const available = attendedQuantity - existing.length;

      if (available <= 0) {
        ValidationService.fail('Todas as pessoas comparecidas já possuem jornada parcial registrada.');
      }
      if (entries.length > available) {
        ValidationService.fail(
          'Foram informadas ' + entries.length + ' jornadas parciais, mas há somente ' + available +
          ' pessoa(s) disponível(is) dentro do comparecimento registrado.'
        );
      }

      validateDuplicates_(existing, entries);

      const now = new Date();
      const records = entries.map(function (entry) {
        return {
          ID_EXCECAO: 'JPAR-' + Utilities.getUuid(),
          ID_SOLICITACAO: solicitationId,
          NOME_COLABORADOR: entry.nomeColaborador,
          HORAS_TRABALHADAS: entry.horasTrabalhadas,
          HORARIO_SAIDA: entry.horarioSaida,
          MOTIVO: entry.motivo,
          VALOR_REGISTRADO: proportionalValue_(unitPrice, entry.horasTrabalhadas),
          DATA_REGISTRO: now,
          USUARIO_ADMINISTRATIVO: administrativeUser,
          ATIVO: 'SIM',
        };
      });

      const startRow = appendBatch_(exceptionSheet, records);
      let realValue;

      try {
        realValue = calculateRealValue_(
          attendedQuantity,
          unitPrice,
          existing.concat(records)
        );

        SheetRepository.updateFields(
          SHEET_SOLICITACOES,
          found.rowNumber,
          { VALOR_REAL: realValue }
        );
      } catch (error) {
        exceptionSheet
          .getRange(startRow, 1, records.length, HEADERS.length)
          .clearContent();
        throw error;
      }

      return {
        idSolicitacao: solicitationId,
        quantidadeComparecida: attendedQuantity,
        quantidadeRegistrada: records.length,
        totalJornadasParciais: existing.length + records.length,
        limiteComparecimento: attendedQuantity,
        jornadaPadraoHoras: FULL_SHIFT_HOURS,
        valorReal: realValue,
        excecoes: records.map(function (row) {
          return {
            idExcecao: row.ID_EXCECAO,
            nomeColaborador: row.NOME_COLABORADOR,
            horasTrabalhadas: row.HORAS_TRABALHADAS,
            horarioSaida: row.HORARIO_SAIDA,
            motivo: row.MOTIVO,
            valorProporcional: row.VALOR_REGISTRADO,
          };
        }),
      };
    } finally {
      lock.releaseLock();
    }
  }

  function normalizeEntries_(input) {
    const source = Array.isArray(input.excecoes)
      ? input.excecoes
      : [{
          nomeColaborador: input.nomeColaborador,
          horasTrabalhadas: input.horasTrabalhadas,
          horarioSaida: input.horarioSaida,
          motivo: input.motivo,
        }];

    if (!source.length) {
      ValidationService.fail('Informe pelo menos uma pessoa com jornada parcial.');
    }

    return source.map(function (entry, index) {
      const item = entry || {};
      const position = source.length > 1 ? ' #' + (index + 1) : '';
      return {
        nomeColaborador: ValidationService.requiredText(
          item.nomeColaborador,
          'Nome do colaborador' + position
        ),
        horasTrabalhadas: validateWorkedHours_(
          item.horasTrabalhadas,
          'Horas trabalhadas' + position
        ),
        horarioSaida: validateDepartureTime_(
          item.horarioSaida,
          'Horário de saída' + position
        ),
        motivo: ValidationService.requiredText(
          item.motivo,
          'Motivo' + position
        ),
      };
    });
  }

  function validateDuplicates_(existing, entries) {
    const names = {};

    existing.forEach(function (row) {
      names[ValidationService.normalizeUpper(row.NOME_COLABORADOR)] = true;
    });

    entries.forEach(function (entry) {
      const key = ValidationService.normalizeUpper(entry.nomeColaborador);
      if (names[key]) {
        ValidationService.fail(
          'Já existe uma jornada parcial ativa para ' + entry.nomeColaborador +
          '. Não é permitido duplicar o mesmo colaborador.'
        );
      }
      names[key] = true;
    });
  }

  function appendBatch_(sheet, records) {
    const startRow = sheet.getLastRow() + 1;
    const values = records.map(function (record) {
      return HEADERS.map(function (header) {
        return Object.prototype.hasOwnProperty.call(record, header)
          ? record[header]
          : '';
      });
    });

    ['ID_EXCECAO', 'ID_SOLICITACAO', 'HORARIO_SAIDA'].forEach(function (fieldName) {
      const columnIndex = HEADERS.indexOf(fieldName);
      sheet
        .getRange(startRow, columnIndex + 1, records.length, 1)
        .setNumberFormat('@');
    });

    sheet
      .getRange(startRow, 1, records.length, HEADERS.length)
      .setValues(values);

    return startRow;
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

  function validateWorkedHours_(value, label) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue <= 0 || numberValue >= FULL_SHIFT_HOURS) {
      ValidationService.fail(
        (label || 'Horas trabalhadas') + ' deve ser maior que zero e menor que ' + FULL_SHIFT_HOURS + ' horas.'
      );
    }
    return Math.round(numberValue * 100) / 100;
  }

  function validateDepartureTime_(value, label) {
    const normalized = ValidationService.normalizeText(value);
    if (!normalized) return '';
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(normalized)) {
      ValidationService.fail((label || 'Horário de saída') + ' deve estar no formato HH:MM.');
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

    return sheet;
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
