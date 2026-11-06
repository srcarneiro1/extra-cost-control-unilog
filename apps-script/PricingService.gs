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

  // Acordos comerciais (05/11/2026): se houver acordo ativo para fornecedor + operação (+ função,
  // turno, tipo de dia e supervisor, quando definidos) na data operacional, ele tem prioridade.
  // Sem acordo, segue a tabela PRECOS_MO como antes. Retorna também a origem do preço.
  function resolveLaborPrice(params) {
    const date = DateService.parseDateOnly(params.date);
    const dayType = classifyDay(date);
    const feriadoSerra = dayType === DAY_TYPES.DOMINGO_FERIADO && HolidayService.isSerraHoliday(date);

    if (params.operation) {
      const confirmedId = String(params.confirmedAgreementId || '').trim();
      const agreement = AgreementService.findApplicable({
        provider: params.provider,
        operation: params.operation,
        supervisor: params.supervisor,
        role: params.role,
        shift: params.shift,
        dayType: dayType,
        date: date,
        confirmedId: confirmedId,
      });
      // Acordo confirmado na triagem que não se encaixa: avisa em vez de cair na tabela em silêncio.
      // (Na correção, confirmedOptional=true: se as condições mudaram, segue a tabela.)
      if (confirmedId && !params.confirmedOptional && (!agreement || agreement.id !== confirmedId)) {
        const info = AgreementService.summary(confirmedId);
        ValidationService.fail('O acordo ' + confirmedId + ' não se aplica a esta solicitação' +
          (info && info.fornecedor ? ' (vale para o fornecedor ' + info.fornecedor + ', na vigência e condições cadastradas)' : '') +
          '. Ajuste o fornecedor ou use o preço da tabela.');
      }
      if (agreement) {
        return { price: agreement.price, dayType: dayType, feriadoSerra: feriadoSerra, origem: 'ACORDO', idAcordo: agreement.id };
      }
    }

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
      feriadoSerra: feriadoSerra,
      origem: 'TABELA',
      idAcordo: '',
    };
  }

  // Colunas de rastreabilidade do preço na solicitação (criadas sem apagar nada).
  // Registros antigos ficam com ORIGEM_PRECO vazio = tabela.
  function ensureOriginColumns() {
    SheetRepository.ensureColumns('SOLICITACOES', ['ORIGEM_PRECO', 'ID_ACORDO_APLICADO', 'ID_ACORDO_INDICADO']);
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
    ensureOriginColumns,
    resolveProductPrice,
  };
})();
