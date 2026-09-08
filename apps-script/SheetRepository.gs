const SheetRepository = (() => {
  const PROPERTY_SPREADSHEET_ID = 'SPREADSHEET_ID';

  function getSpreadsheet_() {
    const spreadsheetId = PropertiesService
      .getScriptProperties()
      .getProperty(PROPERTY_SPREADSHEET_ID);

    if (!spreadsheetId) {
      throw new Error('Propriedade SPREADSHEET_ID não configurada no Apps Script.');
    }

    return SpreadsheetApp.openById(spreadsheetId);
  }

  function getSheet_(sheetName) {
    const sheet = getSpreadsheet_().getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('Aba não encontrada: ' + sheetName);
    }

    return sheet;
  }

  function headers_(sheet) {
    const lastColumn = sheet.getLastColumn();
    return sheet
      .getRange(1, 1, 1, lastColumn)
      .getDisplayValues()[0]
      .map(function (header) {
        return String(header || '').trim();
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
    return existingHeaders.concat(missing);
  }

  function readObjectsWithRowNumbers(sheetName) {
    const sheet = getSheet_(sheetName);
    const range = sheet.getDataRange();
    const values = range.getValues();

    if (!values.length || values.length === 1) return [];

    const headers = headers_(sheet);
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
    if (lastRow < 2) return null;

    const target = String(value == null ? '' : value).trim();
    const columnValues = sheet.getRange(2, fieldIndex + 1, lastRow - 1, 1).getDisplayValues();

    for (let index = 0; index < columnValues.length; index += 1) {
      if (String(columnValues[index][0] || '').trim() === target) {
        const rowNumber = index + 2;
        const rowValues = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];

        return {
          rowNumber: rowNumber,
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
  }

  return {
    readObjects,
    readObjectsWithRowNumbers,
    appendObject,
    findRowByField,
    updateFields,
    ensureColumns,
  };
})();
