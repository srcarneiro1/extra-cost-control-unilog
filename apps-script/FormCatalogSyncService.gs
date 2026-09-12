const FormCatalogSyncService = (() => {
  const PROPERTY_FORM_ID = 'FORM_ID';
  const PROPERTY_SPREADSHEET_ID = 'SPREADSHEET_ID';

  const SHEETS = Object.freeze({
    operacoes: 'CAD_OPERACOES',
    supervisores: 'CAD_SUPERVISORES',
    fornecedores: 'CAD_FORNECEDORES',
    atividades: 'CAD_ATIVIDADES',
    funcoes: 'CAD_FUNCOES',
    produtos: 'CAD_PRODUTOS',
    precosProdutos: 'PRECOS_PRODUTOS',
  });

  const QUESTIONS = Object.freeze({
    supervisor: 'Supervisor responsável',
    operacao: 'Operação',
    atividade: 'Atividade',
    funcao: 'Função',
    turno: 'Turno',
    alimentacao: 'Alimentação',
    bebida: 'Bebida',
  });

  const LEGACY_SHIFT_QUESTIONS = Object.freeze([
    'Turno — Auxiliar Operacional',
    'Turno — Operador de Empilhadeira',
  ]);

  const SHIFT_VALUES = Object.freeze(['DIURNO', 'NOTURNO']);

  const CATEGORIES = Object.freeze({
    FOOD: 'ALIMENTACAO',
    DRINK: 'BEBIDA',
  });

  const ACTIVITY_OTHER = 'OUTRO';
  const EDIT_TRIGGER_HANDLER = 'onCatalogEdit';
  const CLOCK_TRIGGER_HANDLER = 'scheduledFormCatalogSync';

  const RELEVANT_EDIT_SHEETS = Object.freeze({
    CAD_OPERACOES: true,
    CAD_SUPERVISORES: true,
    CAD_FORNECEDORES: true,
    CAD_ATIVIDADES: true,
    CAD_FUNCOES: true,
    CAD_PRODUTOS: true,
    PRECOS_PRODUTOS: true,
  });

  function sync() {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) {
      return {
        sincronizado: false,
        motivo: 'Sincronização já em execução.',
      };
    }

    try {
      const form = openForm_();
      const effectiveDate = DateService.parseDateOnly(new Date());

      const supervisors = activeNames_(SHEETS.supervisores, 'SUPERVISOR');
      const operations = activeNames_(SHEETS.operacoes, 'OPERACAO');
      const functions = activeNames_(SHEETS.funcoes, 'FUNCAO');
      const activities = activeNames_(SHEETS.atividades, 'ATIVIDADE')
        .filter(function (name) {
          return ValidationService.normalizeUpper(name) !== ACTIVITY_OTHER;
        });
      const eligibleProducts = eligibleProducts_(effectiveDate);

      validateChoices_(QUESTIONS.supervisor, supervisors);
      validateChoices_(QUESTIONS.operacao, operations);
      validateChoices_(QUESTIONS.funcao, functions);
      validateChoices_(QUESTIONS.atividade, activities);
      validateChoices_(QUESTIONS.alimentacao, eligibleProducts.food);
      validateChoices_(QUESTIONS.bebida, eligibleProducts.drink);

      // Campos que já eram sincronizados antes da parametrização de funções.
      setListChoices_(form, QUESTIONS.supervisor, supervisors);
      setListChoices_(form, QUESTIONS.operacao, operations);
      setActivityChoices_(form, activities);
      setListChoices_(form, QUESTIONS.alimentacao, eligibleProducts.food);
      setListChoices_(form, QUESTIONS.bebida, eligibleProducts.drink);

      // Função pode possuir navegação por seções no formulário legado.
      // Nunca substituímos essas choices silenciosamente: isso apagaria o roteamento.
      const migration = functionShiftMigrationStatus_(form);
      if (migration.concluida) {
        setChoiceQuestionValues_(form, QUESTIONS.funcao, functions, true);
        setChoiceQuestionValues_(form, QUESTIONS.turno, SHIFT_VALUES.slice(), true);
      }

      return {
        sincronizado: true,
        dataReferencia: DateService.toIsoDate(effectiveDate),
        migracaoFuncaoTurno: migration,
        quantidades: {
          supervisores: supervisors.length,
          operacoes: operations.length,
          funcoes: functions.length,
          turnos: SHIFT_VALUES.length,
          atividades: activities.length,
          alimentacao: eligibleProducts.food.length,
          bebidas: eligibleProducts.drink.length,
        },
      };
    } finally {
      lock.releaseLock();
    }
  }

  /**
   * Migração estrutural executada uma única vez.
   *
   * Objetivo:
   * - manter uma única pergunta "Função" alimentada por CAD_FUNCOES;
   * - manter uma única pergunta "Turno" com DIURNO/NOTURNO;
   * - remover os campos de turno específicos do modelo legado;
   * - retirar somente as seções que ficaram realmente vazias por causa dessa migração.
   *
   * A sincronização normal NÃO executa esta rotina automaticamente.
   */
  function migrateFunctionShiftStructure() {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(10000)) {
      return {
        migrado: false,
        motivo: 'Outra alteração do formulário está em execução.',
      };
    }

    try {
      const form = openForm_();
      const functions = activeNames_(SHEETS.funcoes, 'FUNCAO');
      validateChoices_(QUESTIONS.funcao, functions);

      const before = functionShiftMigrationStatus_(form);
      if (before.concluida) {
        setChoiceQuestionValues_(form, QUESTIONS.funcao, functions, true);
        setChoiceQuestionValues_(form, QUESTIONS.turno, SHIFT_VALUES.slice(), true);
        return {
          migrado: false,
          jaEstavaMigrado: true,
          status: functionShiftMigrationStatus_(form),
        };
      }

      const roleItem = findSingleChoiceItem_(form, QUESTIONS.funcao);
      const legacyItems = legacyShiftItems_(form);
      const legacySectionIds = uniquePageBreakIds_(legacyItems.map(function (item) {
        return precedingPageBreakId_(form, item);
      }).filter(Boolean));

      let shiftItem = singleOptionalChoiceItem_(form, QUESTIONS.turno);

      if (!shiftItem && legacyItems.length) {
        shiftItem = legacyItems[0];
        ensureChoiceType_(shiftItem, 'Campo de turno legado');
        shiftItem.setTitle(QUESTIONS.turno);
      }

      if (!shiftItem) {
        shiftItem = form
          .addListItem()
          .setTitle(QUESTIONS.turno)
          .setRequired(true)
          .setChoiceValues(SHIFT_VALUES.slice());
      }

      setChoiceValuesOnItem_(shiftItem, SHIFT_VALUES.slice(), true);
      moveItemImmediatelyAfter_(form, shiftItem, roleItem);

      // Neste momento a pergunta Função deixa de controlar navegação de página.
      // Todas as funções passam pelo mesmo campo de Turno.
      setChoiceValuesOnItem_(roleItem, functions, true);

      let removedLegacyQuestions = 0;
      legacyShiftItems_(form).forEach(function (item) {
        form.deleteItem(item);
        removedLegacyQuestions += 1;
      });

      const removedSections = removeEmptyCandidateSections_(form, legacySectionIds);
      const after = functionShiftMigrationStatus_(form);

      if (!after.concluida) {
        throw new Error(
          'A migração não deixou o formulário no estado esperado. Revise a estrutura antes de liberar novos envios.'
        );
      }

      return {
        migrado: true,
        jaEstavaMigrado: false,
        perguntasLegadasRemovidas: removedLegacyQuestions,
        secoesLegadasVaziasRemovidas: removedSections,
        funcoes: functions.length,
        turnos: SHIFT_VALUES.slice(),
        status: after,
      };
    } finally {
      lock.releaseLock();
    }
  }

  function handleEdit(event) {
    if (!event || !event.range) {
      return null;
    }

    const sheetName = event.range.getSheet().getName();
    if (!RELEVANT_EDIT_SHEETS[sheetName]) {
      return null;
    }

    return sync();
  }

  function installTriggers() {
    const spreadsheet = openSpreadsheet_();

    ScriptApp.getProjectTriggers().forEach(function (trigger) {
      const handler = trigger.getHandlerFunction();
      if (handler === EDIT_TRIGGER_HANDLER || handler === CLOCK_TRIGGER_HANDLER) {
        ScriptApp.deleteTrigger(trigger);
      }
    });

    ScriptApp
      .newTrigger(EDIT_TRIGGER_HANDLER)
      .forSpreadsheet(spreadsheet)
      .onEdit()
      .create();

    ScriptApp
      .newTrigger(CLOCK_TRIGGER_HANDLER)
      .timeBased()
      .everyHours(1)
      .create();

    return {
      instalado: true,
      gatilhos: [EDIT_TRIGGER_HANDLER, CLOCK_TRIGGER_HANDLER],
    };
  }

  function activeNames_(sheetName, fieldName) {
    const names = SheetRepository
      .readObjects(sheetName)
      .filter(function (row) {
        return ValidationService.isTruthy(row.ATIVO);
      })
      .map(function (row) {
        return ValidationService.normalizeText(row[fieldName]);
      })
      .filter(Boolean);

    return uniqueInOrder_(names);
  }

  function eligibleProducts_(effectiveDate) {
    const activeFoodProviders = {};

    SheetRepository
      .readObjects(SHEETS.fornecedores)
      .filter(function (row) {
        return ValidationService.isTruthy(row.ATIVO) &&
          ValidationService.isTruthy(row.ALIMENTACAO);
      })
      .forEach(function (row) {
        const provider = ValidationService.normalizeUpper(row.FORNECEDOR);
        if (provider) {
          activeFoodProviders[provider] = true;
        }
      });

    const activeProductRows = SheetRepository
      .readObjects(SHEETS.produtos)
      .filter(function (row) {
        return ValidationService.isTruthy(row.ATIVO);
      })
      .map(function (row) {
        return {
          nome: ValidationService.normalizeText(row.PRODUTO),
          categoria: ValidationService.normalizeUpper(row.CATEGORIA),
        };
      })
      .filter(function (item) {
        return Boolean(item.nome) &&
          (item.categoria === CATEGORIES.FOOD || item.categoria === CATEGORIES.DRINK);
      });

    const activeProducts = {};
    activeProductRows.forEach(function (item) {
      activeProducts[ValidationService.normalizeUpper(item.nome)] = item;
    });

    const eligibleNames = {};

    SheetRepository
      .readObjects(SHEETS.precosProdutos)
      .filter(function (row) {
        if (!ValidationService.isTruthy(row.ATIVO)) return false;

        const provider = ValidationService.normalizeUpper(row.FORNECEDOR);
        const product = ValidationService.normalizeUpper(row.PRODUTO);

        return Boolean(activeFoodProviders[provider]) &&
          Boolean(activeProducts[product]) &&
          isWithinValidity_(effectiveDate, row.VIGENCIA_INICIO, row.VIGENCIA_FIM);
      })
      .forEach(function (row) {
        const product = ValidationService.normalizeUpper(row.PRODUTO);
        eligibleNames[product] = true;
      });

    const food = [];
    const drink = [];

    activeProductRows.forEach(function (item) {
      const normalizedName = ValidationService.normalizeUpper(item.nome);
      if (!eligibleNames[normalizedName]) return;

      if (item.categoria === CATEGORIES.FOOD) {
        food.push(item.nome);
      } else if (item.categoria === CATEGORIES.DRINK) {
        drink.push(item.nome);
      }
    });

    return {
      food: uniqueInOrder_(food),
      drink: uniqueInOrder_(drink),
    };
  }

  function isWithinValidity_(date, startValue, endValue) {
    if (!startValue) return false;

    const start = DateService.parseDateOnly(startValue);
    if (date.getTime() < start.getTime()) return false;

    if (!endValue) return true;

    const end = DateService.parseDateOnly(endValue);
    return date.getTime() <= end.getTime();
  }

  function setListChoices_(form, title, values) {
    const item = findSingleItem_(form, title, FormApp.ItemType.LIST);
    item.asListItem().setChoiceValues(values);
  }

  function setActivityChoices_(form, values) {
    const item = findSingleItem_(form, QUESTIONS.atividade, FormApp.ItemType.MULTIPLE_CHOICE);
    item
      .asMultipleChoiceItem()
      .setChoiceValues(values)
      .showOtherOption(true);
  }

  function setChoiceQuestionValues_(form, title, values, required) {
    const item = findSingleChoiceItem_(form, title);
    setChoiceValuesOnItem_(item, values, required);
    return item;
  }

  function setChoiceValuesOnItem_(item, values, required) {
    if (item.getType() === FormApp.ItemType.LIST) {
      item.asListItem().setChoiceValues(values).setRequired(required !== false);
      return;
    }

    if (item.getType() === FormApp.ItemType.MULTIPLE_CHOICE) {
      item.asMultipleChoiceItem().setChoiceValues(values).setRequired(required !== false);
      return;
    }

    throw new Error(
      'A pergunta "' + item.getTitle() + '" precisa ser lista ou múltipla escolha para sincronização.'
    );
  }

  function ensureChoiceType_(item, label) {
    if (
      item.getType() !== FormApp.ItemType.LIST &&
      item.getType() !== FormApp.ItemType.MULTIPLE_CHOICE
    ) {
      throw new Error(label + ' precisa ser lista ou múltipla escolha.');
    }
  }

  function functionShiftMigrationStatus_(form) {
    const roleMatches = findItemsByTitle_(form, QUESTIONS.funcao);
    const shiftMatches = findItemsByTitle_(form, QUESTIONS.turno);
    const legacyItems = legacyShiftItems_(form);

    let roleHasNavigation = false;
    if (roleMatches.length === 1 && roleMatches[0].getType() === FormApp.ItemType.MULTIPLE_CHOICE) {
      roleHasNavigation = multipleChoiceUsesNavigation_(roleMatches[0].asMultipleChoiceItem());
    }

    const concluded =
      roleMatches.length === 1 &&
      shiftMatches.length === 1 &&
      legacyItems.length === 0 &&
      !roleHasNavigation;

    return {
      concluida: concluded,
      pendente: !concluded,
      perguntaFuncaoEncontrada: roleMatches.length === 1,
      perguntaTurnoGenericaEncontrada: shiftMatches.length === 1,
      perguntasTurnoLegadas: legacyItems.map(function (item) {
        return item.getTitle();
      }),
      funcaoUsaNavegacaoPorSecao: roleHasNavigation,
    };
  }

  function multipleChoiceUsesNavigation_(item) {
    return item.getChoices().some(function (choice) {
      try {
        const type = choice.getPageNavigationType();
        return type && type !== FormApp.PageNavigationType.CONTINUE;
      } catch (error) {
        return false;
      }
    });
  }

  function legacyShiftItems_(form) {
    const items = [];
    LEGACY_SHIFT_QUESTIONS.forEach(function (title) {
      findItemsByTitle_(form, title).forEach(function (item) {
        items.push(item);
      });
    });
    return items;
  }

  function singleOptionalChoiceItem_(form, title) {
    const matches = findItemsByTitle_(form, title);
    if (matches.length > 1) {
      throw new Error(
        'Esperada no máximo 1 pergunta com o título "' + title + '", mas foram encontradas ' + matches.length + '.'
      );
    }
    if (!matches.length) return null;
    ensureChoiceType_(matches[0], 'A pergunta "' + title + '"');
    return matches[0];
  }

  function precedingPageBreakId_(form, item) {
    const items = form.getItems();
    const targetIndex = item.getIndex();

    for (let index = targetIndex - 1; index >= 0; index -= 1) {
      if (items[index].getType() === FormApp.ItemType.PAGE_BREAK) {
        return items[index].getId();
      }
    }

    return null;
  }

  function uniquePageBreakIds_(ids) {
    const seen = {};
    return ids.filter(function (id) {
      const key = String(id);
      if (seen[key]) return false;
      seen[key] = true;
      return true;
    });
  }

  function removeEmptyCandidateSections_(form, pageBreakIds) {
    let removed = 0;

    pageBreakIds.forEach(function (id) {
      const items = form.getItems();
      const pageIndex = items.findIndex(function (item) {
        return item.getId() === id && item.getType() === FormApp.ItemType.PAGE_BREAK;
      });

      if (pageIndex < 0) return;

      let hasContent = false;
      for (let index = pageIndex + 1; index < items.length; index += 1) {
        if (items[index].getType() === FormApp.ItemType.PAGE_BREAK) break;
        hasContent = true;
        break;
      }

      if (!hasContent) {
        form.deleteItem(items[pageIndex]);
        removed += 1;
      }
    });

    return removed;
  }

  function moveItemImmediatelyAfter_(form, item, referenceItem) {
    const itemIndex = item.getIndex();
    const referenceIndex = referenceItem.getIndex();
    let targetIndex = referenceIndex + 1;

    if (itemIndex === targetIndex) return;
    if (itemIndex < referenceIndex) targetIndex = referenceIndex;

    form.moveItem(itemIndex, targetIndex);
  }

  function findSingleChoiceItem_(form, title) {
    const matches = findItemsByTitle_(form, title);

    if (matches.length !== 1) {
      throw new Error(
        'Esperada exatamente 1 pergunta com o título "' + title + '", mas foram encontradas ' + matches.length + '.'
      );
    }

    ensureChoiceType_(matches[0], 'A pergunta "' + title + '"');
    return matches[0];
  }

  function findItemsByTitle_(form, title) {
    const targetTitle = normalizeTitle_(title);
    return form.getItems().filter(function (item) {
      return normalizeTitle_(item.getTitle()) === targetTitle;
    });
  }

  function findSingleItem_(form, title, expectedType) {
    const matches = findItemsByTitle_(form, title);

    if (matches.length !== 1) {
      throw new Error(
        'Esperada exatamente 1 pergunta com o título "' + title + '", mas foram encontradas ' + matches.length + '.'
      );
    }

    if (matches[0].getType() !== expectedType) {
      throw new Error(
        'A pergunta "' + title + '" está com tipo incompatível para sincronização.'
      );
    }

    return matches[0];
  }

  function validateChoices_(title, values) {
    if (!Array.isArray(values) || !values.length) {
      throw new Error(
        'Nenhuma opção elegível encontrada para "' + title + '". O formulário não foi alterado.'
      );
    }
  }

  function uniqueInOrder_(values) {
    const seen = {};

    return values.filter(function (value) {
      const normalized = ValidationService.normalizeUpper(value);
      if (!normalized || seen[normalized]) return false;
      seen[normalized] = true;
      return true;
    });
  }

  function normalizeTitle_(value) {
    return ValidationService.normalizeText(value);
  }

  function openForm_() {
    const formId = PropertiesService
      .getScriptProperties()
      .getProperty(PROPERTY_FORM_ID);

    if (!formId) {
      throw new Error(
        'Propriedade FORM_ID não configurada. Use o ID da URL de edição do Google Forms (/forms/d/<ID>/edit), não o identificador do link público /d/e/... .'
      );
    }

    return FormApp.openById(formId);
  }

  function openSpreadsheet_() {
    const spreadsheetId = PropertiesService
      .getScriptProperties()
      .getProperty(PROPERTY_SPREADSHEET_ID);

    if (!spreadsheetId) {
      throw new Error('Propriedade SPREADSHEET_ID não configurada no Apps Script.');
    }

    return SpreadsheetApp.openById(spreadsheetId);
  }

  return {
    sync,
    migrateFunctionShiftStructure,
    handleEdit,
    installTriggers,
  };
})();

function syncFormCatalogs() {
  return FormCatalogSyncService.sync();
}

function migrateFormFunctionShiftStructure() {
  return FormCatalogSyncService.migrateFunctionShiftStructure();
}

function onCatalogEdit(event) {
  return FormCatalogSyncService.handleEdit(event);
}

function scheduledFormCatalogSync() {
  return FormCatalogSyncService.sync();
}

function installFormCatalogSyncTriggers() {
  return FormCatalogSyncService.installTriggers();
}
