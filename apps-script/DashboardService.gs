const DashboardService = (() => {
  const SOLICITATIONS_SHEET = 'SOLICITACOES';
  const META_SHEET = 'METAS_MO';
  const TYPE_LABOR = 'MAO_DE_OBRA';
  const TYPE_SNACKS = 'ALIMENTACAO_BEBIDA';
  const DAY_MS = 24 * 60 * 60 * 1000;

  function getDashboard(payload) {
    const input = payload || {};
    const selectedCompetence = selectedCompetence_(input);
    const allRows = SheetRepository.readObjects(SOLICITATIONS_SHEET);
    const periodRows = allRows.filter(function (record) {
      return competenceOf_(record) === selectedCompetence;
    });
    const filters = normalizeFilters_(input);
    const filteredRows = periodRows.filter(function (record) {
      return matchesFilters_(record, filters);
    });
    const metaRows = readMetaRows_();
    const metaValue = filters.tipo === TYPE_SNACKS
      ? null
      : metaForCompetence_(metaRows, selectedCompetence);
    const period = competencePeriod_(selectedCompetence);
    const kpis = summarize_(filteredRows, metaValue);
    const projection = projection_(filteredRows, kpis.realizadoMaoObra, metaValue, period);
    const comparison = competenceComparison_(allRows, periodRows, selectedCompetence, filters);

    return {
      competencia: selectedCompetence,
      periodoInicio: DateService.toIsoDate(period.start),
      periodoFim: DateService.toIsoDate(period.end),
      metaEscopo: 'GLOBAL_COMPETENCIA',
      metaFonte: META_SHEET,
      filtros: filterOptions_(allRows, periodRows, selectedCompetence),
      kpis: kpis,
      projecao: projection,
      alertaMeta: metaAlert_(projection),
      comparativoCompetencia: comparison,
      porTipo: group_(filteredRows, function (record) { return typeLabel_(record.TIPO_SOLICITACAO); }),
      porOperacao: group_(filteredRows, function (record) { return record.OPERACAO; }),
      porFornecedor: group_(filteredRows, function (record) { return record.FORNECEDOR; }),
      porSupervisor: group_(filteredRows, function (record) { return record.SUPERVISOR; }),
      porResponsavelCusto: group_(filteredRows, function (record) { return record.RESPONSAVEL_CUSTO; }),
      porAtividade: group_(filteredRows, function (record) { return record.ATIVIDADE; }),
      evolucaoDiaria: daily_(filteredRows),
      evolucaoMetaProjecao: projectionSeries_(filteredRows, metaValue, projection, period),
      analytics: DashboardAnalyticsService.build(filteredRows, period),
    };
  }

  function selectedCompetence_(input) {
    const current = DateService.competence(new Date());
    const currentParts = current.split('-');
    const year = String(input.ano || currentParts[0]).trim();
    const month = String(input.mesCompetencia || currentParts[1]).trim().padStart(2, '0');

    if (!/^\d{4}$/.test(year)) ValidationService.fail('Ano inválido para o dashboard.');
    if (!/^(0[1-9]|1[0-2])$/.test(month)) ValidationService.fail('Mês de competência inválido.');

    return year + '-' + month;
  }

  function normalizeFilters_(input) {
    return {
      operacao: normalizedFilter_(input.operacao),
      supervisor: normalizedFilter_(input.supervisor),
      fornecedor: normalizedFilter_(input.fornecedor),
      tipo: normalizedFilter_(input.tipo),
      responsavelCusto: normalizedFilter_(input.responsavelCusto),
      atividade: normalizedFilter_(input.atividade),
    };
  }

  function normalizedFilter_(value) {
    const normalized = ValidationService.normalizeUpper(value || '');
    return normalized === 'TODOS' ? '' : normalized;
  }

  function matchesFilters_(record, filters) {
    if (filters.operacao && ValidationService.normalizeUpper(record.OPERACAO) !== filters.operacao) return false;
    if (filters.supervisor && ValidationService.normalizeUpper(record.SUPERVISOR) !== filters.supervisor) return false;
    if (filters.fornecedor && ValidationService.normalizeUpper(record.FORNECEDOR) !== filters.fornecedor) return false;
    if (filters.tipo && ValidationService.normalizeUpper(record.TIPO_SOLICITACAO) !== filters.tipo) return false;
    if (filters.responsavelCusto && ValidationService.normalizeUpper(record.RESPONSAVEL_CUSTO) !== filters.responsavelCusto) return false;
    if (filters.atividade && ValidationService.normalizeUpper(record.ATIVIDADE) !== filters.atividade) return false;
    return true;
  }

  function competenceComparison_(allRows, periodRows, selectedCompetence, filters) {
    const period = competencePeriod_(selectedCompetence);
    const cutoff = lastRealizedDate_(periodRows, period);

    if (!cutoff) {
      return {
        disponivel: false,
        criterioCorte: 'ULTIMA_DATA_COM_REALIZADO',
        dataCorte: null,
        diasComparados: 0,
        atual: null,
        anterior: null,
        variacao: null,
      };
    }

    const daysCompared = dayDiff_(period.start, parseIsoDate_(cutoff)) + 1;
    const previousCompetence = previousCompetence_(selectedCompetence);
    const previousPeriod = competencePeriod_(previousCompetence);
    const previousEnd = addDays_(previousPeriod.start, Math.max(daysCompared - 1, 0));
    const currentStartKey = dayKey_(period.start);
    const previousStartKey = dayKey_(previousPeriod.start);
    const previousEndKey = dayKey_(previousEnd);

    const currentRows = (periodRows || []).filter(function (record) {
      const date = safeDate_(record.DATA_OPERACIONAL);
      return date && date >= currentStartKey && date <= cutoff && matchesFilters_(record, filters);
    });

    const previousRows = (allRows || []).filter(function (record) {
      if (competenceOf_(record) !== previousCompetence) return false;
      const date = safeDate_(record.DATA_OPERACIONAL);
      return date && date >= previousStartKey && date <= previousEndKey && matchesFilters_(record, filters);
    });

    const currentSnapshot = comparisonSnapshot_(
      currentRows,
      selectedCompetence,
      currentStartKey,
      cutoff
    );
    const previousSnapshot = comparisonSnapshot_(
      previousRows,
      previousCompetence,
      previousStartKey,
      previousEndKey
    );

    return {
      disponivel: true,
      criterioCorte: 'ULTIMA_DATA_COM_REALIZADO',
      dataCorte: cutoff,
      diasComparados: daysCompared,
      atual: currentSnapshot,
      anterior: previousSnapshot,
      variacao: comparisonVariation_(currentSnapshot, previousSnapshot),
    };
  }

  function lastRealizedDate_(rows, period) {
    const start = dayKey_(period.start);
    const periodEnd = dayKey_(period.end);
    const today = dateOnlyToday_();
    const end = today < periodEnd ? today : periodEnd;
    let latest = '';

    if (end < start) return '';

    (rows || []).forEach(function (record) {
      if (!hasRealizedData_(record)) return;
      const date = safeDate_(record.DATA_OPERACIONAL);
      if (!date || date < start || date > end) return;
      if (!latest || date > latest) latest = date;
    });

    return latest;
  }

  function hasRealizedData_(record) {
    const type = ValidationService.normalizeUpper(record.TIPO_SOLICITACAO);

    if (type === TYPE_LABOR) {
      return hasValue_(record.VALOR_REAL) || hasValue_(record.QTD_COMPARECIDA);
    }

    if (type === TYPE_SNACKS) {
      return hasValue_(record.VALOR_REAL) ||
        hasValue_(record.VALOR_PREVISTO) ||
        hasValue_(record.QTD_ALIMENTACAO) ||
        hasValue_(record.QTD_BEBIDA);
    }

    return false;
  }

  function comparisonSnapshot_(rows, competence, start, end) {
    let laborValue = 0;
    let laborQuantity = 0;
    let snackValue = 0;
    let snackQuantity = 0;

    (rows || []).forEach(function (record) {
      const type = ValidationService.normalizeUpper(record.TIPO_SOLICITACAO);

      if (type === TYPE_LABOR) {
        laborValue += realizedValue_(record);
        laborQuantity += number_(record.QTD_COMPARECIDA);
      } else if (type === TYPE_SNACKS) {
        snackValue += realizedValue_(record);
        snackQuantity += number_(record.QTD_ALIMENTACAO) + number_(record.QTD_BEBIDA);
      }
    });

    return {
      competencia: competence,
      periodoInicio: start,
      periodoFim: end,
      valorMaoObra: round2_(laborValue),
      quantidadeMaoObra: round2_(laborQuantity),
      valorLanches: round2_(snackValue),
      quantidadeLanches: round2_(snackQuantity),
    };
  }

  function comparisonVariation_(current, previous) {
    return {
      valorMaoObraPercentual: percentageChange_(current.valorMaoObra, previous.valorMaoObra),
      quantidadeMaoObraPercentual: percentageChange_(current.quantidadeMaoObra, previous.quantidadeMaoObra),
      valorLanchesPercentual: percentageChange_(current.valorLanches, previous.valorLanches),
      quantidadeLanchesPercentual: percentageChange_(current.quantidadeLanches, previous.quantidadeLanches),
    };
  }

  function percentageChange_(current, previous) {
    if (!previous) return null;
    return round2_(((current - previous) / previous) * 100);
  }

  function previousCompetence_(competence) {
    const parts = competence.split('-');
    const year = Number(parts[0]);
    const monthIndex = Number(parts[1]) - 1;
    return Utilities.formatDate(
      new Date(year, monthIndex - 1, 1, 12, 0, 0, 0),
      DateService.TIMEZONE,
      'yyyy-MM'
    );
  }

  function summarize_(rows, metaValue) {
    let previstoMaoObra = 0;
    let previstoLanches = 0;
    let realizadoMaoObra = 0;
    let realizadoLanches = 0;
    let divergenciasComparecimento = 0;

    (rows || []).forEach(function (record) {
      const type = ValidationService.normalizeUpper(record.TIPO_SOLICITACAO);
      const planned = number_(record.VALOR_PREVISTO);
      const realized = realizedValue_(record);

      if (type === TYPE_LABOR) {
        previstoMaoObra += planned;
        realizadoMaoObra += realized;
        if (attendanceDiverges_(record)) divergenciasComparecimento += 1;
      } else if (type === TYPE_SNACKS) {
        previstoLanches += planned;
        realizadoLanches += realized;
      }
    });

    const previstoTotal = previstoMaoObra + previstoLanches;
    const realizadoTotal = realizadoMaoObra + realizadoLanches;
    const diferencaValor = realizadoTotal - previstoTotal;

    return {
      previstoMaoObra: round2_(previstoMaoObra),
      previstoLanches: round2_(previstoLanches),
      realizadoMaoObra: round2_(realizadoMaoObra),
      realizadoLanches: round2_(realizadoLanches),
      diferencaValor: round2_(diferencaValor),
      diferencaPercentual: previstoTotal ? round2_((diferencaValor / previstoTotal) * 100) : null,
      metaMaoObra: metaValue == null ? null : round2_(metaValue),
      atingimentoMetaPercentual: metaValue ? round2_((realizadoMaoObra / metaValue) * 100) : null,
      totalSolicitacoes: (rows || []).length,
      divergenciasComparecimento: divergenciasComparecimento,
    };
  }

  function projection_(rows, realizadoMaoObra, metaValue, period) {
    const timeline = timeline_(period);
    const exposure = knownLaborExposure_(rows);
    const pace = timeline.elapsedDays > 0 ? realizadoMaoObra / timeline.elapsedDays : null;
    const trend = pace == null ? null : realizadoMaoObra + pace * timeline.remainingDays;
    const finalProjection = trend == null ? (exposure > 0 ? exposure : null) : Math.max(trend, exposure);
    const expectedMeta = metaValue == null ? null : metaValue * (timeline.elapsedDays / timeline.totalDays);
    const projectedPercent = metaValue && finalProjection != null ? (finalProjection / metaValue) * 100 : null;
    const projectedDelta = metaValue != null && finalProjection != null ? finalProjection - metaValue : null;

    return {
      totalDias: timeline.totalDays,
      diasDecorridos: timeline.elapsedDays,
      diasRestantes: timeline.remainingDays,
      ritmoDiarioRealizado: pace == null ? null : round2_(pace),
      metaEsperadaAteHoje: expectedMeta == null ? null : round2_(expectedMeta),
      exposicaoConhecidaMaoObra: round2_(exposure),
      projecaoTendenciaMaoObra: trend == null ? null : round2_(trend),
      projecaoFinalMaoObra: finalProjection == null ? null : round2_(finalProjection),
      percentualMetaProjetado: projectedPercent == null ? null : round2_(projectedPercent),
      desvioProjetadoMeta: projectedDelta == null ? null : round2_(projectedDelta),
    };
  }

  function knownLaborExposure_(rows) {
    return (rows || []).reduce(function (sum, record) {
      if (ValidationService.normalizeUpper(record.TIPO_SOLICITACAO) !== TYPE_LABOR) return sum;
      return sum + (hasValue_(record.VALOR_REAL) ? number_(record.VALOR_REAL) : number_(record.VALOR_PREVISTO));
    }, 0);
  }

  function metaAlert_(projection) {
    const percent = projection.percentualMetaProjetado;

    if (percent == null || projection.projecaoFinalMaoObra == null) {
      return {
        status: 'SEM_PROJECAO',
        titulo: 'Sem projeção disponível',
        mensagem: 'Ainda não há base suficiente para comparar a projeção de mão de obra com a meta da competência.',
        percentualMetaProjetado: null,
        desvioProjetadoMeta: null,
      };
    }

    if (percent <= 95) {
      return {
        status: 'DENTRO_DA_META',
        titulo: 'Dentro da meta',
        mensagem: 'Mantido o ritmo atual, a competência deve encerrar dentro da meta.',
        percentualMetaProjetado: projection.percentualMetaProjetado,
        desvioProjetadoMeta: projection.desvioProjetadoMeta,
      };
    }

    if (percent <= 100) {
      return {
        status: 'NO_LIMITE_DA_META',
        titulo: 'No limite da meta',
        mensagem: 'Mantido o ritmo atual, a competência deve encerrar próxima ao limite da meta.',
        percentualMetaProjetado: projection.percentualMetaProjetado,
        desvioProjetadoMeta: projection.desvioProjetadoMeta,
      };
    }

    return {
      status: 'FORA_DA_META',
      titulo: 'Fora da meta',
      mensagem: 'Mantido o ritmo atual, a projeção supera a meta em ' + formatCurrency_(Math.max(projection.desvioProjetadoMeta || 0, 0)) + '.',
      percentualMetaProjetado: projection.percentualMetaProjetado,
      desvioProjetadoMeta: projection.desvioProjetadoMeta,
    };
  }

  function projectionSeries_(rows, metaValue, projection, period) {
    const laborByDay = {};

    (rows || []).forEach(function (record) {
      if (ValidationService.normalizeUpper(record.TIPO_SOLICITACAO) !== TYPE_LABOR) return;
      const date = safeDate_(record.DATA_OPERACIONAL);
      if (!date) return;
      laborByDay[date] = (laborByDay[date] || 0) + number_(record.VALOR_REAL);
    });

    const points = [];
    const totalDays = projection.totalDias;
    const elapsedDays = projection.diasDecorridos;
    const remainingDays = projection.diasRestantes;
    const projectionFinal = projection.projecaoFinalMaoObra;
    let accumulated = 0;

    for (let index = 0; index < totalDays; index += 1) {
      const date = addDays_(period.start, index);
      const iso = DateService.toIsoDate(date);
      accumulated += number_(laborByDay[iso]);
      const dayNumber = index + 1;
      const realizedVisible = dayNumber <= elapsedDays ? round2_(accumulated) : null;
      const expected = metaValue == null ? null : round2_(metaValue * (dayNumber / totalDays));
      let projected = null;

      if (projectionFinal != null) {
        if (elapsedDays === 0) {
          projected = round2_(projectionFinal * (dayNumber / totalDays));
        } else if (dayNumber === elapsedDays) {
          projected = round2_(accumulated);
        } else if (dayNumber > elapsedDays && remainingDays > 0) {
          const futureIndex = dayNumber - elapsedDays;
          projected = round2_(accumulated + ((projectionFinal - accumulated) * (futureIndex / remainingDays)));
        } else if (elapsedDays === totalDays && dayNumber === totalDays) {
          projected = round2_(projectionFinal);
        }
      }

      points.push({
        data: iso,
        realizadoAcumulado: realizedVisible,
        metaEsperada: expected,
        projecao: projected,
      });
    }

    return points;
  }

  function timeline_(period) {
    const today = dateOnlyToday_();
    const totalDays = dayDiff_(period.start, period.end) + 1;
    let elapsedDays = 0;

    if (today >= dayKey_(period.start) && today <= dayKey_(period.end)) {
      elapsedDays = dayDiff_(period.start, parseIsoDate_(today)) + 1;
    } else if (today > dayKey_(period.end)) {
      elapsedDays = totalDays;
    }

    return {
      totalDays: totalDays,
      elapsedDays: elapsedDays,
      remainingDays: Math.max(totalDays - elapsedDays, 0),
    };
  }

  function dateOnlyToday_() {
    return Utilities.formatDate(new Date(), DateService.TIMEZONE, 'yyyy-MM-dd');
  }

  function dayKey_(date) {
    return Utilities.formatDate(date, DateService.TIMEZONE, 'yyyy-MM-dd');
  }

  function parseIsoDate_(iso) {
    const parts = String(iso).split('-');
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 12, 0, 0, 0);
  }

  function dayDiff_(start, end) {
    const startUtc = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
    const endUtc = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
    return Math.round((endUtc - startUtc) / DAY_MS);
  }

  function addDays_(date, amount) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount, 12, 0, 0, 0);
  }

  function group_(rows, keyFn) {
    const grouped = {};

    (rows || []).forEach(function (record) {
      const key = ValidationService.normalizeText(keyFn(record)) || 'NÃO INFORMADO';
      if (!grouped[key]) {
        grouped[key] = { chave: key, previsto: 0, realizado: 0, diferenca: 0, solicitacoes: 0 };
      }
      grouped[key].previsto += number_(record.VALOR_PREVISTO);
      grouped[key].realizado += realizedValue_(record);
      grouped[key].solicitacoes += 1;
    });

    return Object.keys(grouped).map(function (key) {
      const item = grouped[key];
      item.previsto = round2_(item.previsto);
      item.realizado = round2_(item.realizado);
      item.diferenca = round2_(item.realizado - item.previsto);
      return item;
    }).sort(function (a, b) {
      if (b.realizado !== a.realizado) return b.realizado - a.realizado;
      return b.previsto - a.previsto;
    });
  }

  function daily_(rows) {
    const grouped = {};

    (rows || []).forEach(function (record) {
      const date = safeDate_(record.DATA_OPERACIONAL);
      if (!date) return;
      if (!grouped[date]) grouped[date] = { data: date, previsto: 0, realizado: 0 };
      grouped[date].previsto += number_(record.VALOR_PREVISTO);
      grouped[date].realizado += realizedValue_(record);
    });

    return Object.keys(grouped).sort().map(function (date) {
      return {
        data: date,
        previsto: round2_(grouped[date].previsto),
        realizado: round2_(grouped[date].realizado),
      };
    });
  }

  function filterOptions_(allRows, periodRows, selectedCompetence) {
    const years = {};
    const months = {};
    const selectedYear = String(selectedCompetence || '').slice(0, 4);

    (allRows || []).forEach(function (record) {
      if (!isValidSolicitation_(record)) return;
      const competence = competenceOf_(record);
      const year = competence.slice(0, 4);
      const month = competence.slice(5, 7);
      years[year] = true;
      if (year === selectedYear) months[month] = true;
    });

    return {
      anos: Object.keys(years).sort().reverse(),
      mesesCompetencia: Object.keys(months).sort(),
      operacoes: distinct_(periodRows, 'OPERACAO'),
      supervisores: distinct_(periodRows, 'SUPERVISOR'),
      fornecedores: distinct_(periodRows, 'FORNECEDOR'),
      responsaveisCusto: distinct_(periodRows, 'RESPONSAVEL_CUSTO'),
      atividades: distinct_(periodRows, 'ATIVIDADE'),
    };
  }

  function isValidSolicitation_(record) {
    const id = ValidationService.normalizeText(record.ID_SOLICITACAO);
    if (!id) return false;
    const type = ValidationService.normalizeUpper(record.TIPO_SOLICITACAO);
    if (type !== TYPE_LABOR && type !== TYPE_SNACKS) return false;
    return /^\d{4}-\d{2}$/.test(competenceOf_(record));
  }

  function distinct_(rows, field) {
    const values = {};
    (rows || []).forEach(function (record) {
      const value = ValidationService.normalizeText(record[field]);
      if (value) values[value] = true;
    });
    return Object.keys(values).sort(function (a, b) { return a.localeCompare(b); });
  }

  function competenceOf_(record) {
    const stored = ValidationService.normalizeText(record.COMPETENCIA);
    if (/^\d{4}-\d{2}$/.test(stored)) return stored;
    if (!record.DATA_OPERACIONAL) return '';
    try {
      return DateService.competence(record.DATA_OPERACIONAL);
    } catch (error) {
      return '';
    }
  }

  function competencePeriod_(competence) {
    const parts = competence.split('-');
    const year = Number(parts[0]);
    const monthIndex = Number(parts[1]) - 1;
    return {
      start: new Date(year, monthIndex - 1, 21, 12, 0, 0, 0),
      end: new Date(year, monthIndex, 20, 12, 0, 0, 0),
    };
  }

  function readMetaRows_() {
    try {
      const spreadsheet = SheetRepository.getSpreadsheet();
      const sheet = spreadsheet.getSheetByName(META_SHEET);
      if (!sheet) return [];
      const values = sheet.getDataRange().getValues();
      if (values.length <= 1) return [];

      return values.slice(1).map(function (row) {
        const rawCompetence = row[0];
        const meta = number_(row[1]);
        if (!rawCompetence || !meta) return null;
        const competence = normalizeMetaCompetence_(rawCompetence);
        if (!competence) return null;
        return { competencia: competence, meta: meta };
      }).filter(Boolean);
    } catch (error) {
      return [];
    }
  }

  function normalizeMetaCompetence_(value) {
    if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
      return Utilities.formatDate(value, DateService.TIMEZONE, 'yyyy-MM');
    }
    const text = String(value || '').trim();
    if (/^\d{4}-\d{2}$/.test(text)) return text.slice(0, 7);
    try {
      return DateService.toIsoDate(value).slice(0, 7);
    } catch (error) {
      return '';
    }
  }

  function metaForCompetence_(metaRows, competence) {
    const match = (metaRows || []).filter(function (item) {
      return item.competencia === competence;
    })[0];
    return match ? match.meta : null;
  }

  function realizedValue_(record) {
    const type = ValidationService.normalizeUpper(record.TIPO_SOLICITACAO);
    if (type === TYPE_SNACKS && !hasValue_(record.VALOR_REAL)) return number_(record.VALOR_PREVISTO);
    return number_(record.VALOR_REAL);
  }

  function attendanceDiverges_(record) {
    if (!hasValue_(record.QTD_COMPARECIDA)) return false;
    const requested = Number(record.QTD_SOLICITADA);
    const attended = Number(record.QTD_COMPARECIDA);
    if (!Number.isFinite(requested) || !Number.isFinite(attended)) return false;
    return requested !== attended;
  }

  function typeLabel_(value) {
    const normalized = ValidationService.normalizeUpper(value);
    if (normalized === TYPE_LABOR) return 'MÃO DE OBRA';
    if (normalized === TYPE_SNACKS) return 'LANCHES';
    return ValidationService.normalizeText(value) || 'NÃO INFORMADO';
  }

  function safeDate_(value) {
    if (!value) return '';
    try {
      return DateService.toIsoDate(value);
    } catch (error) {
      return '';
    }
  }

  function formatCurrency_(value) {
    const number = round2_(value);
    return 'R$ ' + number.toFixed(2).replace('.', ',');
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

  return { getDashboard };
})();
