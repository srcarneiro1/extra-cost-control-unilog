const AdministrativeSolicitationQueryService = (() => {
  const SHEET_SOLICITACOES = 'SOLICITACOES';
  const ACTIONS = Object.freeze({
    LIST: 'LISTAR',
    DETAIL: 'DETALHAR',
  });
  const TYPE_LABOR = 'MAO_DE_OBRA';
  const LIST_CACHE_PREFIX = 'admin_solicitations_list_v1_';
  const LIST_CACHE_SECONDS = 20;

  function execute(payload) {
    const input = payload || {};
    const action = ValidationService.enumValue(
      input.acao || ACTIONS.LIST,
      'Ação da consulta',
      [ACTIONS.LIST, ACTIONS.DETAIL]
    );

    return action === ACTIONS.DETAIL
      ? detail_(input)
      : list_(input);
  }

  function list_(input) {
    const limit = normalizeLimit_(input.limite);
    const cached = readListCache_(limit);
    if (cached) return cached;

    const rows = SheetRepository.readObjects(SHEET_SOLICITACOES);

    const result = {
      total: rows.length,
      limite: limit,
      itens: rows
        .slice()
        .sort(function (left, right) {
          return sortTimestamp_(right.DATA_CRIACAO) - sortTimestamp_(left.DATA_CRIACAO);
        })
        .slice(0, limit)
        .map(toListItem_),
    };

    writeListCache_(limit, result);
    return result;
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

  function normalizeLimit_(value) {
    if (value === '' || value == null) return 100;

    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      ValidationService.fail('Limite deve ser um número inteiro maior que zero.');
    }

    return Math.min(parsed, 500);
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

  function cacheKey_(limit) {
    return LIST_CACHE_PREFIX + String(limit);
  }

  function readListCache_(limit) {
    try {
      const cached = CacheService.getScriptCache().get(cacheKey_(limit));
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  function writeListCache_(limit, value) {
    try {
      CacheService.getScriptCache().put(
        cacheKey_(limit),
        JSON.stringify(value),
        LIST_CACHE_SECONDS
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
