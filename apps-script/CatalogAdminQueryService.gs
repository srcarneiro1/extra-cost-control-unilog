const CatalogAdminQueryService = (() => {
  const OPERATION_SHEET = 'CAD_OPERACOES';
  const SUPERVISOR_SHEET = 'CAD_SUPERVISORES';
  const PROVIDER_SHEET = 'CAD_FORNECEDORES';
  const ACTIVITY_SHEET = 'CAD_ATIVIDADES';
  const FUNCTION_SHEET = 'CAD_FUNCOES';
  const PRODUCT_SHEET = 'CAD_PRODUTOS';
  const LABOR_PRICE_SHEET = 'PRECOS_MO';
  const PRODUCT_PRICE_SHEET = 'PRECOS_PRODUTOS';

  const SCOPES = Object.freeze({
    SUMMARY: 'RESUMO',
    OPERATIONS: 'OPERACOES',
    SUPERVISORS: 'SUPERVISORES',
    PROVIDERS: 'FORNECEDORES',
    PRODUCTS: 'PRODUTOS',
    LABOR_PRICES: 'PRECOS_MO',
    PRODUCT_PRICES: 'PRECOS_PRODUTOS',
  });

  const DESTINATIONS = ['NENHUM', 'NUMERO', 'GRUPO'];
  const CACHE_PREFIX = 'catalog_admin_scope_v2_';
  const CACHE_SECONDS = 60;
  const PRICE_PAGINATION_THRESHOLD = 50;
  const PRICE_PAGE_SIZE = 25;

  function getScope(payload) {
    const input = payload || {};
    const scope = ValidationService.enumValue(
      input.escopo,
      'Escopo do cadastro',
      Object.keys(SCOPES).map(function (key) { return SCOPES[key]; })
    );

    const isPriceScope = scope === SCOPES.LABOR_PRICES || scope === SCOPES.PRODUCT_PRICES;
    if (!isPriceScope) {
      const cached = readCache_(scope);
      if (cached) return cached;
    }

    let result;
    if (scope === SCOPES.SUMMARY) result = summary_();
    if (scope === SCOPES.OPERATIONS) result = operations_();
    if (scope === SCOPES.SUPERVISORS) result = supervisors_();
    if (scope === SCOPES.PROVIDERS) result = providers_();
    if (scope === SCOPES.PRODUCTS) result = products_();
    if (scope === SCOPES.LABOR_PRICES) result = laborPrices_(input);
    if (scope === SCOPES.PRODUCT_PRICES) result = productPrices_(input);

    if (!isPriceScope) writeCache_(scope, result);
    return result;
  }

  function summary_() {
    const functionRows = SheetRepository.readObjects(FUNCTION_SHEET);
    return {
      resumoAtivos: {
        operacoes: activeCount_(SheetRepository.readObjects(OPERATION_SHEET)),
        supervisores: activeCount_(SheetRepository.readObjects(SUPERVISOR_SHEET)),
        fornecedores: activeCount_(SheetRepository.readObjects(PROVIDER_SHEET)),
        atividades: activeCount_(SheetRepository.readObjects(ACTIVITY_SHEET)),
        funcoes: activeNamedDtos_(functionRows, 'FUNCAO').length,
        produtos: activeCount_(SheetRepository.readObjects(PRODUCT_SHEET)),
      },
    };
  }

  function operations_() {
    return {
      operacoes: namedAdminDtos_(SheetRepository.readObjects(OPERATION_SHEET), 'OPERACAO'),
    };
  }

  function supervisors_() {
    return {
      supervisores: namedAdminDtos_(SheetRepository.readObjects(SUPERVISOR_SHEET), 'SUPERVISOR'),
    };
  }

  function providers_() {
    return {
      fornecedores: SheetRepository.readObjects(PROVIDER_SHEET)
        .map(providerAdminDto_)
        .filter(function (item) { return Boolean(item.nome); })
        .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }),
    };
  }

  function products_() {
    const providerRows = SheetRepository.readObjects(PROVIDER_SHEET);
    const productRows = SheetRepository.readObjects(PRODUCT_SHEET);
    const productPriceRows = SheetRepository.readObjects(PRODUCT_PRICE_SHEET);
    const activeFoodProviders = activeFoodProviders_(providerRows);
    const linkedProducts = productsLinkedToActiveProvider_(productPriceRows, activeFoodProviders);

    return {
      produtos: productRows
        .map(productAdminDto_)
        .filter(function (item) {
          if (!item.nome) return false;
          return Boolean(linkedProducts[ValidationService.normalizeUpper(item.nome)]);
        })
        .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }),
    };
  }

  function laborPrices_(input) {
    const providerRows = SheetRepository.readObjects(PROVIDER_SHEET);
    const functionRows = SheetRepository.readObjects(FUNCTION_SHEET);
    const search = ValidationService.normalizeUpper(input.busca || '');
    const laborPriceRows = SheetRepository.readObjects(LABOR_PRICE_SHEET)
      .map(laborPriceAdminDto_)
      .filter(function (item) {
        if (!item.fornecedor || !item.funcao || !item.vigenciaInicio) return false;
        if (!search) return true;
        return [item.fornecedor, item.funcao, item.turno, item.tipoDia]
          .map(function (value) { return ValidationService.normalizeUpper(value || ''); })
          .some(function (value) { return value.indexOf(search) !== -1; });
      })
      .sort(comparePriceHistory_);

    const paged = paginatePrices_(laborPriceRows, input);

    return {
      funcoes: activeNamedDtos_(functionRows, 'FUNCAO'),
      fornecedores: providerRows
        .map(providerAdminDto_)
        .filter(function (item) { return Boolean(item.nome); })
        .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }),
      precosMaoObra: paged.items,
      paginacao: paged.pagination,
    };
  }

  function productPrices_(input) {
    const providerRows = SheetRepository.readObjects(PROVIDER_SHEET);
    const productRows = SheetRepository.readObjects(PRODUCT_SHEET);
    const productPriceRows = SheetRepository.readObjects(PRODUCT_PRICE_SHEET);
    const activeFoodProviders = activeFoodProviders_(providerRows);
    const linkedProducts = productsLinkedToActiveProvider_(productPriceRows, activeFoodProviders);
    const search = ValidationService.normalizeUpper(input.busca || '');

    const priceDtos = productPriceRows
      .map(productPriceAdminDto_)
      .filter(function (item) {
        if (!item.fornecedor || !item.produto || !item.vigenciaInicio) return false;
        if (!activeFoodProviders[ValidationService.normalizeUpper(item.fornecedor)]) return false;
        if (!search) return true;
        return [item.fornecedor, item.produto, item.categoria]
          .map(function (value) { return ValidationService.normalizeUpper(value || ''); })
          .some(function (value) { return value.indexOf(search) !== -1; });
      })
      .sort(comparePriceHistory_);

    const paged = paginatePrices_(priceDtos, input);

    return {
      fornecedores: providerRows
        .map(providerAdminDto_)
        .filter(function (item) {
          return Boolean(item.nome) && item.ativo && item.alimentacao;
        })
        .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }),
      produtos: productRows
        .map(productAdminDto_)
        .filter(function (item) {
          if (!item.nome) return false;
          return Boolean(linkedProducts[ValidationService.normalizeUpper(item.nome)]);
        })
        .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }),
      precosProdutos: paged.items,
      paginacao: paged.pagination,
    };
  }

  function paginatePrices_(items, input) {
    const total = items.length;
    const paginated = total > PRICE_PAGINATION_THRESHOLD;
    const pageSize = paginated ? normalizePageSize_(input.tamanhoPagina) : Math.max(total, 1);
    const totalPages = paginated ? Math.max(1, Math.ceil(total / pageSize)) : 1;
    const requestedPage = normalizePage_(input.pagina);
    const page = Math.min(requestedPage, totalPages);
    const start = (page - 1) * pageSize;

    return {
      items: paginated ? items.slice(start, start + pageSize) : items,
      pagination: {
        total: total,
        pagina: page,
        tamanhoPagina: paginated ? pageSize : total,
        totalPaginas: totalPages,
        paginado: paginated,
      },
    };
  }

  function normalizePage_(value) {
    if (value === '' || value == null) return 1;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  }

  function normalizePageSize_(value) {
    if (value === '' || value == null) return PRICE_PAGE_SIZE;
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : PRICE_PAGE_SIZE;
  }

  function namedAdminDtos_(rows, fieldName) {
    return (rows || [])
      .map(function (row) {
        return {
          nome: ValidationService.normalizeText(row[fieldName]),
          ativo: ValidationService.isTruthy(row.ATIVO),
        };
      })
      .filter(function (item) { return Boolean(item.nome); })
      .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); });
  }

  function activeFoodProviders_(providerRows) {
    const active = {};
    (providerRows || []).forEach(function (row) {
      const provider = ValidationService.normalizeUpper(row.FORNECEDOR);
      if (
        provider &&
        ValidationService.isTruthy(row.ATIVO) &&
        ValidationService.isTruthy(row.ALIMENTACAO)
      ) {
        active[provider] = true;
      }
    });
    return active;
  }

  function productsLinkedToActiveProvider_(priceRows, activeFoodProviders) {
    const linked = {};
    (priceRows || []).forEach(function (row) {
      const provider = ValidationService.normalizeUpper(row.FORNECEDOR);
      const product = ValidationService.normalizeUpper(row.PRODUTO);
      if (
        product &&
        activeFoodProviders[provider] &&
        ValidationService.isTruthy(row.ATIVO)
      ) linked[product] = true;
    });
    return linked;
  }

  function activeCount_(rows) {
    return (rows || []).filter(function (row) {
      return ValidationService.isTruthy(row.ATIVO);
    }).length;
  }

  function activeNamedDtos_(rows, fieldName) {
    return (rows || [])
      .filter(function (row) { return ValidationService.isTruthy(row.ATIVO); })
      .map(function (row) {
        return { nome: ValidationService.normalizeText(row[fieldName]) };
      })
      .filter(function (item) { return Boolean(item.nome); });
  }

  function providerAdminDto_(row) {
    const number = ValidationService.normalizeText(row.WHATSAPP_NUMERO);
    const groupLink = ValidationService.normalizeText(row.WHATSAPP_GRUPO_LINK);
    let destination = ValidationService.normalizeUpper(row.WHATSAPP_DESTINO || '');

    if (DESTINATIONS.indexOf(destination) === -1) {
      destination = groupLink ? 'GRUPO' : number ? 'NUMERO' : 'NENHUM';
    }

    return {
      nome: ValidationService.normalizeText(row.FORNECEDOR),
      maoDeObra: ValidationService.isTruthy(row.MAO_DE_OBRA),
      alimentacao: ValidationService.isTruthy(row.ALIMENTACAO),
      ativo: ValidationService.isTruthy(row.ATIVO),
      whatsappDestino: destination,
      whatsappNumero: number,
      whatsappGrupoLink: groupLink,
    };
  }

  function productAdminDto_(row) {
    return {
      nome: ValidationService.normalizeText(row.PRODUTO),
      categoria: ValidationService.normalizeUpper(row.CATEGORIA),
      ativo: ValidationService.isTruthy(row.ATIVO),
    };
  }

  function laborPriceAdminDto_(row) {
    return {
      fornecedor: ValidationService.normalizeText(row.FORNECEDOR),
      funcao: ValidationService.normalizeText(row.FUNCAO),
      turno: ValidationService.normalizeUpper(row.TURNO),
      tipoDia: ValidationService.normalizeUpper(row.TIPO_DIA),
      vigenciaInicio: safeIsoDate_(row.VIGENCIA_INICIO),
      vigenciaFim: row.VIGENCIA_FIM ? safeIsoDate_(row.VIGENCIA_FIM) : '',
      precoUnitario: moneyNumber_(row.PRECO_UNITARIO),
      ativo: ValidationService.isTruthy(row.ATIVO),
    };
  }

  function productPriceAdminDto_(row) {
    return {
      fornecedor: ValidationService.normalizeText(row.FORNECEDOR),
      produto: ValidationService.normalizeText(row.PRODUTO),
      categoria: ValidationService.normalizeUpper(row.CATEGORIA),
      vigenciaInicio: safeIsoDate_(row.VIGENCIA_INICIO),
      vigenciaFim: row.VIGENCIA_FIM ? safeIsoDate_(row.VIGENCIA_FIM) : '',
      precoUnitario: moneyNumber_(row.PRECO_UNITARIO),
      ativo: ValidationService.isTruthy(row.ATIVO),
    };
  }

  function comparePriceHistory_(a, b) {
    const byStart = String(b.vigenciaInicio || '').localeCompare(String(a.vigenciaInicio || ''));
    if (byStart !== 0) return byStart;
    return String(a.fornecedor || '').localeCompare(String(b.fornecedor || ''), 'pt-BR');
  }

  function safeIsoDate_(value) {
    if (!value) return '';
    return DateService.toIsoDate(value);
  }

  function moneyNumber_(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    const text = String(value == null ? '' : value).trim();
    if (!text) return 0;
    let normalized = text;
    if (text.indexOf(',') >= 0 && text.indexOf('.') >= 0) {
      normalized = text.lastIndexOf(',') > text.lastIndexOf('.')
        ? text.replace(/\./g, '').replace(',', '.')
        : text.replace(/,/g, '');
    } else if (text.indexOf(',') >= 0) {
      normalized = text.replace(',', '.');
    }
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function cacheKey_(scope) {
    return CACHE_PREFIX + scope;
  }

  function readCache_(scope) {
    try {
      const cached = CacheService.getScriptCache().get(cacheKey_(scope));
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  function writeCache_(scope, value) {
    try {
      CacheService.getScriptCache().put(
        cacheKey_(scope),
        JSON.stringify(value),
        CACHE_SECONDS
      );
    } catch (error) {
      // Cache é apenas otimização.
    }
  }

  function clearCache() {
    try {
      CacheService.getScriptCache().removeAll([
        cacheKey_(SCOPES.SUMMARY),
        cacheKey_(SCOPES.OPERATIONS),
        cacheKey_(SCOPES.SUPERVISORS),
        cacheKey_(SCOPES.PROVIDERS),
        cacheKey_(SCOPES.PRODUCTS),
      ]);
    } catch (error) {
      // Cache é apenas otimização; falha nunca bloqueia a operação.
    }
  }

  return {
    SCOPES,
    getScope,
    clearCache,
  };
})();