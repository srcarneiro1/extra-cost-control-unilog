const PricingService = (() => {
  const DAY_TYPES = Object.freeze({
    UTIL: 'UTIL',
    SABADO: 'SABADO',
    DOMINGO_FERIADO: 'DOMINGO_FERIADO',
  });

  function classifyDay(dateValue) {
    const date = DateService.parseDateOnly(dateValue);

    if (HolidayService.isSerraHoliday(date)) {
      return DAY_TYPES.DOMINGO_FERIADO;
    }

    const weekday = date.getDay();
    if (weekday === 0) return DAY_TYPES.DOMINGO_FERIADO;
    if (weekday === 6) return DAY_TYPES.SABADO;
    return DAY_TYPES.UTIL;
  }

  function resolveLaborPrice(params) {
    const date = DateService.parseDateOnly(params.date);
    const dayType = classifyDay(date);
    const rows = SheetRepository.readObjects('PRECOS_MO');

    const candidates = rows.filter(function (row) {
      return ValidationService.isTruthy(row.ATIVO) &&
        ValidationService.normalizeUpper(row.FORNECEDOR) === ValidationService.normalizeUpper(params.provider) &&
        ValidationService.normalizeUpper(row.FUNCAO) === ValidationService.normalizeUpper(params.role) &&
        ValidationService.normalizeUpper(row.TURNO) === ValidationService.normalizeUpper(params.shift) &&
        ValidationService.normalizeUpper(row.TIPO_DIA) === dayType &&
        isWithinValidity_(date, row.VIGENCIA_INICIO, row.VIGENCIA_FIM);
    });

    if (!candidates.length) {
      ValidationService.fail(
        'Preço de mão de obra não encontrado para fornecedor, função, turno, tipo de dia e vigência informados.'
      );
    }

    candidates.sort(function (a, b) {
      return DateService.compareDateOnly(b.VIGENCIA_INICIO, a.VIGENCIA_INICIO);
    });

    return {
      price: toNumber_(candidates[0].PRECO_UNITARIO),
      dayType: dayType,
      feriadoSerra: dayType === DAY_TYPES.DOMINGO_FERIADO && HolidayService.isSerraHoliday(date),
    };
  }

  function resolveProductPrice(params) {
    const date = DateService.parseDateOnly(params.date);
    const rows = SheetRepository.readObjects('PRECOS_PRODUTOS');

    const candidates = rows.filter(function (row) {
      return ValidationService.isTruthy(row.ATIVO) &&
        ValidationService.normalizeUpper(row.FORNECEDOR) === ValidationService.normalizeUpper(params.provider) &&
        ValidationService.normalizeUpper(row.PRODUTO) === ValidationService.normalizeUpper(params.product) &&
        isWithinValidity_(date, row.VIGENCIA_INICIO, row.VIGENCIA_FIM);
    });

    if (!candidates.length) {
      ValidationService.fail('Preço de produto não encontrado para fornecedor, produto e vigência informados.');
    }

    candidates.sort(function (a, b) {
      return DateService.compareDateOnly(b.VIGENCIA_INICIO, a.VIGENCIA_INICIO);
    });

    return toNumber_(candidates[0].PRECO_UNITARIO);
  }

  function isWithinValidity_(date, startValue, endValue) {
    if (!startValue) return false;

    const start = DateService.parseDateOnly(startValue);
    if (date.getTime() < start.getTime()) return false;

    if (!endValue) return true;
    const end = DateService.parseDateOnly(endValue);
    return date.getTime() <= end.getTime();
  }

  function toNumber_(value) {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) {
        ValidationService.fail('Preço unitário inválido na tabela de preços.');
      }
      return value;
    }

    const text = String(value || '').trim();
    let normalized = text;

    if (text.indexOf(',') >= 0 && text.indexOf('.') >= 0) {
      normalized = text.lastIndexOf(',') > text.lastIndexOf('.')
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '');
    } else if (text.indexOf(',') >= 0) {
      normalized = text.replace(',', '.');
    }

    const parsed = Number(normalized);

    if (!Number.isFinite(parsed)) {
      ValidationService.fail('Preço unitário inválido na tabela de preços.');
    }

    return parsed;
  }

  return {
    DAY_TYPES,
    classifyDay,
    resolveLaborPrice,
    resolveProductPrice,
  };
})();
