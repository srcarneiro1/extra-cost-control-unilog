const CatalogAdminNamedEntityService = (() => {
  const DEFINITIONS = Object.freeze({
    SALVAR_OPERACAO: {
      sheetName: 'CAD_OPERACOES',
      fieldName: 'OPERACAO',
      label: 'Operação',
    },
    SALVAR_SUPERVISOR: {
      sheetName: 'CAD_SUPERVISORES',
      fieldName: 'SUPERVISOR',
      label: 'Supervisor',
    },
  });

  function execute(payload) {
    const input = payload || {};
    const action = ValidationService.normalizeUpper(input.acao || '');
    const definition = DEFINITIONS[action];

    if (!definition) {
      ValidationService.fail('Ação de cadastro nominal inválida.');
    }

    const name = ValidationService.normalizeUpper(
      ValidationService.requiredText(input.nome, definition.label)
    );
    const active = input.ativo !== false;

    SheetRepository.ensureColumns(definition.sheetName, [definition.fieldName, 'ATIVO']);

    const existing = findExisting_(definition, name);
    const values = {};
    values[definition.fieldName] = name;
    values.ATIVO = active ? 'SIM' : 'NAO';

    if (existing) {
      SheetRepository.updateFields(
        definition.sheetName,
        existing.rowNumber,
        values,
        { textFields: [definition.fieldName] }
      );
    } else {
      SheetRepository.appendObject(
        definition.sheetName,
        values,
        { textFields: [definition.fieldName] }
      );
    }

    const saved = findExisting_(definition, name);
    const record = saved ? saved.record : values;
    const formSync = syncFormCatalogsSafely_();

    return {
      nome: ValidationService.normalizeText(record[definition.fieldName]),
      ativo: ValidationService.isTruthy(record.ATIVO),
      sincronizacaoForm: formSync,
    };
  }

  function findExisting_(definition, name) {
    const normalized = ValidationService.normalizeUpper(name);
    const rows = SheetRepository.readObjects(definition.sheetName);
    const matched = rows.find(function (row) {
      return ValidationService.normalizeUpper(row[definition.fieldName]) === normalized;
    });

    if (!matched) return null;

    return SheetRepository.findRowByField(
      definition.sheetName,
      definition.fieldName,
      matched[definition.fieldName]
    );
  }

  function syncFormCatalogsSafely_() {
    try {
      return FormCatalogSyncService.sync();
    } catch (error) {
      return {
        sincronizado: false,
        motivo: error && error.message
          ? String(error.message)
          : 'Não foi possível sincronizar o formulário neste momento.',
      };
    }
  }

  return {
    execute,
  };
})();