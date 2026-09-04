function setupSerraHolidayCatalog2026() {
  const spreadsheetId = PropertiesService
    .getScriptProperties()
    .getProperty('SPREADSHEET_ID');

  if (!spreadsheetId) {
    throw new Error('Propriedade SPREADSHEET_ID não configurada no Apps Script.');
  }

  const spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  const sheetName = 'CAD_FERIADOS';
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  const headers = [
    'DATA',
    'DENOMINACAO',
    'TIPO',
    'MUNICIPIO',
    'UF',
    'ATIVO',
    'FONTE',
  ];

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');

  const rows = [
    ['2026-01-01', 'Confraternização Universal', 'FERIADO', 'SERRA', 'ES', 'SIM', 'Decreto Municipal 1.908/2025'],
    ['2026-04-03', 'Paixão de Cristo', 'FERIADO', 'SERRA', 'ES', 'SIM', 'Decreto Municipal 1.908/2025'],
    ['2026-04-13', 'Nossa Senhora da Penha', 'FERIADO', 'SERRA', 'ES', 'SIM', 'Decreto Municipal 1.908/2025'],
    ['2026-04-21', 'Tiradentes', 'FERIADO', 'SERRA', 'ES', 'SIM', 'Decreto Municipal 1.908/2025'],
    ['2026-05-01', 'Dia do Trabalho', 'FERIADO', 'SERRA', 'ES', 'SIM', 'Decreto Municipal 1.908/2025'],
    ['2026-06-29', 'São Pedro', 'FERIADO', 'SERRA', 'ES', 'SIM', 'Decreto Municipal 1.908/2025'],
    ['2026-09-07', 'Independência do Brasil', 'FERIADO', 'SERRA', 'ES', 'SIM', 'Decreto Municipal 1.908/2025'],
    ['2026-10-12', 'Nossa Senhora Aparecida', 'FERIADO', 'SERRA', 'ES', 'SIM', 'Decreto Municipal 1.908/2025'],
    ['2026-11-02', 'Finados', 'FERIADO', 'SERRA', 'ES', 'SIM', 'Decreto Municipal 1.908/2025'],
    ['2026-11-15', 'Proclamação da República', 'FERIADO', 'SERRA', 'ES', 'SIM', 'Decreto Municipal 1.908/2025'],
    ['2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'FERIADO', 'SERRA', 'ES', 'SIM', 'Decreto Municipal 1.908/2025'],
    ['2026-12-08', 'Nossa Senhora da Conceição', 'FERIADO', 'SERRA', 'ES', 'SIM', 'Decreto Municipal 1.908/2025'],
    ['2026-12-25', 'Natal', 'FERIADO', 'SERRA', 'ES', 'SIM', 'Decreto Municipal 1.908/2025'],
    ['2026-12-26', 'Dia do Serrano', 'FERIADO', 'SERRA', 'ES', 'SIM', 'Decreto Municipal 1.908/2025'],
  ];

  const existing = sheet.getLastRow() > 1
    ? sheet.getRange(2, 1, sheet.getLastRow() - 1, headers.length).getDisplayValues()
    : [];

  const existingKeys = {};
  existing.forEach(function (row) {
    const date = String(row[0] || '').trim();
    const city = String(row[3] || '').trim().toUpperCase();
    const uf = String(row[4] || '').trim().toUpperCase();
    if (date && city && uf) {
      existingKeys[date + '|' + city + '|' + uf] = true;
    }
  });

  const missingRows = rows.filter(function (row) {
    return !existingKeys[row[0] + '|' + row[3] + '|' + row[4]];
  });

  if (missingRows.length) {
    sheet
      .getRange(sheet.getLastRow() + 1, 1, missingRows.length, headers.length)
      .setValues(missingRows);
  }

  sheet.getRange('A:A').setNumberFormat('@');
  sheet.autoResizeColumns(1, headers.length);

  return {
    sheet: sheetName,
    totalOficial2026: rows.length,
    adicionados: missingRows.length,
  };
}
