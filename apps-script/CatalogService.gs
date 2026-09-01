const CatalogService = (() => {
  const SHEETS = {
    operacoes: 'CAD_OPERACOES',
    supervisores: 'CAD_SUPERVISORES',
    fornecedores: 'CAD_FORNECEDORES',
    atividades: 'CAD_ATIVIDADES',
    funcoes: 'CAD_FUNCOES',
    produtos: 'CAD_PRODUTOS',
  };

  function getActiveCatalogs() {
    return {
      operacoes: active_(SheetRepository.readObjects(SHEETS.operacoes)),
      supervisores: active_(SheetRepository.readObjects(SHEETS.supervisores)),
      fornecedores: active_(SheetRepository.readObjects(SHEETS.fornecedores)),
      atividades: active_(SheetRepository.readObjects(SHEETS.atividades)),
      funcoes: active_(SheetRepository.readObjects(SHEETS.funcoes)),
      produtos: active_(SheetRepository.readObjects(SHEETS.produtos)),
    };
  }

  function active_(rows) {
    return rows.filter(function (row) {
      return isTruthy_(row.ATIVO);
    });
  }

  function isTruthy_(value) {
    const normalized = String(value || '').trim().toUpperCase();
    return normalized === 'SIM' || normalized === 'TRUE' || normalized === '1' || normalized === 'ATIVO';
  }

  return {
    getActiveCatalogs,
  };
})();
