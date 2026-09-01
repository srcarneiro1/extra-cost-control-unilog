const DateService = (() => {
  const TIMEZONE = 'America/Sao_Paulo';

  function parseDateOnly(value) {
    if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
      return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0, 0);
    }

    const text = String(value || '').trim();
    let year;
    let month;
    let day;

    let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (match) {
      year = Number(match[1]);
      month = Number(match[2]);
      day = Number(match[3]);
    } else {
      match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
      if (match) {
        day = Number(match[1]);
        month = Number(match[2]);
        year = Number(match[3]);
      }
    }

    if (!year || !month || !day) {
      ValidationService.fail('Data inválida. Use o formato AAAA-MM-DD.');
    }

    const date = new Date(year, month - 1, day, 12, 0, 0, 0);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      ValidationService.fail('Data operacional inválida.');
    }

    return date;
  }

  function toIsoDate(dateValue) {
    const date = parseDateOnly(dateValue);
    return Utilities.formatDate(date, TIMEZONE, 'yyyy-MM-dd');
  }

  function competence(dateValue) {
    const date = parseDateOnly(dateValue);
    const increment = date.getDate() >= 21 ? 1 : 0;
    const closingMonth = new Date(date.getFullYear(), date.getMonth() + increment, 1, 12, 0, 0, 0);
    return Utilities.formatDate(closingMonth, TIMEZONE, 'yyyy-MM');
  }

  function compareDateOnly(leftValue, rightValue) {
    const left = parseDateOnly(leftValue);
    const right = parseDateOnly(rightValue);
    return left.getTime() - right.getTime();
  }

  return {
    TIMEZONE,
    parseDateOnly,
    toIsoDate,
    competence,
    compareDateOnly,
  };
})();
