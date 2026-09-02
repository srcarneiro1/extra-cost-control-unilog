const CatalogService = (() => {
  const SHEETS = {
    operacoes: 'CAD_OPERACOES',
    supervisores: 'CAD_SUPERVISORES',
    fornecedores: 'CAD_FORNECEDORES',
    atividades: 'CAD_ATIVIDADES',
    funcoes: 'CAD_FUNCOES',
    produtos: 'CAD_PRODUTOS',
  };

  const SOLICITATION_TYPES = Object.freeze({
    LABOR: 'MAO_DE_OBRA',
    FOOD: 'ALIMENTACAO_BEBIDA',
  });

  function getActiveCatalogs() {
    return {
      operacoes: namedDtos_(SHEETS.operacoes, 'OPERACAO'),
      supervisores: namedDtos_(SHEETS.supervisores, 'SUPERVISOR'),
      fornecedores: providerDtos_(),
      atividades: namedDtos_(SHEETS.atividades, 'ATIVIDADE'),
      funcoes: namedDtos_(SHEETS.funcoes, 'FUNCAO'),
      produtos: productDtos_(),
    };
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

  function providerDtos_() {
    return activeRows_(SHEETS.fornecedores)
      .map(function (row) {
        const types = [];

        if (ValidationService.isTruthy(row.MAO_DE_OBRA)) {
          types.push(SOLICITATION_TYPES.LABOR);
        }

        if (ValidationService.isTruthy(row.ALIMENTACAO)) {
          types.push(SOLICITATION_TYPES.FOOD);
        }

        return {
          nome: ValidationService.normalizeText(row.FORNECEDOR),
          tiposSolicitacao: types,
        };
      })
      .filter(function (item) {
        return Boolean(item.nome);
      });
  }

  function productDtos_() {
    return activeRows_(SHEETS.produtos)
      .map(function (row) {
        return {
          nome: ValidationService.normalizeText(row.PRODUTO),
          categoria: ValidationService.normalizeUpper(row.CATEGORIA),
        };
      })
      .filter(function (item) {
        return Boolean(item.nome);
      });
  }

  function activeRows_(sheetName) {
    return SheetRepository
      .readObjects(sheetName)
      .filter(function (row) {
        return ValidationService.isTruthy(row.ATIVO);
      });
  }

  return {
    getActiveCatalogs,
  };
})();
