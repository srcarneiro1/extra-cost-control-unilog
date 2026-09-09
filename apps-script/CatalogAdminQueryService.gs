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
    PROVIDERS: 'FORNECEDORES',
    PRODUCTS: 'PRODUTOS',
    LABOR_PRICES: 'PRECOS_MO',
    PRODUCT_PRICES: 'PRECOS_PRODUTOS',
  });

  const DESTINATIONS = ['NENHUM', 'NUMERO', 'GRUPO'];
  const CACHE_PREFIX = 'catalog_admin_scope_v1_';
  const CACHE_SECONDS = 60;

  function getScope(payload) {
    const scope = ValidationService.enumValue(
      payload && payload.escopo,
      'Escopo do cadastro',
      Object.keys(SCOPES).map(function (key) { return SCOPES[key]; })
    );

    const cached = readCache_(scope);
    if (cached) return cached;

    let result;
    if (scope === SCOPES.SUMMARY) result = summary_();
    if (scope === SCOPES.PROVIDERS) result = providers_();
    if (scope === SCOPES.PRODUCTS) result = products_();
    if (scope === SCOPES.LABOR_PRICES) result = laborPrices_();
    if (scope === SCOPES.PRODUCT_PRICES) result = productPrices_();

    writeCache_(scope, result);
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
          if (item.ativo) return true;
          return Boolean(linkedProducts[ValidationService.normalizeUpper(item.nome)]);
        })
        .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }),
    };
  }

  function laborPrices_() {
    const providerRows = SheetRepository.readObjects(PROVIDER_SHEET);
    const functionRows = SheetRepository.readObjects(FUNCTION_SHEET);
    const laborPriceRows = SheetRepository.readObjects(LABOR_PRICE_SHEET);

    return {
      funcoes: activeNamedDtos_(functionRows, 'FUNCAO'),
      fornecedores: providerRows
        .map(providerAdminDto_)
        .filter(function (item) { return Boolean(item.nome); })
        .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }),
      precosMaoObra: laborPriceRows
        .map(laborPriceAdminDto_)
        .filter(function (item) {
          return Boolean(item.fornecedor && item.funcao && item.vigenciaInicio);
        })
        .sort(comparePriceHistory_),
    };
  }

  function productPrices_() {
    const providerRows = SheetRepository.readObjects(PROVIDER_SHEET);
    const productRows = SheetRepository.readObjects(PRODUCT_SHEET);
    const productPriceRows = SheetRepository.readObjects(PRODUCT_PRICE_SHEET);
    const activeFoodProviders = activeFoodProviders_(providerRows);
    const linkedProducts = productsLinkedToActiveProvider_(productPriceRows, activeFoodProviders);

    return {
      fornecedores: providerRows
        .map(providerAdminDto_)
        .filter(function (item) { return Boolean(item.nome); })
        .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }),
      produtos: productRows
        .map(productAdminDto_)
        .filter(function (item) {
          if (!item.nome) return false;
          if (item.ativo) return true;
          return Boolean(linkedProducts[ValidationService.normalizeUpper(item.nome)]);
        })
        .sort(function (a, b) { return a.nome.localeCompare(b.nome, 'pt-BR'); }),
      precosProdutos: productPriceRows
        .map(productPriceAdminDto_)
        .filter(function (item) {
          if (!item.fornecedor || !item.produto || !item.vigenciaInicio) return false;
          return Boolean(activeFoodProviders[ValidationService.normalizeUpper(item.fornecedor)]);
        })
        .sort(comparePriceHistory_),
    };
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
      if (product && activeFoodProviders[provider]) linked[product] = true;
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

  return {
    SCOPES,
    getScope,
  };
})();
