const CatalogAdminStructuredEntityService = (() => {
  const HOLIDAY_SHEET = 'CAD_FERIADOS';
  const GOAL_SHEET = 'METAS_MO';

  function execute(payload) {
    const input = payload || {};
    const action = ValidationService.normalizeUpper(input.acao || '');

    if (action === 'SALVAR_FERIADO') return saveHoliday_(input);
    if (action === 'SALVAR_META_MO') return saveGoal_(input);

    ValidationService.fail('Ação de cadastro estruturado inválida.');
  }

  function saveHoliday_(input) {
    const data = DateService.toIsoDate(
      DateService.parseDateOnly(
        ValidationService.requiredText(input.data, 'Data')
      )
    );
    const denominacao = ValidationService.requiredText(input.denominacao, 'Denominação');
    const tipo = ValidationService.normalizeUpper(input.tipo || 'FERIADO');
    const municipio = ValidationService.normalizeUpper(input.municipio || 'SERRA');
    const uf = ValidationService.normalizeUpper(input.uf || 'ES');
    const fonte = ValidationService.normalizeText(input.fonte || '');
    const ativo = input.ativo !== false;

    SheetRepository.ensureColumns(HOLIDAY_SHEET, [
      'DATA', 'DENOMINACAO', 'TIPO', 'MUNICIPIO', 'UF', 'ATIVO', 'FONTE',
    ]);

    const values = {
      DATA: data,
      DENOMINACAO: denominacao,
      TIPO: tipo,
      MUNICIPIO: municipio,
      UF: uf,
      ATIVO: ativo ? 'SIM' : 'NAO',
      FONTE: fonte,
    };

    const existing = SheetRepository.findRowByField(HOLIDAY_SHEET, 'DATA', data);
    if (existing) {
      SheetRepository.updateFields(HOLIDAY_SHEET, existing.rowNumber, values, { textFields: ['DATA'] });
    } else {
      SheetRepository.appendObject(HOLIDAY_SHEET, values, { textFields: ['DATA'] });
    }

    return {
      data: data,
      denominacao: denominacao,
      tipo: tipo,
      municipio: municipio,
      uf: uf,
      ativo: ativo,
      fonte: fonte,
    };
  }

  function saveGoal_(input) {
    const competencia = normalizeCompetence_(
      ValidationService.requiredText(input.competencia, 'Competência')
    );
    const valor = Number(input.valor);

    if (!competencia) {
      ValidationService.fail('Competência inválida. Use o formato AAAA-MM.');
    }
    if (!Number.isFinite(valor) || valor <= 0) {
      ValidationService.fail('Informe uma meta de mão de obra maior que zero.');
    }

    const spreadsheet = SheetRepository.getSpreadsheet();
    let sheet = spreadsheet.getSheetByName(GOAL_SHEET);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(GOAL_SHEET);
      sheet.getRange(1, 1, 1, 2).setValues([['COMPETENCIA', 'META_MO']]).setFontWeight('bold');
      sheet.getRange('A:A').setNumberFormat('@');
      sheet.setFrozenRows(1);
    }

    const lastRow = sheet.getLastRow();
    let targetRow = 0;
    if (lastRow > 1) {
      const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
      values.some(function (row, index) {
        if (normalizeCompetence_(row[0]) === competencia) {
          targetRow = index + 2;
          return true;
        }
        return false;
      });
    }

    if (!targetRow) targetRow = lastRow + 1;
    sheet.getRange(targetRow, 1).setNumberFormat('@').setValue(competencia);
    sheet.getRange(targetRow, 2).setValue(valor);

    try {
      DashboardCacheService.clear();
    } catch (error) {
      // Falha de cache não bloqueia a gravação da meta.
    }

    return {
      competencia: competencia,
      valor: valor,
    };
  }

  function normalizeCompetence_(value) {
    const text = String(value == null ? '' : value).trim();
    if (/^\d{4}-\d{2}$/.test(text)) return text;

    if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
      return Utilities.formatDate(value, DateService.TIMEZONE, 'yyyy-MM');
    }

    try {
      return DateService.toIsoDate(value).slice(0, 7);
    } catch (error) {
      return '';
    }
  }

  return {
    execute,
  };
})();