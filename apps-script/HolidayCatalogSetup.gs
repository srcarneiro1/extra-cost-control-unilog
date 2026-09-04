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

  // A aba já existia em uma estrutura anterior no projeto.
  // Para evitar cabeçalhos incompatíveis, linhas deslocadas e duplicidades,
  // este setup reconstrói o catálogo oficial de 2026 de forma determinística.
  sheet.clearContents();

  sheet
    .getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold');

  sheet
    .getRange(2, 1, rows.length, headers.length)
    .setValues(rows);

  sheet.getRange('A:A').setNumberFormat('@');
  sheet.setFrozenRows(1);
  sheet.autoResizeColumns(1, headers.length);

  const result = {
    sheet: sheetName,
    totalOficial2026: rows.length,
    registrosGravados: rows.length,
  };

  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
