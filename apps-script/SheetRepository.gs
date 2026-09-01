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

  function readObjects(sheetName) {
    const sheet = getSheet_(sheetName);
    const range = sheet.getDataRange();
    const values = range.getValues();

    if (!values.length || values.length === 1) {
      return [];
    }

    const headers = sheet
      .getRange(1, 1, 1, range.getNumColumns())
      .getDisplayValues()[0]
      .map(function (header) {
        return String(header || '').trim();
      });

    return values.slice(1)
      .filter(function (row) {
        return row.some(function (cell) {
          return cell !== '' && cell !== null;
        });
      })
      .map(function (row) {
        return headers.reduce(function (record, header, index) {
          if (header) {
            record[header] = row[index] == null ? '' : row[index];
          }
          return record;
        }, {});
      });
  }

  function appendObject(sheetName, record, options) {
    const sheet = getSheet_(sheetName);
    const lastColumn = sheet.getLastColumn();
    const headers = sheet
      .getRange(1, 1, 1, lastColumn)
      .getDisplayValues()[0]
      .map(function (header) {
        return String(header || '').trim();
      });

    const row = headers.map(function (header) {
      if (!header) return '';
      return Object.prototype.hasOwnProperty.call(record, header)
        ? record[header]
        : '';
    });

    const targetRow = sheet.getLastRow() + 1;
    const textFields = options && Array.isArray(options.textFields)
      ? options.textFields
      : [];

    textFields.forEach(function (fieldName) {
      const columnIndex = headers.indexOf(fieldName);
      if (columnIndex >= 0) {
        sheet.getRange(targetRow, columnIndex + 1).setNumberFormat('@');
      }
    });

    sheet.getRange(targetRow, 1, 1, lastColumn).setValues([row]);
    return targetRow;
  }

  return {
    readObjects,
    appendObject,
  };
})();
