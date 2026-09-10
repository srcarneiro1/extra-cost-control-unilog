const CatalogService = (() => {
  const SHEETS = {
    operacoes: 'CAD_OPERACOES',
    supervisores: 'CAD_SUPERVISORES',
    fornecedores: 'CAD_FORNECEDORES',
    atividades: 'CAD_ATIVIDADES',
    funcoes: 'CAD_FUNCOES',
    produtos: 'CAD_PRODUTOS',
    precosProdutos: 'PRECOS_PRODUTOS',
  };

  const SOLICITATION_TYPES = Object.freeze({
    LABOR: 'MAO_DE_OBRA',
    FOOD: 'ALIMENTACAO_BEBIDA',
  });

  const ACTIVE_CATALOG_CACHE_KEY = 'active_catalogs_v1';
  const ACTIVE_CATALOG_CACHE_SECONDS = 60;

  function getActiveCatalogs() {
    const cached = readCache_();
    if (cached) return cached;

    const providerRows = activeRows_(SHEETS.fornecedores);
    const activeFoodProviders = {};
    providerRows.forEach(function (row) {
      const provider = ValidationService.normalizeUpper(row.FORNECEDOR);
      if (provider && ValidationService.isTruthy(row.ALIMENTACAO)) {
        activeFoodProviders[provider] = true;
      }
    });

    const availableProducts = {};
    SheetRepository.readObjects(SHEETS.precosProdutos).forEach(function (row) {
      const provider = ValidationService.normalizeUpper(row.FORNECEDOR);
      const product = ValidationService.normalizeUpper(row.PRODUTO);
      if (
        product &&
        activeFoodProviders[provider] &&
        ValidationService.isTruthy(row.ATIVO)
      ) {
        availableProducts[product] = true;
      }
    });

    const result = {
      operacoes: namedDtos_(SHEETS.operacoes, 'OPERACAO'),
      supervisores: namedDtos_(SHEETS.supervisores, 'SUPERVISOR'),
      fornecedores: providerDtos_(providerRows),
      atividades: namedDtos_(SHEETS.atividades, 'ATIVIDADE'),
      funcoes: namedDtos_(SHEETS.funcoes, 'FUNCAO'),
      produtos: productDtos_(availableProducts),
    };

    writeCache_(result);
    return result;
  }

  function namedDtos_(sheetName, fieldName) {
    return activeRows_(sheetName)
      .map(function (row) {
        return {
          nome: ValidationService.normalizeText(row[fieldName]),
        };
      })
      .filter(function (item) {
        return Boolean(item.nome);
      });
  }

  function providerDtos_(rows) {
    return (rows || [])
      .map(function (row) {
        const types = [];

        if (ValidationService.isTruthy(row.MAO_DE_OBRA)) {
          types.push(SOLICITATION_TYPES.LABOR);
        }

        if (ValidationService.isTruthy(row.ALIMENTACAO)) {
          types.push(SOLICITATION_TYPES.FOOD);
        }

        const number = ValidationService.normalizeText(row.WHATSAPP_NUMERO);
        const groupLink = ValidationService.normalizeText(row.WHATSAPP_GRUPO_LINK);
        let destination = ValidationService.normalizeUpper(row.WHATSAPP_DESTINO || '');
        if (['NENHUM', 'NUMERO', 'GRUPO'].indexOf(destination) === -1) {
          destination = groupLink ? 'GRUPO' : number ? 'NUMERO' : 'NENHUM';
        }

        return {
          nome: ValidationService.normalizeText(row.FORNECEDOR),
          tiposSolicitacao: types,
          whatsappDestino: destination,
          whatsappNumero: number,
          whatsappGrupoLink: groupLink,
        };
      })
      .filter(function (item) {
        return Boolean(item.nome);
      });
  }

  function productDtos_(availableProducts) {
    return activeRows_(SHEETS.produtos)
      .map(function (row) {
        return {
          nome: ValidationService.normalizeText(row.PRODUTO),
          categoria: ValidationService.normalizeUpper(row.CATEGORIA),
        };
      })
      .filter(function (item) {
        if (!item.nome) return false;
        return Boolean(availableProducts[ValidationService.normalizeUpper(item.nome)]);
      });
  }

  function activeRows_(sheetName) {
    return SheetRepository
      .readObjects(sheetName)
      .filter(function (row) {
        return ValidationService.isTruthy(row.ATIVO);
      });
  }

  function readCache_() {
    try {
      const cached = CacheService.getScriptCache().get(ACTIVE_CATALOG_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  function writeCache_(value) {
    try {
      CacheService.getScriptCache().put(
        ACTIVE_CATALOG_CACHE_KEY,
        JSON.stringify(value),
        ACTIVE_CATALOG_CACHE_SECONDS
      );
    } catch (error) {
      // Cache é apenas otimização.
    }
  }

  return {
    getActiveCatalogs,
  };
})();
