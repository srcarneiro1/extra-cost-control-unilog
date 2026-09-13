const SheetRepository = (() => {
  const PROPERTY_SPREADSHEET_ID = 'SPREADSHEET_ID';
  const ACTIVE_CATALOG_CACHE_KEY = 'active_catalogs_v1';
  const ADMIN_CATALOG_CACHE_KEY = 'catalog_admin_v5';
  const ADMIN_SCOPE_CACHE_KEYS = [
    'catalog_admin_scope_v1_RESUMO',
    'catalog_admin_scope_v1_FORNECEDORES',
    'catalog_admin_scope_v1_PRODUTOS',
    'catalog_admin_scope_v1_PRECOS_MO',
    'catalog_admin_scope_v1_PRECOS_PRODUTOS',
  ];
  const SOLICITATION_LIST_CACHE_KEYS = [
    'admin_solicitations_list_v1_100',
    'admin_solicitations_list_v1_500',
    'admin_solicitations_metadata_v2',
  ];
  const CATALOG_SHEETS = {
    CAD_OPERACOES: true,
    CAD_SUPERVISORES: true,
    CAD_FORNECEDORES: true,
    CAD_ATIVIDADES: true,
    CAD_FUNCOES: true,
    CAD_PRODUTOS: true,
    PRECOS_MO: true,
    PRECOS_PRODUTOS: true,
  };
  const MONEY_FORMAT = 'R$ #,##0.00';
  const SOLICITATION_MONEY_FIELDS = [
    'PRECO_UNITARIO_APLICADO',
    'PRECO_ALIMENTACAO_APLICADO',
    'VALOR_ALIMENTACAO',
    'PRECO_BEBIDA_APLICADO',
    'VALOR_BEBIDA',
    'VALOR_PREVISTO',
    'VALOR_REAL',
  ];

  let spreadsheetCache_ = null;

  function getSpreadsheet_() {
    if (spreadsheetCache_) return spreadsheetCache_;

    const spreadsheetId = PropertiesService
      .getScriptProperties()
      .getProperty(PROPERTY_SPREADSHEET_ID);

    if (!spreadsheetId) {
      throw new Error('Propriedade SPREADSHEET_ID não configurada no Apps Script.');
    }

    spreadsheetCache_ = SpreadsheetApp.openById(spreadsheetId);
    return spreadsheetCache_;
  }

  function getSheet_(sheetName) {
    const sheet = getSpreadsheet_().getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('Aba não encontrada: ' + sheetName);
    }

    return sheet;
  }

  function normalizeHeaders_(row) {
    return (row || []).map(function (header) {
      return String(header || '').trim();
    });
  }

  function headers_(sheet) {
    const lastColumn = sheet.getLastColumn();
    return normalizeHeaders_(
      sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0]
    );
  }

  function fieldIndex_(headers, sheetName, fieldName) {
    const index = headers.indexOf(fieldName);
    if (index < 0) {
      throw new Error('Campo não encontrado na aba ' + sheetName + ': ' + fieldName);
    }
    return index;
  }

  function rowToObject_(headers, row) {
    return headers.reduce(function (record, header, columnIndex) {
      if (header) record[header] = row[columnIndex] == null ? '' : row[columnIndex];
      return record;
    }, {});
  }

  function hasRecordValue_(record) {
    return Object.keys(record).some(function (key) {
      return record[key] !== '' && record[key] !== null;
    });
  }

  function invalidateCaches_(sheetName) {
    try {
      const cache = CacheService.getScriptCache();

      if (sheetName === 'SOLICITACOES') {
        cache.removeAll(SOLICITATION_LIST_CACHE_KEYS);
      }

      if (CATALOG_SHEETS[sheetName]) {
        cache.remove(ACTIVE_CATALOG_CACHE_KEY);
        cache.remove(ADMIN_CATALOG_CACHE_KEY);
        cache.removeAll(ADMIN_SCOPE_CACHE_KEYS);
      }
    } catch (error) {
      // Cache é apenas otimização; falha nunca bloqueia persistência.
    }
  }

  function solicitationMoneyField_(sheetName, fieldName) {
    return sheetName === 'SOLICITACOES' && SOLICITATION_MONEY_FIELDS.indexOf(fieldName) >= 0;
  }

  function applySolicitationMoneyFormats_(sheet, headers, rowNumber, fieldNames) {
    (fieldNames || []).forEach(function (fieldName) {
      if (!solicitationMoneyField_('SOLICITACOES', fieldName)) return;
      const columnIndex = headers.indexOf(fieldName);
      if (columnIndex < 0) return;
      sheet.getRange(rowNumber, columnIndex + 1).setNumberFormat(MONEY_FORMAT);
    });
  }

  function ensureColumns(sheetName, columns) {
    const sheet = getSheet_(sheetName);
    const existingHeaders = headers_(sheet);
    const missing = (columns || []).filter(function (column) {
      return existingHeaders.indexOf(column) === -1;
    });

    if (!missing.length) return existingHeaders;

    const startColumn = sheet.getLastColumn() + 1;
    const requiredLastColumn = startColumn + missing.length - 1;
    if (requiredLastColumn > sheet.getMaxColumns()) {
      sheet.insertColumnsAfter(sheet.getMaxColumns(), requiredLastColumn - sheet.getMaxColumns());
    }

    sheet.getRange(1, startColumn, 1, missing.length).setValues([missing]);
    invalidateCaches_(sheetName);
    return existingHeaders.concat(missing);
  }

  function readObjectsWithRowNumbers(sheetName) {
    const sheet = getSheet_(sheetName);
    const values = sheet.getDataRange().getValues();

    if (!values.length || values.length === 1) return [];

    const headers = normalizeHeaders_(values[0]);
    return values.slice(1).map(function (row, index) {
      return {
        rowNumber: index + 2,
        record: rowToObject_(headers, row),
      };
    }).filter(function (item) {
      return hasRecordValue_(item.record);
    });
  }

  function readObjects(sheetName) {
    return readObjectsWithRowNumbers(sheetName).map(function (item) {
      return item.record;
    });
  }

  function readFieldValues(sheetName, fieldName) {
    const sheet = getSheet_(sheetName);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return [];

    const headers = headers_(sheet);
    const fieldIndex = fieldIndex_(headers, sheetName, fieldName);
    return sheet
      .getRange(2, fieldIndex + 1, lastRow - 1, 1)
      .getValues()
      .map(function (row) { return row[0]; });
  }

  function readObjectsByFieldValues(sheetName, fieldName, values) {
    const sheet = getSheet_(sheetName);
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow <= 1 || lastColumn <= 0) return [];

    const headers = headers_(sheet);
    const fieldIndex = fieldIndex_(headers, sheetName, fieldName);
    const searchRange = sheet.getRange(2, fieldIndex + 1, lastRow - 1, 1);
    const rowMap = {};

    (values || []).forEach(function (value) {
      const target = String(value == null ? '' : value).trim();
      if (!target) return;

      searchRange
        .createTextFinder(target)
        .matchEntireCell(true)
        .matchCase(true)
        .findAll()
        .forEach(function (cell) {
          rowMap[cell.getRow()] = true;
        });
    });

    const rowNumbers = Object.keys(rowMap)
      .map(Number)
      .sort(function (a, b) { return a - b; });

    if (!rowNumbers.length) return [];

    const result = [];
    let runStart = rowNumbers[0];
    let runEnd = rowNumbers[0];

    function flushRun_() {
      const take = runEnd - runStart + 1;
      const rows = sheet.getRange(runStart, 1, take, lastColumn).getValues();
      rows.forEach(function (row) {
        const record = rowToObject_(headers, row);
        if (hasRecordValue_(record)) result.push(record);
      });
    }

    for (let index = 1; index < rowNumbers.length; index += 1) {
      const rowNumber = rowNumbers[index];
      if (rowNumber === runEnd + 1) {
        runEnd = rowNumber;
        continue;
      }
      flushRun_();
      runStart = rowNumber;
      runEnd = rowNumber;
    }

    flushRun_();
    return result;
  }

  function readLastObjects(sheetName, limit) {
    return readObjectsWindowFromEnd(sheetName, 0, limit);
  }

  function readObjectsWindowFromEnd(sheetName, offset, limit) {
    const sheet = getSheet_(sheetName);
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    const normalizedOffset = Math.max(0, Number(offset) || 0);
    const requested = Math.max(0, Number(limit) || 0);

    if (lastRow <= 1 || requested <= 0 || lastColumn <= 0) return [];

    const dataRowCount = lastRow - 1;
    if (normalizedOffset >= dataRowCount) return [];

    const endRow = lastRow - normalizedOffset;
    const available = dataRowCount - normalizedOffset;
    const take = Math.min(requested, available);
    const startRow = endRow - take + 1;
    const headers = headers_(sheet);
    const values = sheet.getRange(startRow, 1, take, lastColumn).getValues();
    const result = [];

    for (let index = values.length - 1; index >= 0; index -= 1) {
      const record = rowToObject_(headers, values[index]);
      if (hasRecordValue_(record)) result.push(record);
    }

    return result;
  }

  function monthKey_(value) {
    if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
      return Utilities.formatDate(value, DateService.TIMEZONE, 'yyyy-MM');
    }

    const text = String(value == null ? '' : value).trim();
    if (!text) return '';
    if (/^\d{4}-\d{2}/.test(text)) return text.slice(0, 7);

    try {
      return DateService.toIsoDate(value).slice(0, 7);
    } catch (error) {
      return '';
    }
  }

  function readObjectsForMonthFromEnd(sheetName, dateField, year, month) {
    const sheet = getSheet_(sheetName);
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    if (lastRow <= 1 || lastColumn <= 0) return [];

    const headers = headers_(sheet);
    if (headers.indexOf(dateField) < 0) {
      throw new Error('Campo não encontrado na aba ' + sheetName + ': ' + dateField);
    }

    const targetMonth = String(year || '').padStart(4, '0') + '-' + String(month || '').padStart(2, '0');
    const chunkSize = 1000;
    const result = [];
    let endRow = lastRow;
    let finished = false;

    while (endRow >= 2 && !finished) {
      const startRow = Math.max(2, endRow - chunkSize + 1);
      const take = endRow - startRow + 1;
      const values = sheet.getRange(startRow, 1, take, lastColumn).getValues();

      for (let index = values.length - 1; index >= 0; index -= 1) {
        const record = rowToObject_(headers, values[index]);
        if (!hasRecordValue_(record)) continue;

        const recordMonth = monthKey_(record[dateField]);
        if (!recordMonth) continue;

        if (recordMonth === targetMonth) {
          result.push(record);
          continue;
        }

        if (recordMonth < targetMonth) {
          finished = true;
          break;
        }
      }

      endRow = startRow - 1;
    }

    return result;
  }

  function getDataRowCount(sheetName) {
    return Math.max(0, getSheet_(sheetName).getLastRow() - 1);
  }

  function appendObject(sheetName, record, options) {
    const sheet = getSheet_(sheetName);
    const lastColumn = sheet.getLastColumn();
    const headers = headers_(sheet);

    const row = headers.map(function (header) {
      if (!header) return '';
      return Object.prototype.hasOwnProperty.call(record, header) ? record[header] : '';
    });

    const targetRow = sheet.getLastRow() + 1;
    const textFields = options && Array.isArray(options.textFields) ? options.textFields : [];

    textFields.forEach(function (fieldName) {
      const columnIndex = headers.indexOf(fieldName);
      if (columnIndex >= 0) sheet.getRange(targetRow, columnIndex + 1).setNumberFormat('@');
    });

    sheet.getRange(targetRow, 1, 1, lastColumn).setValues([row]);
    if (sheetName === 'SOLICITACOES') {
      applySolicitationMoneyFormats_(sheet, headers, targetRow, SOLICITATION_MONEY_FIELDS);
    }
    invalidateCaches_(sheetName);
    return targetRow;
  }

  function findRowByField(sheetName, fieldName, value) {
    const sheet = getSheet_(sheetName);
    const headers = headers_(sheet);
    const fieldIndex = headers.indexOf(fieldName);

    if (fieldIndex < 0) {
      throw new Error('Campo não encontrado na aba ' + sheetName + ': ' + fieldName);
    }

    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return null;

    const target = String(value == null ? '' : value).trim();
    if (!target) return null;

    const searchRange = sheet.getRange(2, fieldIndex + 1, lastRow - 1, 1);
    const matchedCell = searchRange
      .createTextFinder(target)
      .matchEntireCell(true)
      .matchCase(true)
      .findNext();

    if (!matchedCell) return null;

    const rowNumber = matchedCell.getRow();
    const rowValues = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];

    return {
      rowNumber: rowNumber,
      record: rowToObject_(headers, rowValues),
    };
  }

  function updateFields(sheetName, rowNumber, updates, options) {
    const sheet = getSheet_(sheetName);
    const headers = headers_(sheet);
    const textFields = options && Array.isArray(options.textFields) ? options.textFields : [];

    Object.keys(updates || {}).forEach(function (fieldName) {
      const columnIndex = headers.indexOf(fieldName);
      if (columnIndex < 0) {
        throw new Error('Campo não encontrado na aba ' + sheetName + ': ' + fieldName);
      }

      const cell = sheet.getRange(rowNumber, columnIndex + 1);
      if (textFields.indexOf(fieldName) >= 0) cell.setNumberFormat('@');
      if (solicitationMoneyField_(sheetName, fieldName)) cell.setNumberFormat(MONEY_FORMAT);
      cell.setValue(updates[fieldName]);
    });

    invalidateCaches_(sheetName);
  }

  function formatSolicitationMoneyColumns() {
    const sheet = getSheet_('SOLICITACOES');
    const headers = headers_(sheet);
    const lastRow = sheet.getLastRow();
    if (lastRow <= 1) return { formatado: true, linhas: 0, colunas: [] };

    const formatted = [];
    SOLICITATION_MONEY_FIELDS.forEach(function (fieldName) {
      const columnIndex = headers.indexOf(fieldName);
      if (columnIndex < 0) return;
      sheet.getRange(2, columnIndex + 1, lastRow - 1, 1).setNumberFormat(MONEY_FORMAT);
      formatted.push(fieldName);
    });

    return {
      formatado: true,
      linhas: lastRow - 1,
      colunas: formatted,
    };
  }

  return {
    getSpreadsheet: getSpreadsheet_,
    readObjects,
    readObjectsWithRowNumbers,
    readFieldValues,
    readObjectsByFieldValues,
    readLastObjects,
    readObjectsWindowFromEnd,
    readObjectsForMonthFromEnd,
    getDataRowCount,
    appendObject,
    findRowByField,
    updateFields,
    ensureColumns,
    formatSolicitationMoneyColumns,
  };
})();

function formatSolicitationMoneyColumns() {
  const result = SheetRepository.formatSolicitationMoneyColumns();
  console.log(JSON.stringify(result, null, 2));
  return result;
}
