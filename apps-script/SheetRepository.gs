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

  function readObjects(sheetName) {
    const sheet = getSpreadsheet_().getSheetByName(sheetName);

    if (!sheet) {
      throw new Error('Aba não encontrada: ' + sheetName);
    }

    const values = sheet.getDataRange().getDisplayValues();
    if (!values.length || values.length === 1) {
      return [];
    }

    const headers = values[0].map(function (header) {
      return String(header || '').trim();
    });

    return values.slice(1)
      .filter(function (row) {
        return row.some(function (cell) { return String(cell || '').trim() !== ''; });
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

  return {
    readObjects,
  };
})();
