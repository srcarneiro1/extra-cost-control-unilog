const AdministrativeSolicitationQueryService = (() => {
  const SHEET_SOLICITACOES = 'SOLICITACOES';
  const ACTIONS = Object.freeze({
    LIST: 'LISTAR',
    DETAIL: 'DETALHAR',
    METADATA: 'METADADOS',
  });
  const TYPE_LABOR = 'MAO_DE_OBRA';
  const METADATA_CACHE_KEY = 'admin_solicitations_metadata_v2';
  const METADATA_CACHE_SECONDS = 300;

  function execute(payload) {
    const input = payload || {};
    const action = ValidationService.enumValue(
      input.acao || ACTIONS.LIST,
      'Ação da consulta',
      [ACTIONS.LIST, ACTIONS.DETAIL, ACTIONS.METADATA]
    );

    if (action === ACTIONS.DETAIL) return detail_(input);
    if (action === ACTIONS.METADATA) return metadata_();
    return list_(input);
  }

  function list_(input) {
    const pageSize = normalizePageSize_(input.tamanhoPagina || input.limite);
    const page = normalizePage_(input.pagina);
    const offset = (page - 1) * pageSize;
    const filters = normalizeFilters_(input);
    const hasFilters = hasFilters_(filters);

    let total;
    let rows;
    let summary = null;

    if (!hasFilters) {
      total = SheetRepository.getDataRowCount(SHEET_SOLICITACOES);
      rows = SheetRepository.readObjectsWindowFromEnd(
        SHEET_SOLICITACOES,
        offset,
        pageSize
      );
    } else if (isMonthFilter_(filters)) {
      // Qualquer competência mensal pode usar leitura reversa em blocos.
      // Isso evita carregar toda a aba SOLICITACOES para consultar meses históricos.
      const periodRows = SheetRepository.readObjectsForMonthFromEnd(
        SHEET_SOLICITACOES,
        'DATA_CRIACAO',
        filters.anoRegistro,
        filters.mesRegistro
      );
      const filteredRows = periodRows
        .filter(function (record) {
          return matchesNonPeriodFilters_(record, filters);
        })
        .sort(function (left, right) {
          return sortTimestamp_(right.DATA_CRIACAO) - sortTimestamp_(left.DATA_CRIACAO);
        });

      total = filteredRows.length;
      rows = filteredRows.slice(offset, offset + pageSize);
      summary = summarize_(periodRows);
    } else {
      const allRows = SheetRepository.readObjects(SHEET_SOLICITACOES);
      const periodRows = allRows.filter(function (record) {
        return matchesPeriod_(record, filters);
      });
      const filteredRows = periodRows
        .filter(function (record) {
          return matchesNonPeriodFilters_(record, filters);
        })
        .sort(function (left, right) {
          return sortTimestamp_(right.DATA_CRIACAO) - sortTimestamp_(left.DATA_CRIACAO);
        });

      total = filteredRows.length;
      rows = filteredRows.slice(offset, offset + pageSize);
      summary = summarize_(periodRows);
      writeMetadataCache_(buildMetadata_(allRows));
    }

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    return {
      total: total,
      limite: pageSize,
      pagina: page,
      tamanhoPagina: pageSize,
      totalPaginas: totalPages,
      resumo: summary,
      itens: rows
        .slice()
        .sort(function (left, right) {
          return sortTimestamp_(right.DATA_CRIACAO) - sortTimestamp_(left.DATA_CRIACAO);
        })
        .map(toListItem_),
    };
  }

  function metadata_() {
    const cached = readMetadataCache_();
    if (cached) return cached;

    const result = buildMetadata_(SheetRepository.readObjects(SHEET_SOLICITACOES));
    writeMetadataCache_(result);
    return result;
  }

  function buildMetadata_(rows) {
    const dates = {};
    (rows || []).forEach(function (record) {
      const date = dateOnly_(record.DATA_CRIACAO);
      if (date) dates[date] = true;
    });

    return {
      resumo: summarize_(rows || []),
      datasRegistro: Object.keys(dates).sort().reverse(),
    };
  }

  function summarize_(rows) {
    const summary = {
      total: (rows || []).length,
      aguardandoTriagem: 0,
      aguardandoRealizado: 0,
      divergencias: 0,
    };

    (rows || []).forEach(function (record) {
      const indicators = indicators_(record);

      if (!indicators.triagemConcluida) summary.aguardandoTriagem += 1;
      if (
        ValidationService.normalizeUpper(record.TIPO_SOLICITACAO) === TYPE_LABOR &&
        indicators.triagemConcluida &&
        !indicators.realizadoRegistrado
      ) {
        summary.aguardandoRealizado += 1;
      }
      if (indicators.divergencia) summary.divergencias += 1;
    });

    return summary;
  }

  function detail_(input) {
    const solicitationId = ValidationService.requiredText(
      input.idSolicitacao,
      'ID da solicitação'
    );

    const found = SheetRepository.findRowByField(
      SHEET_SOLICITACOES,
      'ID_SOLICITACAO',
      solicitationId
    );

    if (!found) {
      ValidationService.fail('Solicitação não encontrada: ' + solicitationId + '.');
    }

    return toDetail_(found.record);
  }

  function normalizeFilters_(input) {
    return {
      busca: ValidationService.normalizeUpper(input.busca || ''),
      tipo: ValidationService.normalizeUpper(input.tipo || ''),
      status: ValidationService.normalizeUpper(input.status || ''),
      anoRegistro: ValidationService.normalizeText(input.anoRegistro || ''),
      mesRegistro: ValidationService.normalizeText(input.mesRegistro || ''),
      dataRegistro: ValidationService.normalizeText(input.dataRegistro || ''),
    };
  }

  function hasFilters_(filters) {
    return Boolean(
      filters.busca ||
      filters.tipo ||
      filters.status ||
      filters.anoRegistro ||
      filters.mesRegistro ||
      filters.dataRegistro
    );
  }

  function isMonthFilter_(filters) {
    return Boolean(
      filters.anoRegistro &&
      filters.mesRegistro &&
      !filters.dataRegistro
    );
  }

  function matchesPeriod_(record, filters) {
    const date = dateOnly_(record.DATA_CRIACAO);
    const year = date ? date.slice(0, 4) : '';
    const month = date ? date.slice(5, 7) : '';

    if (filters.anoRegistro && year !== filters.anoRegistro) return false;
    if (filters.mesRegistro && month !== filters.mesRegistro) return false;
    if (filters.dataRegistro && date !== filters.dataRegistro) return false;
    return true;
  }

  function matchesNonPeriodFilters_(record, filters) {
    const indicators = indicators_(record);

    if (
      filters.tipo &&
      ValidationService.normalizeUpper(record.TIPO_SOLICITACAO) !== filters.tipo
    ) {
      return false;
    }

    if (filters.status && statusKey_(record, indicators) !== filters.status) {
      return false;
    }

    if (filters.busca) {
      const haystack = [
        record.ID_SOLICITACAO,
        record.OPERACAO,
        record.SUPERVISOR,
        record.FORNECEDOR,
        record.USUARIO_CRIACAO,
      ].map(function (value) {
        return ValidationService.normalizeUpper(value || '');
      });

      const matched = haystack.some(function (value) {
        return value.indexOf(filters.busca) !== -1;
      });

      if (!matched) return false;
    }

    return true;
  }

  function statusKey_(record, indicators) {
    if (!indicators.triagemConcluida) return 'AGUARDANDO_TRIAGEM';
    if (ValidationService.normalizeUpper(record.TIPO_SOLICITACAO) !== TYPE_LABOR) {
      return 'TRIAGEM_CONCLUIDA';
    }
    if (!indicators.realizadoRegistrado) return 'AGUARDANDO_REALIZADO';
    if (indicators.divergencia) return 'COM_DIVERGENCIA';
    return 'CONCLUIDO';
  }

  function toListItem_(record) {
    const indicators = indicators_(record);

    return {
      idSolicitacao: text_(record.ID_SOLICITACAO),
      tipoSolicitacao: text_(record.TIPO_SOLICITACAO),
      dataCriacao: dateTime_(record.DATA_CRIACAO),
      usuarioCriacao: text_(record.USUARIO_CRIACAO),
      supervisor: text_(record.SUPERVISOR),
      operacao: text_(record.OPERACAO),
      dataOperacional: dateOnly_(record.DATA_OPERACIONAL),
      competencia: text_(record.COMPETENCIA),
      fornecedor: text_(record.FORNECEDOR),
      responsavelCusto: text_(record.RESPONSAVEL_CUSTO),
      funcao: text_(record.FUNCAO),
      turno: text_(record.TURNO),
      qtdSolicitada: numberOrNull_(record.QTD_SOLICITADA),
      qtdComparecida: numberOrNull_(record.QTD_COMPARECIDA),
      produtoAlimentacao: text_(record.PRODUTO_ALIMENTACAO),
      produtoBebida: text_(record.PRODUTO_BEBIDA),
      valorPrevisto: numberOrNull_(record.VALOR_PREVISTO),
      valorReal: numberOrNull_(record.VALOR_REAL),
      triagemConcluida: indicators.triagemConcluida,
      realizadoRegistrado: indicators.realizadoRegistrado,
      divergencia: indicators.divergencia,
    };
  }

  function toDetail_(record) {
    const indicators = indicators_(record);
    const type = ValidationService.normalizeUpper(record.TIPO_SOLICITACAO);
    const unitPrice = numberOrNull_(record.PRECO_UNITARIO_APLICADO);
    const solicitationId = text_(record.ID_SOLICITACAO);

    return {
      idSolicitacao: solicitationId,
      tipoSolicitacao: text_(record.TIPO_SOLICITACAO),
      dataCriacao: dateTime_(record.DATA_CRIACAO),
      usuarioCriacao: text_(record.USUARIO_CRIACAO),
      origem: text_(record.ORIGEM),
      idOrigem: text_(record.ID_ORIGEM),
      loteImportacao: text_(record.LOTE_IMPORTACAO),
      supervisor: text_(record.SUPERVISOR),
      operacao: text_(record.OPERACAO),
      dataOperacional: dateOnly_(record.DATA_OPERACIONAL),
      competencia: text_(record.COMPETENCIA),
      fornecedor: text_(record.FORNECEDOR),
      justificativa: text_(record.JUSTIFICATIVA),
      responsavelCusto: text_(record.RESPONSAVEL_CUSTO),
      centroCusto: text_(record.CENTRO_CUSTO),
      atividade: text_(record.ATIVIDADE),
      funcao: text_(record.FUNCAO),
      turno: text_(record.TURNO),
      qtdSolicitada: numberOrNull_(record.QTD_SOLICITADA),
      qtdComparecida: numberOrNull_(record.QTD_COMPARECIDA),
      volumeReferencia: record.VOLUME_REFERENCIA === '' || record.VOLUME_REFERENCIA == null
        ? null
        : record.VOLUME_REFERENCIA,
      unidadeVolume: text_(record.UNIDADE_VOLUME),
      precoUnitarioAplicado: unitPrice,
      produtoAlimentacao: text_(record.PRODUTO_ALIMENTACAO),
      qtdAlimentacao: numberOrNull_(record.QTD_ALIMENTACAO),
      precoAlimentacaoAplicado: numberOrNull_(record.PRECO_ALIMENTACAO_APLICADO),
      valorAlimentacao: numberOrNull_(record.VALOR_ALIMENTACAO),
      produtoBebida: text_(record.PRODUTO_BEBIDA),
      qtdBebida: numberOrNull_(record.QTD_BEBIDA),
      precoBebidaAplicado: numberOrNull_(record.PRECO_BEBIDA_APLICADO),
      valorBebida: numberOrNull_(record.VALOR_BEBIDA),
      valorPrevisto: numberOrNull_(record.VALOR_PREVISTO),
      valorReal: numberOrNull_(record.VALOR_REAL),
      produtoAlimentacaoAplicado: text_(record.PRODUTO_ALIMENTACAO_APLICADO),
      produtoBebidaAplicado: text_(record.PRODUTO_BEBIDA_APLICADO),
      motivoAjusteProduto: text_(record.MOTIVO_AJUSTE_PRODUTO),
      triagemConcluida: indicators.triagemConcluida,
      realizadoRegistrado: indicators.realizadoRegistrado,
      divergencia: indicators.divergencia,
      jornadaPadraoHoras: type === TYPE_LABOR ? PartialShiftService.FULL_SHIFT_HOURS : null,
      excecoesJornada: type === TYPE_LABOR
        ? PartialShiftService.listBySolicitation(solicitationId, unitPrice)
        : [],
    };
  }

  function indicators_(record) {
    const type = ValidationService.normalizeUpper(record.TIPO_SOLICITACAO);
    const triageCompleted = hasValue_(record.FORNECEDOR) && (
      hasValue_(record.PRECO_UNITARIO_APLICADO) ||
      hasValue_(record.PRECO_ALIMENTACAO_APLICADO) ||
      hasValue_(record.PRECO_BEBIDA_APLICADO)
    );

    if (type !== TYPE_LABOR) {
      return {
        triagemConcluida: triageCompleted,
        realizadoRegistrado: null,
        divergencia: null,
      };
    }

    const attendanceRegistered = hasValue_(record.QTD_COMPARECIDA);
    const requested = numberOrNull_(record.QTD_SOLICITADA);
    const attended = numberOrNull_(record.QTD_COMPARECIDA);

    return {
      triagemConcluida: triageCompleted,
      realizadoRegistrado: attendanceRegistered,
      divergencia: attendanceRegistered && requested != null && attended != null
        ? requested !== attended
        : null,
    };
  }

  function normalizePageSize_(value) {
    if (value === '' || value == null) return 20;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      ValidationService.fail('Tamanho da página deve ser um número inteiro maior que zero.');
    }
    return Math.min(parsed, 100);
  }

  function normalizePage_(value) {
    if (value === '' || value == null) return 1;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      ValidationService.fail('Página deve ser um número inteiro maior que zero.');
    }
    return parsed;
  }

  function text_(value) {
    return ValidationService.normalizeText(value);
  }

  function hasValue_(value) {
    return value !== '' && value != null;
  }

  function numberOrNull_(value) {
    if (!hasValue_(value)) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function dateOnly_(value) {
    if (!hasValue_(value)) return '';
    return DateService.toIsoDate(value);
  }

  function dateTime_(value) {
    if (!hasValue_(value)) return '';
    if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
      return Utilities.formatDate(value, DateService.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ss");
    }
    return text_(value);
  }

  function sortTimestamp_(value) {
    if (Object.prototype.toString.call(value) === '[object Date]' && !Number.isNaN(value.getTime())) {
      return value.getTime();
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  function readMetadataCache_() {
    try {
      const cached = CacheService.getScriptCache().get(METADATA_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  function writeMetadataCache_(value) {
    try {
      CacheService.getScriptCache().put(
        METADATA_CACHE_KEY,
        JSON.stringify(value),
        METADATA_CACHE_SECONDS
      );
    } catch (error) {
      // Cache é apenas otimização.
    }
  }

  return {
    ACTIONS,
    execute,
  };
})();
