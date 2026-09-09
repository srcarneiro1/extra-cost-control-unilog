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
        record: headers.reduce(function (record, header, columnIndex) {
          if (header) record[header] = row[columnIndex] == null ? '' : row[columnIndex];
          return record;
        }, {}),
      };
    }).filter(function (item) {
      return Object.keys(item.record).some(function (key) {
        return item.record[key] !== '' && item.record[key] !== null;
      });
    });
  }

  function readObjects(sheetName) {
    return readObjectsWithRowNumbers(sheetName).map(function (item) {
      return item.record;
    });
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
    invalidateCaches_(sheetName);
    return targetRow;
  }

  function findRowByField(sheetName, fieldName, value) {
    const sheet = getSheet_(sheetName);
    const values = sheet.getDataRange().getValues();

    if (!values.length || values.length === 1) return null;

    const headers = normalizeHeaders_(values[0]);
    const fieldIndex = headers.indexOf(fieldName);

    if (fieldIndex < 0) {
      throw new Error('Campo não encontrado na aba ' + sheetName + ': ' + fieldName);
    }

    const target = String(value == null ? '' : value).trim();

    for (let index = 1; index < values.length; index += 1) {
      const rowValues = values[index];
      if (String(rowValues[fieldIndex] == null ? '' : rowValues[fieldIndex]).trim() === target) {
        return {
          rowNumber: index + 1,
          record: headers.reduce(function (record, header, columnIndex) {
            if (header) record[header] = rowValues[columnIndex] == null ? '' : rowValues[columnIndex];
            return record;
          }, {}),
        };
      }
    }

    return null;
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
      cell.setValue(updates[fieldName]);
    });

    invalidateCaches_(sheetName);
  }

  return {
    getSpreadsheet: getSpreadsheet_,
    readObjects,
    readObjectsWithRowNumbers,
    appendObject,
    findRowByField,
    updateFields,
    ensureColumns,
  };
})();
