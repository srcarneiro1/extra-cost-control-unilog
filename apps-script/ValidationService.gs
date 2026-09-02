const ValidationService = (() => {
  function fail(message, details) {
    const error = new Error(message);
    error.name = 'ValidationError';
    error.details = details || null;
    throw error;
  }

  function normalizeText(value) {
    return String(value == null ? '' : value).trim();
  }

  function normalizeUpper(value) {
    return normalizeText(value).toUpperCase();
  }

  function requiredText(value, label) {
    const normalized = normalizeText(value);
    if (!normalized) {
      fail(label + ' é obrigatório.');
    }
    return normalized;
  }

  function enumValue(value, label, allowedValues) {
    const normalized = normalizeUpper(value);
    if (allowedValues.indexOf(normalized) === -1) {
      fail(label + ' inválido. Valores aceitos: ' + allowedValues.join(', ') + '.');
    }
    return normalized;
  }

  function positiveInteger(value, label) {
    const numberValue = Number(value);
    if (!Number.isInteger(numberValue) || numberValue <= 0) {
      fail(label + ' deve ser um número inteiro maior que zero.');
    }
    return numberValue;
  }

  function nonNegativeInteger(value, label) {
    const numberValue = Number(value);
    if (!Number.isInteger(numberValue) || numberValue < 0) {
      fail(label + ' deve ser um número inteiro maior ou igual a zero.');
    }
    return numberValue;
  }

  function digitsOnly(value, label) {
    const normalized = normalizeText(value);
    if (!/^\d+$/.test(normalized)) {
      fail(label + ' deve conter somente dígitos.');
    }
    return normalized;
  }

  function isTruthy(value) {
    const normalized = normalizeUpper(value);
    return normalized === 'SIM' || normalized === 'TRUE' || normalized === '1' || normalized === 'ATIVO';
  }

  function findActive(rows, fieldName, value, label) {
    const target = normalizeUpper(value);
    const row = rows.find(function (item) {
      return isTruthy(item.ATIVO) && normalizeUpper(item[fieldName]) === target;
    });

    if (!row) {
      fail((label || fieldName) + ' não encontrado ou inativo: ' + normalizeText(value) + '.');
    }

    return row;
  }

  return {
    fail,
    normalizeText,
    normalizeUpper,
    requiredText,
    enumValue,
    positiveInteger,
    nonNegativeInteger,
    digitsOnly,
    isTruthy,
    findActive,
  };
})();
