const HolidayService = (() => {
  const SHEET_FERIADOS = 'CAD_FERIADOS';
  const HOLIDAY_TYPE = 'FERIADO';
  const CITY = 'SERRA';
  const STATE = 'ES';

  function isSerraHoliday(dateValue) {
    const targetDate = DateService.toIsoDate(DateService.parseDateOnly(dateValue));
    const rows = SheetRepository.readObjects(SHEET_FERIADOS);

    return rows.some(function (row) {
      if (!ValidationService.isTruthy(row.ATIVO)) return false;
      if (ValidationService.normalizeUpper(row.TIPO) !== HOLIDAY_TYPE) return false;
      if (ValidationService.normalizeUpper(row.MUNICIPIO) !== CITY) return false;
      if (ValidationService.normalizeUpper(row.UF) !== STATE) return false;
      if (!row.DATA) return false;

      return DateService.toIsoDate(DateService.parseDateOnly(row.DATA)) === targetDate;
    });
  }

  return {
    isSerraHoliday,
  };
})();
