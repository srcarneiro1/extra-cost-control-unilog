const LegacyMigrationService = (() => {
  const TARGET_SPREADSHEET_ID = '18dpLKAFHQI3rHRgn1XzP0cAtzYzZsrU-r6FulFkHXvo';
  const BACKUP_SPREADSHEET_ID = '1mD8T8CiErcqxs_kyaOeJdZUH1HElGddO9YMRY2ygBz0';

  const STAGING_SOLICITACOES_ID = '1as_pZfcJiNLueJsTm5tI_rqLcQGB2Ra8_-dZKrhcPP0';
  const STAGING_SOLICITACOES_SHEET = 'TMP - MIGRACAO LEGADO SOLICITACOES TEXTO 2026-09-09';
  const STAGING_EXCECOES_ID = '1rDoltMuJy3ExPbRzal_p4cmFz6nrJbL6iNGnkqHjwfA';
  const STAGING_EXCECOES_SHEET = 'TMP - MIGRACAO LEGADO EXCECOES TEXTO 2026-09-09';

  const TARGET_SOLICITACOES_SHEET = 'SOLICITACOES';
  const TARGET_EXCECOES_SHEET = 'EXCECOES_JORNADA_MO';

  const EXPECTED_SOLICITACOES = 3802;
  const EXPECTED_EXCECOES = 238;
  const EXPECTED_MAO_DE_OBRA = 2446;
  const EXPECTED_LANCHES = 1356;
  const EXPECTED_NOTURNO = 62;
  const EXPECTED_OPERADOR = 206;
  const EXPECTED_PREVISTO = 3481374.00;
  const EXPECTED_REAL = 3192454.00;

  const SOL_COLUMNS = 36;
  const EXC_COLUMNS = 10;
  const WRITE_CHUNK_SIZE = 500;

  const SOL_NUMERIC_COLUMNS = Object.freeze({
    2: true,   // DATA_CRIACAO
    9: true,   // DATA_OPERACIONAL
    18: true,  // QTD_SOLICITADA
    19: true,  // QTD_COMPARECIDA
    22: true,  // PRECO_UNITARIO_APLICADO
    24: true,  // QTD_ALIMENTACAO
    25: true,  // PRECO_ALIMENTACAO_APLICADO
    26: true,  // VALOR_ALIMENTACAO
    28: true,  // QTD_BEBIDA
    29: true,  // PRECO_BEBIDA_APLICADO
    30: true,  // VALOR_BEBIDA
    31: true,  // VALOR_PREVISTO
    32: true,  // VALOR_REAL
  });

  const EXC_NUMERIC_COLUMNS = Object.freeze({
    3: true, // HORAS_TRABALHADAS
    6: true, // VALOR_REGISTRADO
    7: true, // DATA_REGISTRO
  });

  function executar() {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(30000)) {
      throw new Error('Não foi possível obter bloqueio exclusivo para a migração.');
    }

    try {
      const target = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
      const solicitationRows = readStaging_(
        STAGING_SOLICITACOES_ID,
        STAGING_SOLICITACOES_SHEET,
        SOL_COLUMNS,
        SOL_NUMERIC_COLUMNS
      );
      const exceptionRows = readStaging_(
        STAGING_EXCECOES_ID,
        STAGING_EXCECOES_SHEET,
        EXC_COLUMNS,
        EXC_NUMERIC_COLUMNS
      );

      validateStaging_(solicitationRows, exceptionRows);

      const solicitationSheet = requiredSheet_(target, TARGET_SOLICITACOES_SHEET);
      const exceptionSheet = requiredSheet_(target, TARGET_EXCECOES_SHEET);

      clearDataRows_(solicitationSheet);
      clearDataRows_(exceptionSheet);

      ensureGrid_(solicitationSheet, solicitationRows.length + 1, SOL_COLUMNS);
      ensureGrid_(exceptionSheet, exceptionRows.length + 1, EXC_COLUMNS);

      writeInChunks_(solicitationSheet, 2, solicitationRows);
      writeInChunks_(exceptionSheet, 2, exceptionRows);

      formatSolicitations_(solicitationSheet, solicitationRows.length);
      formatExceptions_(exceptionSheet, exceptionRows.length);

      SpreadsheetApp.flush();

      const result = validateTarget_(target);
      target.toast(
        'Migração concluída: ' + result.totalSolicitacoes +
          ' solicitações e ' + result.totalExcecoes + ' jornadas parciais.',
        'Migração legado',
        10
      );

      Logger.log(JSON.stringify(result, null, 2));
      return result;
    } finally {
      lock.releaseLock();
    }
  }

  function validar() {
    const target = SpreadsheetApp.openById(TARGET_SPREADSHEET_ID);
    const result = validateTarget_(target);
    Logger.log(JSON.stringify(result, null, 2));
    return result;
  }

  function readStaging_(spreadsheetId, sheetName, columnCount, numericColumns) {
    const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) {
      throw new Error('Aba de staging não encontrada: ' + sheetName + '.');
    }

    const lastRow = sheet.getLastRow();
    if (!lastRow) return [];

    const source = sheet.getRange(1, 1, lastRow, columnCount).getDisplayValues();
    return source
      .filter(function (row) {
        return row.some(function (value) { return String(value || '').trim() !== ''; });
      })
      .map(function (row) {
        return row.map(function (value, index) {
          const clean = cleanText_(value);
          if (numericColumns[index]) {
            return clean === '' ? '' : parseNumber_(clean, sheetName, index + 1);
          }
          return clean;
        });
      });
  }

  function cleanText_(value) {
    const text = String(value == null ? '' : value);
    return text.charAt(0) === "'" ? text.slice(1) : text;
  }

  function parseNumber_(value, sheetName, columnNumber) {
    const normalized = String(value).trim().replace(',', '.');
    const parsed = Number(normalized);
    if (!Number.isFinite(parsed)) {
      throw new Error(
        'Valor numérico inválido no staging ' + sheetName +
        ', coluna ' + columnNumber + ': ' + value
      );
    }
    return parsed;
  }

  function validateStaging_(solicitationRows, exceptionRows) {
    if (solicitationRows.length !== EXPECTED_SOLICITACOES) {
      throw new Error(
        'Staging de solicitações divergente. Esperado: ' + EXPECTED_SOLICITACOES +
        '. Encontrado: ' + solicitationRows.length + '.'
      );
    }
    if (exceptionRows.length !== EXPECTED_EXCECOES) {
      throw new Error(
        'Staging de exceções divergente. Esperado: ' + EXPECTED_EXCECOES +
        '. Encontrado: ' + exceptionRows.length + '.'
      );
    }

    const ids = {};
    let labor = 0;
    let snacks = 0;
    let night = 0;
    let forklift = 0;
    let planned = 0;
    let real = 0;

    solicitationRows.forEach(function (row, index) {
      const id = String(row[0] || '').trim();
      if (!id) throw new Error('ID vazio na linha ' + (index + 1) + ' do staging.');
      if (ids[id]) throw new Error('ID duplicado no staging: ' + id + '.');
      ids[id] = true;

      const type = String(row[1] || '').trim().toUpperCase();
      if (type === 'MAO_DE_OBRA') labor += 1;
      if (type === 'ALIMENTACAO_BEBIDA') snacks += 1;
      if (String(row[17] || '').trim().toUpperCase() === 'NOTURNO') night += 1;
      if (String(row[16] || '').trim().toUpperCase() === 'OPERADOR DE EMPILHADEIRA') forklift += 1;

      planned += Number(row[31] || 0);
      real += Number(row[32] || 0);
    });

    if (labor !== EXPECTED_MAO_DE_OBRA) {
      throw new Error('Quantidade de MO divergente: ' + labor + '.');
    }
    if (snacks !== EXPECTED_LANCHES) {
      throw new Error('Quantidade de lanches divergente: ' + snacks + '.');
    }
    if (night !== EXPECTED_NOTURNO) {
      throw new Error('Quantidade de registros noturnos divergente: ' + night + '.');
    }
    if (forklift !== EXPECTED_OPERADOR) {
      throw new Error('Quantidade de operadores divergente: ' + forklift + '.');
    }
    if (!moneyEquals_(planned, EXPECTED_PREVISTO)) {
      throw new Error('Total previsto divergente: ' + roundMoney_(planned) + '.');
    }
    if (!moneyEquals_(real, EXPECTED_REAL)) {
      throw new Error('Total real divergente: ' + roundMoney_(real) + '.');
    }

    exceptionRows.forEach(function (row) {
      const solicitationId = String(row[1] || '').trim();
      if (!ids[solicitationId]) {
        throw new Error('Exceção vinculada a solicitação inexistente: ' + solicitationId + '.');
      }
    });
  }

  function clearDataRows_(sheet) {
    const maxRows = sheet.getMaxRows();
    const maxColumns = sheet.getMaxColumns();
    if (maxRows > 1) {
      sheet.getRange(2, 1, maxRows - 1, maxColumns).clearContent();
    }
  }

  function ensureGrid_(sheet, requiredRows, requiredColumns) {
    const currentRows = sheet.getMaxRows();
    const currentColumns = sheet.getMaxColumns();
    if (currentRows < requiredRows) {
      sheet.insertRowsAfter(currentRows, requiredRows - currentRows);
    }
    if (currentColumns < requiredColumns) {
      sheet.insertColumnsAfter(currentColumns, requiredColumns - currentColumns);
    }
  }

  function writeInChunks_(sheet, startRow, rows) {
    for (let offset = 0; offset < rows.length; offset += WRITE_CHUNK_SIZE) {
      const chunk = rows.slice(offset, offset + WRITE_CHUNK_SIZE);
      sheet
        .getRange(startRow + offset, 1, chunk.length, chunk[0].length)
        .setValues(chunk);
    }
  }

  function formatSolicitations_(sheet, rowCount) {
    if (!rowCount) return;
    sheet.getRange(2, 1, rowCount, 1).setNumberFormat('@'); // ID_SOLICITACAO
    sheet.getRange(2, 3, rowCount, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
    sheet.getRange(2, 6, rowCount, 2).setNumberFormat('@'); // ID_ORIGEM / LOTE
    sheet.getRange(2, 10, rowCount, 1).setNumberFormat('dd/MM/yyyy');
    sheet.getRange(2, 11, rowCount, 1).setNumberFormat('@'); // COMPETENCIA
    sheet.getRange(2, 15, rowCount, 1).setNumberFormat('@'); // CENTRO_CUSTO
    [23, 26, 27, 30, 31, 32, 33].forEach(function (column) {
      sheet.getRange(2, column, rowCount, 1).setNumberFormat('R$ #,##0.00');
    });
  }

  function formatExceptions_(sheet, rowCount) {
    if (!rowCount) return;
    sheet.getRange(2, 1, rowCount, 2).setNumberFormat('@');
    sheet.getRange(2, 4, rowCount, 1).setNumberFormat('0.00');
    sheet.getRange(2, 5, rowCount, 1).setNumberFormat('@');
    sheet.getRange(2, 7, rowCount, 1).setNumberFormat('R$ #,##0.00');
    sheet.getRange(2, 8, rowCount, 1).setNumberFormat('dd/MM/yyyy HH:mm:ss');
  }

  function validateTarget_(target) {
    const solicitationSheet = requiredSheet_(target, TARGET_SOLICITACOES_SHEET);
    const exceptionSheet = requiredSheet_(target, TARGET_EXCECOES_SHEET);
    const totalSolicitacoes = Math.max(solicitationSheet.getLastRow() - 1, 0);
    const totalExcecoes = Math.max(exceptionSheet.getLastRow() - 1, 0);

    if (totalSolicitacoes !== EXPECTED_SOLICITACOES) {
      throw new Error(
        'Validação final falhou em SOLICITACOES. Esperado: ' + EXPECTED_SOLICITACOES +
        '. Encontrado: ' + totalSolicitacoes + '.'
      );
    }
    if (totalExcecoes !== EXPECTED_EXCECOES) {
      throw new Error(
        'Validação final falhou em EXCECOES_JORNADA_MO. Esperado: ' + EXPECTED_EXCECOES +
        '. Encontrado: ' + totalExcecoes + '.'
      );
    }

    const rows = solicitationSheet
      .getRange(2, 1, totalSolicitacoes, SOL_COLUMNS)
      .getValues();

    let labor = 0;
    let snacks = 0;
    let night = 0;
    let forklift = 0;
    let planned = 0;
    let real = 0;

    rows.forEach(function (row) {
      const type = String(row[1] || '').trim().toUpperCase();
      if (type === 'MAO_DE_OBRA') labor += 1;
      if (type === 'ALIMENTACAO_BEBIDA') snacks += 1;
      if (String(row[17] || '').trim().toUpperCase() === 'NOTURNO') night += 1;
      if (String(row[16] || '').trim().toUpperCase() === 'OPERADOR DE EMPILHADEIRA') forklift += 1;
      planned += Number(row[31] || 0);
      real += Number(row[32] || 0);
    });

    if (labor !== EXPECTED_MAO_DE_OBRA ||
        snacks !== EXPECTED_LANCHES ||
        night !== EXPECTED_NOTURNO ||
        forklift !== EXPECTED_OPERADOR ||
        !moneyEquals_(planned, EXPECTED_PREVISTO) ||
        !moneyEquals_(real, EXPECTED_REAL)) {
      throw new Error('Validação financeira/quantitativa final da migração falhou.');
    }

    return {
      ok: true,
      backupSpreadsheetId: BACKUP_SPREADSHEET_ID,
      totalSolicitacoes: totalSolicitacoes,
      maoDeObra: labor,
      lanches: snacks,
      registrosNoturnos: night,
      operadoresEmpilhadeira: forklift,
      totalExcecoes: totalExcecoes,
      valorPrevisto: roundMoney_(planned),
      valorReal: roundMoney_(real),
    };
  }

  function requiredSheet_(spreadsheet, sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName);
    if (!sheet) throw new Error('Aba obrigatória não encontrada: ' + sheetName + '.');
    return sheet;
  }

  function moneyEquals_(left, right) {
    return Math.abs(roundMoney_(left) - roundMoney_(right)) < 0.01;
  }

  function roundMoney_(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  return {
    executar,
    validar,
  };
})();

function executarMigracaoLegado_20260909() {
  return LegacyMigrationService.executar();
}

function validarMigracaoLegado_20260909() {
  return LegacyMigrationService.validar();
}
