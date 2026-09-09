const DashboardService = (() => {
  const SOLICITATIONS_SHEET = 'SOLICITACOES';
  const META_SHEET = 'Meta';
  const META_SPREADSHEET_PROPERTY = 'META_SPREADSHEET_ID';
  const DEFAULT_META_SPREADSHEET_ID = '1zKqgj45d1mNa_EFftvOiIXZMA8rOV5G2EVmvoRO5aXM';
  const TYPE_LABOR = 'MAO_DE_OBRA';
  const TYPE_SNACKS = 'ALIMENTACAO_BEBIDA';

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
    const metaValue = filters.tipo === TYPE_SNACKS ? null : metaForCompetence_(metaRows, selectedCompetence);
    const period = competencePeriod_(selectedCompetence);

    return {
      competencia: selectedCompetence,
      periodoInicio: DateService.toIsoDate(period.start),
      periodoFim: DateService.toIsoDate(period.end),
      metaEscopo: 'GLOBAL_COMPETENCIA',
      filtros: filterOptions_(allRows, periodRows, metaRows),
      kpis: summarize_(filteredRows, metaValue),
      porTipo: group_(filteredRows, function (record) {
        return typeLabel_(record.TIPO_SOLICITACAO);
      }),
      porOperacao: group_(filteredRows, function (record) { return record.OPERACAO; }),
      porFornecedor: group_(filteredRows, function (record) { return record.FORNECEDOR; }),
      porSupervisor: group_(filteredRows, function (record) { return record.SUPERVISOR; }),
      porResponsavelCusto: group_(filteredRows, function (record) { return record.RESPONSAVEL_CUSTO; }),
      porAtividade: group_(filteredRows, function (record) { return record.ATIVIDADE; }),
      evolucaoDiaria: daily_(filteredRows),
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
      operacao: ValidationService.normalizeUpper(input.operacao || ''),
      supervisor: ValidationService.normalizeUpper(input.supervisor || ''),
      fornecedor: ValidationService.normalizeUpper(input.fornecedor || ''),
      tipo: ValidationService.normalizeUpper(input.tipo || ''),
      responsavelCusto: ValidationService.normalizeUpper(input.responsavelCusto || ''),
      atividade: ValidationService.normalizeUpper(input.atividade || ''),
    };
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

  function group_(rows, keyFn) {
    const grouped = {};

    (rows || []).forEach(function (record) {
      const key = ValidationService.normalizeText(keyFn(record)) || 'NÃO INFORMADO';
      if (!grouped[key]) {
        grouped[key] = {
          chave: key,
          previsto: 0,
          realizado: 0,
          diferenca: 0,
          solicitacoes: 0,
        };
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

  function filterOptions_(allRows, periodRows, metaRows) {
    const years = {};
    (allRows || []).forEach(function (record) {
      const competence = competenceOf_(record);
      if (/^\d{4}-\d{2}$/.test(competence)) years[competence.slice(0, 4)] = true;
    });
    (metaRows || []).forEach(function (item) {
      if (/^\d{4}-\d{2}$/.test(item.competencia)) years[item.competencia.slice(0, 4)] = true;
    });

    return {
      anos: Object.keys(years).sort().reverse(),
      mesesCompetencia: ['01','02','03','04','05','06','07','08','09','10','11','12'],
      operacoes: distinct_(periodRows, 'OPERACAO'),
      supervisores: distinct_(periodRows, 'SUPERVISOR'),
      fornecedores: distinct_(periodRows, 'FORNECEDOR'),
      responsaveisCusto: distinct_(periodRows, 'RESPONSAVEL_CUSTO'),
      atividades: distinct_(periodRows, 'ATIVIDADE'),
    };
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
    const configuredId = PropertiesService.getScriptProperties().getProperty(META_SPREADSHEET_PROPERTY);
    const spreadsheetId = String(configuredId || DEFAULT_META_SPREADSHEET_ID).trim();
    if (!spreadsheetId) return [];

    try {
      const sheet = SpreadsheetApp.openById(spreadsheetId).getSheetByName(META_SHEET);
      if (!sheet) return [];
      const values = sheet.getDataRange().getValues();
      if (values.length <= 1) return [];

      return values.slice(1).map(function (row) {
        const date = row[0];
        const meta = number_(row[1]);
        if (!date || !meta) return null;
        return {
          competencia: Utilities.formatDate(new Date(date), DateService.TIMEZONE, 'yyyy-MM'),
          meta: meta,
        };
      }).filter(Boolean);
    } catch (error) {
      return [];
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
    if (type === TYPE_SNACKS && !hasValue_(record.VALOR_REAL)) {
      return number_(record.VALOR_PREVISTO);
    }
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

  return {
    getDashboard,
  };
})();
