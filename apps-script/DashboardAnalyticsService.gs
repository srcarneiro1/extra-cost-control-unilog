const DashboardAnalyticsService = (() => {
  const TYPE_LABOR = 'MAO_DE_OBRA';
  const TYPE_SNACKS = 'ALIMENTACAO_BEBIDA';
  const WEEKDAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  function build(rows, period) {
    const records = rows || [];
    const weekday = weekdaySummary_(records);
    const operations = aggregateBy_(records, 'OPERACAO');
    const supervisors = aggregateBy_(records, 'SUPERVISOR');
    const pareto = buildPareto_(operations);
    const heatmap = buildHeatmap_(records, operations);
    const linearity = buildLinearity_(records, operations, period);
    const totalRealized = operations.reduce(function (sum, item) { return sum + item.realizado; }, 0);
    const top5Value = pareto.slice(0, 5).reduce(function (sum, item) { return sum + item.realizado; }, 0);
    const top5Percent = totalRealized ? (top5Value / totalRealized) * 100 : 0;

    return {
      diasSemana: weekday,
      paretoOperacao: pareto,
      concentracaoTop5Percentual: round2_(top5Percent),
      concentracaoTop5Valor: round2_(top5Value),
      matrizOperacaoDiaSemana: heatmap,
      linearidadeOperacao: linearity,
      maiorDesvio: greatestDeviation_(operations),
      oportunidades: opportunities_(records, weekday, operations, supervisors, linearity),
      potencialReducao: null,
      metodologiaPotencialReducao: 'NÃO CALCULADO: requer regra de negócio validada antes de estimar economia.',
    };
  }

  function weekdaySummary_(rows) {
    const result = WEEKDAYS.map(function (label) {
      return { chave: label, previsto: 0, realizado: 0, solicitacoes: 0 };
    });
    (rows || []).forEach(function (record) {
      const index = weekdayIndex_(record.DATA_OPERACIONAL);
      if (index < 0) return;
      result[index].previsto += number_(record.VALOR_PREVISTO);
      result[index].realizado += realizedValue_(record);
      result[index].solicitacoes += 1;
    });
    return result.map(function (item) {
      return {
        chave: item.chave,
        previsto: round2_(item.previsto),
        realizado: round2_(item.realizado),
        solicitacoes: item.solicitacoes,
      };
    });
  }

  function aggregateBy_(rows, field) {
    const grouped = {};
    (rows || []).forEach(function (record) {
      const key = ValidationService.normalizeText(record[field]) || 'NÃO INFORMADO';
      if (!grouped[key]) grouped[key] = { chave: key, previsto: 0, realizado: 0, solicitacoes: 0 };
      grouped[key].previsto += number_(record.VALOR_PREVISTO);
      grouped[key].realizado += realizedValue_(record);
      grouped[key].solicitacoes += 1;
    });
    return Object.keys(grouped).map(function (key) {
      const item = grouped[key];
      return {
        chave: key,
        previsto: round2_(item.previsto),
        realizado: round2_(item.realizado),
        diferenca: round2_(item.realizado - item.previsto),
        solicitacoes: item.solicitacoes,
      };
    }).sort(function (a, b) { return b.realizado - a.realizado; });
  }

  function buildPareto_(operations) {
    const total = (operations || []).reduce(function (sum, item) { return sum + item.realizado; }, 0);
    let accumulated = 0;
    return (operations || []).map(function (item) {
      accumulated += item.realizado;
      return {
        chave: item.chave,
        realizado: round2_(item.realizado),
        previsto: round2_(item.previsto),
        solicitacoes: item.solicitacoes,
        percentual: round2_(total ? (item.realizado / total) * 100 : 0),
        acumulado: round2_(total ? (accumulated / total) * 100 : 0),
      };
    });
  }

  function buildHeatmap_(rows, operations) {
    const map = {};
    (operations || []).forEach(function (item) {
      map[item.chave] = { operacao: item.chave, total: 0, valores: [0, 0, 0, 0, 0, 0, 0] };
    });
    (rows || []).forEach(function (record) {
      const operation = ValidationService.normalizeText(record.OPERACAO) || 'NÃO INFORMADO';
      const index = weekdayIndex_(record.DATA_OPERACIONAL);
      if (index < 0 || !map[operation]) return;
      const value = realizedValue_(record);
      map[operation].valores[index] += value;
      map[operation].total += value;
    });
    return (operations || []).map(function (item) {
      const current = map[item.chave];
      return {
        operacao: current.operacao,
        total: round2_(current.total),
        valores: current.valores.map(round2_),
      };
    });
  }

  function buildLinearity_(rows, operations, period) {
    const dates = analysisDates_(period);
    const dateSet = {};
    dates.forEach(function (date) { dateSet[date] = true; });
    const daily = {};
    (operations || []).forEach(function (item) { daily[item.chave] = {}; });
    (rows || []).forEach(function (record) {
      const operation = ValidationService.normalizeText(record.OPERACAO) || 'NÃO INFORMADO';
      if (!daily[operation]) return;
      const date = safeDate_(record.DATA_OPERACIONAL);
      if (!date || !dateSet[date]) return;
      daily[operation][date] = (daily[operation][date] || 0) + realizedValue_(record);
    });

    return (operations || []).map(function (operation) {
      const values = dates.map(function (date) { return number_(daily[operation.chave][date]); });
      const activeDays = values.filter(function (value) { return value > 0; }).length;
      const mean = values.length ? values.reduce(function (sum, value) { return sum + value; }, 0) / values.length : 0;
      const variance = values.length ? values.reduce(function (sum, value) { return sum + Math.pow(value - mean, 2); }, 0) / values.length : 0;
      const deviation = Math.sqrt(variance);
      const cv = mean ? (deviation / mean) * 100 : 0;
      const linearityIndex = mean ? Math.max(0, 100 - Math.min(cv, 100)) : 0;
      const recurrence = dates.length ? (activeDays / dates.length) * 100 : 0;
      return {
        operacao: operation.chave,
        custo: operation.realizado,
        previsto: operation.previsto,
        solicitacoes: operation.solicitacoes,
        diasObservados: dates.length,
        diasAtivos: activeDays,
        coeficienteVariacao: round2_(cv),
        indiceLinearidade: round2_(linearityIndex),
        recorrenciaPercentual: round2_(recurrence),
      };
    }).sort(function (a, b) { return b.custo - a.custo; });
  }

  function greatestDeviation_(operations) {
    if (!operations || !operations.length) return null;
    let selected = operations[0];
    operations.forEach(function (item) {
      if (Math.abs(item.diferenca) > Math.abs(selected.diferenca)) selected = item;
    });
    return {
      chave: selected.chave,
      previsto: selected.previsto,
      realizado: selected.realizado,
      diferenca: selected.diferenca,
      diferencaPercentual: selected.previsto ? round2_((selected.diferenca / selected.previsto) * 100) : null,
    };
  }

  function opportunities_(rows, weekday, operations, supervisors, linearity) {
    const result = [];
    const total = (operations || []).reduce(function (sum, item) { return sum + item.realizado; }, 0);
    const weekdayTotal = (weekday || []).reduce(function (sum, item) { return sum + item.realizado; }, 0);
    const topWeekday = (weekday || []).reduce(function (selected, item) {
      return !selected || item.realizado > selected.realizado ? item : selected;
    }, null);

    if (topWeekday && weekdayTotal > 0) {
      const share = (topWeekday.realizado / weekdayTotal) * 100;
      if (share >= 25) result.push({
        severidade: share >= 35 ? 'ALTA' : 'MEDIA',
        titulo: topWeekday.chave + ' concentra ' + formatPercent_(share) + ' do custo',
        evidencia: 'Maior concentração de custo realizado por dia da semana.',
        acao: 'Revisar distribuição da demanda e dimensionamento operacional nesse dia.',
      });
    }

    const topOperation = operations && operations.length ? operations[0] : null;
    if (topOperation && total > 0) {
      const share = (topOperation.realizado / total) * 100;
      if (share >= 35) result.push({
        severidade: share >= 50 ? 'ALTA' : 'MEDIA',
        titulo: topOperation.chave + ' representa ' + formatPercent_(share) + ' do custo',
        evidencia: 'Existe concentração relevante do custo realizado em um único depositante.',
        acao: 'Priorizar revisão de dimensionamento, recorrência e fornecedores dessa operação.',
      });
    }

    const supervisorTotal = (supervisors || []).reduce(function (sum, item) { return sum + item.realizado; }, 0);
    const topSupervisor = supervisors && supervisors.length ? supervisors[0] : null;
    if (topSupervisor && supervisorTotal > 0) {
      const share = (topSupervisor.realizado / supervisorTotal) * 100;
      if (share >= 35) result.push({
        severidade: 'INFO',
        titulo: topSupervisor.chave + ' responde por ' + formatPercent_(share) + ' do custo supervisionado',
        evidencia: 'A concentração permite direcionar a análise de causa para uma parcela relevante do gasto.',
        acao: 'Revisar padrão de solicitação e necessidade operacional junto à supervisão.',
      });
    }

    const divergences = countAttendanceDivergences_(rows);
    if (divergences > 0) result.push({
      severidade: 'MEDIA',
      titulo: divergences + ' solicitação(ões) com divergência de comparecimento',
      evidencia: 'A quantidade realizada divergiu da quantidade inicialmente solicitada.',
      acao: 'Avaliar dimensionamento solicitado versus comparecimento efetivo.',
    });

    const irregular = (linearity || []).filter(function (item) {
      return item.custo > 0 && item.indiceLinearidade < 40;
    })[0];
    if (irregular) result.push({
      severidade: 'INFO',
      titulo: irregular.operacao + ' apresenta baixa linearidade',
      evidencia: 'Índice de linearidade de ' + formatPercent_(irregular.indiceLinearidade) + ' e CV de ' + formatPercent_(irregular.coeficienteVariacao) + '.',
      acao: 'Verificar se existem picos de demanda que possam ser antecipados ou redistribuídos.',
    });

    if (!result.length) result.push({
      severidade: 'INFO',
      titulo: 'Nenhum sinal material pelos critérios atuais',
      evidencia: 'Não foi identificada concentração ou divergência suficiente para gerar alerta automático.',
      acao: 'Manter acompanhamento da competência e validar comportamento nas próximas janelas.',
    });

    return result.slice(0, 5);
  }

  function countAttendanceDivergences_(rows) {
    let total = 0;
    (rows || []).forEach(function (record) {
      if (ValidationService.normalizeUpper(record.TIPO_SOLICITACAO) !== TYPE_LABOR) return;
      if (!hasValue_(record.QTD_COMPARECIDA)) return;
      const requested = Number(record.QTD_SOLICITADA);
      const attended = Number(record.QTD_COMPARECIDA);
      if (Number.isFinite(requested) && Number.isFinite(attended) && requested !== attended) total += 1;
    });
    return total;
  }

  function analysisDates_(period) {
    if (!period || !period.start || !period.end) return [];
    const today = parseIsoDate_(Utilities.formatDate(new Date(), DateService.TIMEZONE, 'yyyy-MM-dd'));
    let end = period.end;
    if (today.getTime() < end.getTime()) end = today;
    if (end.getTime() < period.start.getTime()) return [];
    const result = [];
    let cursor = new Date(period.start.getFullYear(), period.start.getMonth(), period.start.getDate(), 12, 0, 0, 0);
    while (cursor.getTime() <= end.getTime()) {
      result.push(DateService.toIsoDate(cursor));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() + 1, 12, 0, 0, 0);
    }
    return result;
  }

  function weekdayIndex_(value) {
    const iso = safeDate_(value);
    if (!iso) return -1;
    const date = parseIsoDate_(iso);
    return (date.getDay() + 6) % 7;
  }

  function parseIsoDate_(iso) {
    const parts = String(iso).split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0, 0);
  }

  function safeDate_(value) {
    if (!value) return '';
    try { return DateService.toIsoDate(value); } catch (error) { return ''; }
  }

  function realizedValue_(record) {
    const type = ValidationService.normalizeUpper(record.TIPO_SOLICITACAO);
    if (type === TYPE_SNACKS && !hasValue_(record.VALOR_REAL)) return number_(record.VALOR_PREVISTO);
    return number_(record.VALOR_REAL);
  }

  function formatPercent_(value) {
    return round2_(value).toFixed(1).replace('.', ',') + '%';
  }

  function hasValue_(value) {
    return value !== '' && value !== null && value !== undefined;
  }

  function number_(value) {
    if (!hasValue_(value)) return 0;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function round2_(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  return { build };
})();
