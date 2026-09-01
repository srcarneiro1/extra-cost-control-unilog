const PricingService = (() => {
  const DAY_TYPES = Object.freeze({
    UTIL: 'UTIL',
    SABADO: 'SABADO',
    DOMINGO_FERIADO: 'DOMINGO_FERIADO',
  });

  function classifyDay(dateValue, isHoliday) {
    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) {
      throw new Error('Data inválida para classificação do tipo de dia.');
    }

    if (isHoliday) {
      return DAY_TYPES.DOMINGO_FERIADO;
    }

    const weekday = date.getDay();
    if (weekday === 0) return DAY_TYPES.DOMINGO_FERIADO;
    if (weekday === 6) return DAY_TYPES.SABADO;
    return DAY_TYPES.UTIL;
  }

  return {
    DAY_TYPES,
    classifyDay,
  };
})();
